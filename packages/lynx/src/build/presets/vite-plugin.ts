// The Vite plugins of a Vitest run (`@sohedra/lynx/config/vitest`): what `pluginSvelteLynx` does in
// a Rstest run, on Vite's engine. One process plays both threads, and a module is a copy for each:
//
//   background    the test file, what it imports, and each component's background compile: the
//                 module's id as it is
//   main thread   a component's first-frame copy (`Card.svelte?first-frame`) and everything it
//                 imports: their ids carry `?lynx-main-thread` (the module graph keeps one module
//                 per id, so the same file is a second module), they compile for Svelte's server
//                 renderer, and they resolve as on the main thread
//
// The compile is the build's own (`compileComponent`, `compileRuneModule`, `moduleFunctions`): the
// plugin gives it Vite's context and takes its result. What differs from the Rstest run is the
// parity table of the testing guide, each row pinned by a test in `tests/vitest/`.

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { createIdResolver, transformWithOxc } from "vite";
import type { Plugin } from "vite";

import {
	isPrimjsRegexFile,
	patchSpreadSetter,
	PRIMJS_REGEX_REWRITES,
	rewritePrimjsRegex,
	SPREAD_SETTER_FILE,
} from "../../svelte/build/index.ts";
import { PACKAGE_NAME, RENDERER_ENTRY } from "../../wire/index.ts";
import type { Thread } from "../../wire/index.ts";
import { compileComponent } from "../compile/component.ts";
import { compileRuneModule } from "../compile/rune-module.ts";
import { buildError } from "../diagnostics/messages.ts";
import { backgroundOnlyStub } from "../loaders/background-only-stub.ts";
import { firstFrameCopySource, hangFirstFrameCopy } from "../loaders/first-frame-copy.ts";
import { hasMainThreadFunction } from "../main-thread-functions/directive.ts";
import { moduleFunctions } from "../main-thread-functions/script.ts";
import { PACKAGE_ROOT, RUNTIME_FILES, VITEST_SETUP_FILE } from "../plugin/layers.ts";
import type { ResolvedOptions } from "../plugin/options.ts";
import { requestsOf, mainThreadConditions } from "../plugin/resolve.ts";
import { SVELTE_MODULE } from "../plugin/rules-script.ts";
import { TEST_MAIN_FIELDS, testConditions } from "../plugin/rules-test.ts";
import { checkSvelte } from "../plugin/svelte-check.ts";
import { moduleCompilerOptions, readSvelteOptions } from "../plugin/svelte-options.ts";
import type { SvelteOptions } from "../plugin/svelte-options.ts";
import { threadDefines } from "../plugin/thread-defines.ts";
import { escapeRegExp } from "../string-literal.ts";

/** What marks a module's main-thread copy: a query on its id. */
const MAIN_THREAD_QUERY = "lynx-main-thread";
const FIRST_FRAME_QUERY = "first-frame";
const queryOf = (name: string): RegExp => new RegExp(`[?&]${name}(?:&|$)`);
const MAIN_THREAD = queryOf(MAIN_THREAD_QUERY);
const FIRST_FRAME = queryOf(FIRST_FRAME_QUERY);
const SVELTE_COMPONENT = /\.svelte$/;
const FS_PREFIX = "/@fs/";
const SCRIPT = /\.(?:js|mjs|cjs|ts|mts|cts)$/;
const TYPESCRIPT = /\.[cm]?ts$/;
const NODE_MODULES = /[\\/]node_modules[\\/]/;

