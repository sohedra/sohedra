// Compiles `.svelte` components, for the background thread (the app, through the custom renderer)
// or for the main thread's first frame (Svelte's server renderer: markup only, no effects). The
// compile is `compileComponent`; this loader gives it the bundler's context and takes its result:
// the CSS goes to the CSS rules through an import, and a development build gets the hot-reload
// footer.
//
// The output still goes through the layer's SWC loader afterwards (the rule lists SWC first, so it
// runs last).

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Rspack } from "@rsbuild/core";

import type { CompileOptions, PreprocessorGroup } from "../../svelte/build/index.ts";
import type { Thread } from "../../wire/index.ts";
import { compileComponent } from "../compile/component.ts";
import { buildError, buildWarning } from "../diagnostics/messages.ts";
import type { SourceMap } from "../source-map/maps.ts";
import { stringLiteral } from "../string-literal.ts";
import { storeCss } from "./css-store.ts";
import { hangFirstFrameCopy } from "./first-frame-copy.ts";
import { DECLINE, rewriteHotFooter } from "./hot-reload.ts";

const require = createRequire(import.meta.url);

/** An `import` of `background-only` in a component's compiled code. */
const IMPORTS_BACKGROUND_ONLY = /\bimport\s+(?:[^'"]*?\bfrom\s*)?(['"])background-only\1/;

// Next to this file, with its extension (`.ts` in the repository, `.js` once built).
const self = fileURLToPath(import.meta.url);
const cssLoader = path
	.join(path.dirname(self), `svelte-css${path.extname(self)}`)
	.replace(/\\/g, "/");

/** What the plugin tells the component's loader. */
export interface SvelteComponentLoaderOptions {
	thread: Thread;
	/** The module of the custom renderer. */
	renderer: string;
	/** The options the app's `svelte.config.js` gives the compiler, already filtered. */
	compilerOptions?: CompileOptions;
	preprocess?: PreprocessorGroup[];
	serverInternals?: string;
	clientInternals?: string;
	/** Swap components in place in a development build. */
	hot?: boolean;
	/**
	 * A test run's: hang the component's first-frame copy on it, for `render` from
	 * `@sohedra/lynx/testing` to draw its first frame with (./first-frame-copy.ts).
	 */
	firstFrameCopy?: boolean;
}

type Context = Rspack.LoaderContext<SvelteComponentLoaderOptions>;

async function compileSource(
	context: Context,
	source: string,
): Promise<{ code: string; map: SourceMap | undefined }> {
	const options = context.getOptions();
	const filename = context.resourcePath;
	const development = context.mode === "development";
	const hot = options.hot === true && development && options.thread === "background";
	const compiled = await compileComponent(source, {
		filename,
		thread: options.thread,
		root: context.rootContext,
		development,
		sourceMap: context.sourceMap,
		renderer: options.renderer,
		compilerOptions: options.compilerOptions,
		preprocess: options.preprocess,
		serverInternals: options.serverInternals,
		clientInternals: options.clientInternals,
		hot,
	});
	// Every component also renders on the main thread, where `background-only` has no stub to be.
	if (options.thread === "main-thread" && IMPORTS_BACKGROUND_ONLY.test(compiled.code)) {
		throw buildError({
			code: "background_only_in_component",
			details: { file: path.relative(context.rootContext, filename).split(path.sep).join("/") },
		});
	}
	for (const file of compiled.dependencies) context.addDependency(file);
	for (const warning of compiled.warnings) {
		const reported = new Error(warning.message);
		reported.name = "SvelteWarning";
		reported.stack = "";
		context.emitWarning(reported);
	}
	let code = compiled.code;
	if (hot) {
		if (compiled.functionIds.length > 0) {
			code += DECLINE;
		} else {
			const reloadModule = require
				.resolve("@lynx-js/webpack-dev-transport/reloadApp")
				.replace(/\\/g, "/");
			const rewritten = rewriteHotFooter({ code, styles: compiled.css ?? "", reloadModule });
			if (rewritten === undefined) {
				const warning = buildWarning({ code: "hot_footer_missing", details: { file: filename } });
				context.emitWarning(Object.assign(new Error(warning.message), { stack: "" }));
			} else {
				code = rewritten;
			}
		}
	}
	if (options.firstFrameCopy) {
		const file = `./${path.basename(filename)}`;
		code += hangFirstFrameCopy(file, `${file}?first-frame`);
	}
	if (compiled.css !== undefined) {
		// The CSS waits in the build's store; the import carries its key (see svelte-css.ts).
		const key = storeCss(context, compiled.css);
		const file = `./${path.basename(filename)}`;
		code += `\nimport ${stringLiteral(`${file}.css!=!${cssLoader}?css=${key}!${file}`)};\n`;
	}
	return { code, map: compiled.map };
}

export default function svelteComponentLoader(this: Context, source: string): void {
	const callback = this.async();
	compileSource(this, source).then(
		// Boundary: the bundler types a source map by its own shape.
		(result) => callback(null, result.code, result.map as Rspack.sources.RawSourceMap | undefined),
		// Boundary: the bundler's callback takes an `Error`; a rejection is any value.
		(error: unknown) => callback(error as Error),
	);
}
