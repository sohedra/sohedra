// Compiles one `.svelte` component, for the background thread (the app, through the custom
// renderer) or for the main thread's first frame (Svelte's server renderer: markup only, no
// effects). The component is preprocessed and parsed once, `prepare` rewrites it, and Svelte
// compiles the result. What a tool wraps around the result (the CSS import, the first frame's
// twin, the hot-reload footer) is that tool's.
//
// `experimental.customRenderer` makes every component import and push the renderer itself, and
// stops the compiler from emitting the DOM-only `svelte/internal/init-operations` import.

import path from "node:path";

import { isBoundaryCrash, nodes, svelteCompiler } from "../../svelte/build/index.ts";
import type {
	CompileOptions,
	ComponentAst,
	PreprocessorGroup,
	SvelteCompiler,
} from "../../svelte/build/index.ts";
import type { Thread } from "../../wire/index.ts";
import { buildError, placeAt } from "../diagnostics/messages.ts";
import type { BuildWarning, SourceText } from "../diagnostics/messages.ts";
import { compileError, compileWarnings, preprocessError } from "../diagnostics/svelte-errors.ts";
import { appendMap, compose } from "../source-map/maps.ts";
import type { InputMap, SourceMap } from "../source-map/maps.ts";
import { escapeRegExp, stringLiteral } from "../string-literal.ts";
import { lynxCss } from "./lynx-css.ts";
import { prepare } from "./prepare.ts";
import type { Prepared } from "./prepare.ts";

/** What compiling a component reads. */
export interface ComponentOptions {
	filename: string;
	/** The thread this copy of the component is for. */
	thread: Thread;
	/** The app's folder: its Svelte is the compiler, and the ids of main-thread functions are made relative to it. */
	root: string;
	/** A development build. */
	development: boolean;
	/** Whether to give a source map. */
	sourceMap: boolean;
	/** The module of the custom renderer, which background components import. */
	renderer: string;
	/** The options the app's `svelte.config.js` gives the compiler, already filtered. */
	compilerOptions?: CompileOptions | undefined;
	preprocess?: PreprocessorGroup[] | undefined;
	/** On the main thread: the module that stands in for `svelte/internal/server`. */
	serverInternals?: string | undefined;
	/** On the background thread: the module that stands in for `svelte/internal/client`. */
	clientInternals?: string | undefined;
	/**
	 * Compile the background thread's copy for hot reload (Svelte's `hmr`). A component with
	 * main-thread functions is never compiled so: its functions live in the main thread's script.
	 */
	hot?: boolean | undefined;
}

/** A compiled component. */
export interface CompiledComponent {
	code: string;
	/** From `code` to the file as it is on disk. */
	map: SourceMap | undefined;
	/** The component's `<style>`, for Lynx; undefined when it has none (the main thread's copy never does). */
	css?: string;
	/** Svelte's warnings and the build's, once: only the background thread's copy reports them. */
	warnings: BuildWarning[];
	/** The files a preprocessor read besides the component, to watch. */
	dependencies: string[];
	/** The ids of the component's main-thread functions, in source order. */
	functionIds: string[];
}

/** The text a preprocessor made of the component. */
interface Preprocessed {
	code: string;
	map: InputMap;
	dependencies: string[];
}

async function preprocessed(
	svelte: SvelteCompiler,
	source: string,
	options: ComponentOptions,
): Promise<Preprocessed> {
	const { filename, preprocess } = options;
	if (!preprocess?.length) return { code: source, map: undefined, dependencies: [] };
	try {
		const processed = await svelte.preprocess(source, preprocess, { filename });
		return {
			code: processed.code,
			// Boundary: Svelte types the map of a preprocessor loosely.
			map: processed.map as InputMap,
			dependencies: processed.dependencies ?? [],
		};
	} catch (error) {
		throw preprocessError(error, filename);
	}
}

/** The compile error of a `<svelte:boundary>` that needs async, at its place, if that is the crash. */
function boundaryNeedsAsync(
	error: unknown,
	ast: ComponentAst,
	source: SourceText,
	options: CompileOptions,
): Error | undefined {
	if (options.experimental?.async || !isBoundaryCrash(error)) return undefined;
	const boundary = [...nodes(ast.fragment)].find((node) => node.type === "SvelteBoundary");
	if (boundary === undefined) return undefined;
	return buildError({
		code: "boundary_needs_async",
		details: {},
		place: placeAt(source, boundary.start!),
	});
}

/** The name Svelte gives the component's function: the file's, made into an identifier. */
function componentName(filename: string): string {
	const base = path.basename(filename, ".svelte").replace(/[^a-zA-Z0-9_$]/g, "_");
	return /^[A-Z]/.test(base) ? base : `Svelte_${base}`;
}