const withoutQuery = (id: string): string => id.replace(/[?#].*$/, "");
/** A path as Vite names a file, with `/` between folders: Windows' paths have `\\`. */
const slashed = (file: string): string => file.replaceAll("\\", "/");
/** The binding's folder, found whichever separator a path has. */
const IN_BINDING = new RegExp(slashed(PACKAGE_ROOT).split("/").map(escapeRegExp).join("[\\\\/]"));
const isMainThread = (id: string): boolean => MAIN_THREAD.test(id) || FIRST_FRAME.test(id);
const markMainThread = (id: string): string =>
	MAIN_THREAD.test(id) ? id : `${id}${id.includes("?") ? "&" : "?"}${MAIN_THREAD_QUERY}`;
const threadOf = (id: string): Thread => (isMainThread(id) ? "main-thread" : "background");

/** What the plugins need besides the plugin's resolved options. */
interface VitePluginsOptions {
	/** The app's folder, where Svelte resolves from: the Vite root by default. */
	rootPath?: string | undefined;
	/** The plugin's options as given, which the cache key names. */
	given: unknown;
}

/** One of the binding's entries, by its subpath, as its `exports` give it for a thread. */
function bindingEntry(request: string, thread: Thread): string | undefined {
	const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8")) as {
		exports: Record<string, string | Record<string, string>>;
	};
	const subpath = `.${request.slice(PACKAGE_NAME.length)}`;
	const entry = manifest.exports[subpath];
	if (entry === undefined) return undefined;
	const file =
		typeof entry === "string"
			? entry
			: ((thread === "main-thread" ? entry["worker"] : undefined) ?? entry["default"]);
	return file === undefined ? undefined : path.join(PACKAGE_ROOT, file);
}

/** The Vite plugins of a Vitest run, with the plugin's options already checked and resolved. */
/** The plugins of a Vitest run, and what the compile reads that Vitest's cache key must hold. */
export interface VitePlugins {
	plugins: Plugin[];
	/**
	 * What the compile read once Vite's config is resolved: the app's Svelte options (a function as
	 * its text) and the installed Svelte's `package.json`, its path and its text.
	 */
	compileInputs(): string;
}

export function vitePlugins(resolved: ResolvedOptions, options: VitePluginsOptions): VitePlugins {
	const { define, singleCopy } = resolved;
	const firstFrame = resolved.firstFrame !== false;
	// Development unless NODE_ENV says production, as in a Rstest run (Vitest sets `test`).
	const development = process.env["NODE_ENV"] !== "production";
	const appCode = (file: string): boolean =>
		!NODE_MODULES.test(file) || slashed(file).startsWith(`${slashed(PACKAGE_ROOT)}/`);
	const constants: Record<Thread, Record<string, string>> = {
		"main-thread": { ...define.mainThread, ...threadDefines("main-thread", development) },
		background: { ...define.background, ...threadDefines("background", development) },
	};
	// Precomputed, with each name escaped: a `define` key may hold `$`.
	const constantNames: Record<Thread, RegExp> = {
		"main-thread": new RegExp(Object.keys(constants["main-thread"]).map(escapeRegExp).join("|")),
		background: new RegExp(Object.keys(constants.background).map(escapeRegExp).join("|")),
	};
	const fromApp = requestsOf(["svelte", ...singleCopy]);
	const fromBinding = requestsOf([PACKAGE_NAME]);

	let root = "";
	let svelte: SvelteOptions;
	let esmEnv = "";
	/** The installed Svelte's `package.json`, once Vite's config is resolved. */
	let sveltePackage: string | undefined;
	/** Vite's own resolution, with the main thread's conditions. */
	let resolveMainThread: ReturnType<typeof createIdResolver>;

	const main: Plugin = {
		name: `${PACKAGE_NAME}:vitest`,
		enforce: "pre",

		config() {
			return {
				resolve: { conditions: testConditions(development), mainFields: [...TEST_MAIN_FIELDS] },
				test: {
					// The page's Lynx elements are DOM elements, for Testing Library's queries.
					environment: "jsdom",
					setupFiles: [VITEST_SETUP_FILE],
					server: {
						deps: {
							// As a Rstest run bundles dependencies: Svelte, the binding and every main-thread
							// copy go through Vite here, not straight to Node.
							inline: [
								/[\\/]svelte[\\/]/,
								/[\\/]esm-env[\\/]/,
								IN_BINDING,
								...singleCopy.map((name) => new RegExp(`[\\\\/]${escapeRegExp(name)}[\\\\/]`)),
								MAIN_THREAD,
							],
						},
					},
				},
			};
		},

		async configResolved(config) {
			root = options.rootPath ?? config.root;
			checkSvelte(root);
			svelte = await readSvelteOptions(root, resolved.configFile);
			for (const warning of svelte.warnings) config.logger.warn(warning.message);
			resolveMainThread = createIdResolver(config, {
				conditions: mainThreadConditions(development),
				externalConditions: mainThreadConditions(development),
				mainFields: [...TEST_MAIN_FIELDS],
			});
			const svelteRoot = path.dirname(
				createRequire(path.join(root, "package.json")).resolve("svelte/package.json"),
			);
			esmEnv = createRequire(path.join(svelteRoot, "package.json")).resolve("esm-env");
			sveltePackage = path.join(svelteRoot, "package.json");
		},

		resolveId: {
			order: "pre",
			async handler(source, importer, resolveOptions) {
				if (source.startsWith("\0") || importer === undefined) return null;
				// A main-thread copy named by its path: the first-frame copy's own imports.
				if (MAIN_THREAD.test(source) && source.startsWith("/"))
					return markMainThread(fileOf(source));
				const thread = threadOf(importer);
				const mainThread = thread === "main-thread";
				if (FIRST_FRAME.test(source)) {
					const file = slashed(path.resolve(path.dirname(fileOf(importer)), withoutQuery(source)));
					return `${file}?${FIRST_FRAME_QUERY}`;
				}
				let request = source;
				let from = fileOf(importer);
				if (source === "background-only") request = RUNTIME_FILES.backgroundOnly;
				else if (source === "esm-env") request = esmEnv;
				else if (
					source === "svelte/events" &&
					!mainThread &&
					fileOf(importer) !== RUNTIME_FILES.svelteEvents
				)
					request = RUNTIME_FILES.svelteEvents;
				else if (fromBinding.test(source)) {
					const entry = bindingEntry(source, thread);
					if (entry === undefined) return null;
					request = entry;
				} else if (fromApp.test(source)) from = path.join(root, "package.json");
				else if (!mainThread) return null;

				// The main thread's conditions: Svelte's server runtime, the binding's first frame. What
				// that resolver cannot find (a built-in) goes the usual way.
				const id =
					(mainThread ? await resolveMainThread(this.environment, request, from) : undefined) ??
					(await this.resolve(request, from, { ...resolveOptions, skipSelf: true }))?.id;
				if (id === undefined) return null;
				const file = withoutQuery(id);
				if (!mainThread || !path.isAbsolute(file)) return id;
				// Only scripts are a thread's: a style sheet is no thread's.
				return SCRIPT.test(file) || SVELTE_COMPONENT.test(file) ? markMainThread(id) : id;
			},
		},

		load: {
			order: "pre",
			handler(id) {
				if (!FIRST_FRAME.test(id)) return null;
				// By path: Vitest may hand a module restored from its cache a relative importer.
				return firstFrameCopySource(
					markMainThread(withoutQuery(id)),
					markMainThread(RUNTIME_FILES.firstFrameEntry),
				);
			},
		},

		async transform(code, id) {
			if (FIRST_FRAME.test(id)) return null;
			const file = withoutQuery(id);
			const thread = threadOf(id);
			const patched = patchSvelte(code, file);
			if (patched !== undefined) return { code: patched, map: null };
			if (SVELTE_COMPONENT.test(file)) return compileComponentFile(code, file, thread);
			if (SVELTE_MODULE.test(file)) {
				const functions = mainThreadFunctions(code, file, thread);
				const source = TYPESCRIPT.test(file)
					? (await transformOxc(functions?.code ?? code, file, "ts")).code
					: (functions?.code ?? code);
				const result = compileRuneModule(source, {
					filename: file,
					thread,
					root,
					development,
					sourceMap: false,
					compilerOptions: moduleCompilerOptions(svelte.compilerOptions),
				});
				return { code: result.code, map: null };
			}
			if (SCRIPT.test(file) && appCode(file)) {
				const functions = mainThreadFunctions(code, file, thread);
				if (functions !== undefined) return { code: functions.code, map: null };
			}
			return null;
		},
	};

	/** Strips TypeScript with Vite's own compiler, keeping every import as written. */
	async function transformOxc(
		code: string,
		file: string,
		lang: "ts" | "js",
		defines?: Record<string, string>,
	): Promise<{ code: string }> {
		return transformWithOxc(code, file, {
			lang,
			typescript: { onlyRemoveTypeImports: true },
			...(defines && { define: defines }),
		});
	}

	/** A module's main-thread functions, compiled as written; undefined when it has none. */
	function mainThreadFunctions(code: string, file: string, thread: Thread) {
		if (!hasMainThreadFunction(code)) return undefined;
		return moduleFunctions(code, { filename: file, thread, development, root, sourceMap: false });
	}

	/** Svelte's own text, patched as the build's rules patch it; undefined for any other file. */
	function patchSvelte(code: string, file: string): string | undefined {
		if (SPREAD_SETTER_FILE.test(file)) {
			const result = patchSpreadSetter(code);
			if ("missing" in result)
				throw buildError({
					code: "spread_setter_moved",
					details: { file, anchor: result.missing },
				});
			return result.code;
		}
		if (PRIMJS_REGEX_REWRITES.some((rewrite) => isPrimjsRegexFile(file, rewrite.file))) {
			const result = rewritePrimjsRegex(code, file);
			return typeof result === "string" ? result : undefined;
		}
		return undefined;
	}

	/**
	 * The file of a module's id. A module Vitest restores from its file cache names its imports, and
	 * is named, by its path from the root, which may read as a path from the file system's root.
	 */
	function fileOf(id: string): string {
		const clean = withoutQuery(id);
		// Vite's name of a file outside the root: `/@fs/` and its path, which on Windows starts with
		// its drive.
		const outside = clean.startsWith(FS_PREFIX) ? clean.slice(FS_PREFIX.length) : undefined;
		const named =
			outside === undefined ? clean : /^[A-Za-z]:/.test(outside) ? outside : `/${outside}`;
		const file = path.resolve(root, named);
		if (fs.existsSync(file)) return slashed(file);
		// Not the system's root (on Windows, the root of the drive): the path from the app's root.
		const fromRoot = path.join(root, named);
		return slashed(fs.existsSync(fromRoot) ? fromRoot : file);
	}

	/** A component's copy for `thread`, compiled as the build's loader compiles it. */
	async function compileComponentFile(
		code: string,
		file: string,
		thread: Thread,
	): Promise<{ code: string; map: null }> {
		const compiled = await compileComponent(code, {
			filename: file,
			thread,
			root,
			development,
			sourceMap: false,
			renderer: RENDERER_ENTRY,
			compilerOptions: svelte.compilerOptions,
			preprocess: svelte.preprocess,
			...(thread === "main-thread"
				? { serverInternals: RUNTIME_FILES.serverInternals }
				: { clientInternals: RUNTIME_FILES.clientInternals }),
		});
		// Svelte's output is JavaScript, its main-thread functions copied without their types: read
		// as JavaScript, as the build's SWC reads it, every import kept.
		let output = (await transformOxc(compiled.code, `${file}.js`, "js")).code;
		const self = `./${path.basename(file)}`;
		if (thread === "background" && firstFrame)
			output += hangFirstFrameCopy(self, `${self}?${FIRST_FRAME_QUERY}`);
		// The component's styles are left out, as a test has no template to put them in.
		return { code: output, map: null };
	}

	// After Vite made JavaScript of everything: what the build's SWC does last for each thread.
	const last: Plugin = {
		name: `${PACKAGE_NAME}:vitest-threads`,
		enforce: "post",
		async transform(code, id) {
			if (FIRST_FRAME.test(id)) return null;
			const file = withoutQuery(id);
			if (!SCRIPT.test(file) && !SVELTE_COMPONENT.test(file)) return null;
			const thread = threadOf(id);
			let output = code;
			// The thread's constants, in the app's code and the binding's, as each thread's copy reads them.
			if (appCode(file) && constantNames[thread].test(output))
				output = (await transformOxc(output, file, "js", constants[thread])).code;
			if (thread === "main-thread" && SCRIPT.test(file))
				output = await backgroundOnlyStub({
					source: output,
					resourcePath: file,
					rootContext: root,
					marker: RUNTIME_FILES.backgroundOnly,
				});
			return output === code ? null : { code: output, map: null };
		},
	};

	return {
		plugins: [main, last],
		compileInputs: () =>
			// Nothing is read before Vite's config is resolved.
			sveltePackage === undefined
				? ""
				: JSON.stringify(
						{
							compilerOptions: svelte.compilerOptions,
							preprocess: svelte.preprocess,
							svelte: sveltePackage,
							version: fs.readFileSync(sveltePackage, "utf8"),
						},
						(_key, value: unknown) => (typeof value === "function" ? String(value) : value),
					),
	};
}
