// Compiles scripts and components for the tests of main-thread functions.

import path from "node:path";

import { compileComponent, moduleFunctions } from "../../../src/build/index.ts";
import type { CompiledComponent, ModuleFunctions } from "../../../src/build/index.ts";
import type { CompileOptions, PreprocessorGroup } from "../../../src/svelte/build/index.ts";
import type { Thread } from "../../../src/wire/index.ts";
import { APP_ROOT, inApp } from "./app.ts";

/**
 * The module the main thread's copy imports Svelte's server runtime from, unless a test names
 * another: the binding's, which a component may import from, as Svelte's own it may not.
 */
export const SERVER_INTERNALS = "/binding/svelte/server-internals.ts";

/** What a test changes about a compile. */
export interface CompileCase {
	thread?: Thread;
	/** A path under the test app's `src` folder. */
	file?: string;
	development?: boolean;
	sourceMap?: boolean;
	/** The options the app's `svelte.config.js` gives the compiler. */
	compilerOptions?: CompileOptions;
	/** The module that stands in for `svelte/internal/server`, on the main thread. */
	serverInternals?: string;
	/** The module that stands in for `svelte/internal/client`, on the background thread. */
	clientInternals?: string;
	/** Preprocessors that run before the component is parsed. */
	preprocess?: PreprocessorGroup[];
	/** The app's folder, when a test needs another than this package's. */
	root?: string;
	/** Check the component as the app's own code. */
	checks?: boolean;
}

/** A plain script's main-thread functions, for one thread. */
export function compileScript(source: string, options: CompileCase = {}): ModuleFunctions {
	return moduleFunctions(source, {
		filename: options.root
			? path.join(options.root, "src", options.file ?? "handlers.ts")
			: inApp(options.file ?? "handlers.ts"),
		thread: options.thread ?? "background",
		development: options.development ?? false,
		root: options.root ?? APP_ROOT,
		sourceMap: options.sourceMap ?? false,
	});
}

/** A component, for one thread. */
export function component(source: string, options: CompileCase = {}): Promise<CompiledComponent> {
	return compileComponent(source, {
		filename: options.root
			? path.join(options.root, "src", options.file ?? "Component.svelte")
			: inApp(options.file ?? "Component.svelte"),
		thread: options.thread ?? "background",
		root: options.root ?? APP_ROOT,
		development: options.development ?? false,
		sourceMap: options.sourceMap ?? false,
		preprocess: options.preprocess,
		compilerOptions: options.compilerOptions,
		clientInternals: options.clientInternals,
		renderer: "@sohedra/lynx/internal/renderer",
		serverInternals: options.serverInternals ?? SERVER_INTERNALS,
		checks: options.checks,
	});
}