/** The options Svelte compiles the prepared component with. */
function compileOptions(
	options: ComponentOptions,
	sourcemap: SourceMap | undefined,
	hmr: boolean,
): CompileOptions {
	const user = options.compilerOptions ?? {};
	const mainThread = options.thread === "main-thread";
	return {
		...user,
		filename: options.filename,
		name: componentName(options.filename),
		generate: mainThread ? "server" : "client",
		...(!mainThread && { fragments: "tree" }),
		runes: true,
		// The main thread's copy draws the first frame and is never updated: Svelte's development
		// checks there are the HTML nesting rules, which Lynx's elements don't follow, and the checks
		// the background's development copy runs on the same component and data.
		dev: options.development && !mainThread,
		hmr,
		// CSS goes into the template through an import (the caller adds it).
		css: "external",
		sourcemap: sourcemap ?? undefined,
		experimental: mainThread
			? { ...user.experimental }
			: { ...user.experimental, customRenderer: options.renderer },
	};
}

/**
 * `map` with the text of each of its sources: the file as written for a name of the file (Svelte
 * and a preprocessor may name it differently), nothing for another file a preprocessor read.
 */
function withContent(map: SourceMap, filename: string, source: string): SourceMap {
	const directory = path.dirname(filename);
	return {
		...map,
		sourcesContent: map.sources.map((name) =>
			path.resolve(directory, name) === path.resolve(filename) ? source : null,
		),
	};
}

/** Svelte's output as a module specifier, quoted, in place of the one Svelte writes. */
function withInternals(code: string, specifier: string, internals: string): string {
	const quoted = stringLiteral(internals.replace(/\\/g, "/"));
	return code.replace(new RegExp(`(['"])${escapeRegExp(specifier)}\\1`, "g"), () => quoted);
}

/**
 * Compile the component in `source`. An error is thrown as the build's message: Svelte's, with
 * its place and code frame, or the build's own.
 */
export async function compileComponent(
	source: string,
	options: ComponentOptions,
): Promise<CompiledComponent> {
	const { filename, thread } = options;
	const svelte = svelteCompiler(options.root);
	const { code, map: preprocessMap, dependencies } = await preprocessed(svelte, source, options);
	const text: SourceText = { file: filename, text: code };

	let ast: ComponentAst;
	try {
		ast = svelte.parse(code, { filename, modern: true });
	} catch (error) {
		throw compileError(error, { source: text, locate: (offset) => offset });
	}
	const internals = thread === "main-thread" ? options.serverInternals : options.clientInternals;
	const prepared: Prepared = prepare({ ...options, source: code, ast, internals });
	const map = options.sourceMap ? compose(prepared.map, preprocessMap) : undefined;
	const hmr = options.hot === true && thread === "background" && prepared.functionIds.length === 0;
	const compiling = compileOptions(options, map, hmr);
	const context = { source: text, locate: prepared.locate };
	let result;
	try {
		result = svelte.compile(prepared.code, compiling);
	} catch (error) {
		throw boundaryNeedsAsync(error, ast, text, compiling) ?? compileError(error, context);
	}

	// Boundary: Svelte's map is a source map. Its text is the prepared component; the file as
	// written is what the positions point into.
	const resultMap = options.sourceMap
		? withContent(result.js.map as SourceMap, filename, source)
		: undefined;
	if (thread === "main-thread") {
		// The background build carries the CSS and the warnings; the first frame only needs markup.
		const body = withInternals(result.js.code, "svelte/internal/server", options.serverInternals!);
		// The registrations follow Svelte's code with a map of their own, to the text a preprocessor
		// made: composed, like Svelte's, with the preprocessor's map.
		const registrationsMap = compose(prepared.registrations.map, preprocessMap);
		return {
			code: body + prepared.registrations.code,
			map:
				registrationsMap && resultMap
					? appendMap(
							{ code: body, map: resultMap },
							withContent(registrationsMap, filename, source),
						)
					: resultMap,
			warnings: [],
			dependencies,
			functionIds: prepared.functionIds,
		};
	}

	let output = result.js.code;
	if (options.clientInternals !== undefined)
		output = withInternals(output, "svelte/internal/client", options.clientInternals);
	const css = result.css && result.css.code.trim() ? lynxCss(result.css.code) : undefined;
	return {
		code: output,
		map: resultMap,
		...(css !== undefined && { css }),
		warnings: [...prepared.warnings, ...compileWarnings(result.warnings, context)],
		dependencies,
		functionIds: prepared.functionIds,
	};
}
