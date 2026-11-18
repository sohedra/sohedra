// The two threads as the bundler's layers, and where the build's own files are.

import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Thread } from "../../wire/index.ts";

/** The bundler's layer of each thread: a module is compiled for the layer that issues it. */
export const LAYERS: Readonly<Record<Thread, string>> = {
	"main-thread": "svelte:main-thread",
	background: "svelte:background",
};

/** The threads, main thread first: the order the template names their scripts in. */
export const THREADS: readonly Thread[] = ["main-thread", "background"];

const self = fileURLToPath(import.meta.url);
/** `.ts` in the repository, `.js` once built. */
const extension = path.extname(self);

/** The folder of this package: its `package.json` is there, and `@sohedra/lynx` resolves to it. */
export const PACKAGE_ROOT: string = path.resolve(path.dirname(self), "../../..");

/** A loader's absolute path, by its name without an extension, for `use().loader()`. */
export function loaderPath(name: string): string {
	return path.resolve(path.dirname(self), "../loaders", name + extension);
}

/** A file of the package's program folders (`main-thread/index`), by its path without an extension. */
function programFile(file: string): string {
	return path.resolve(path.dirname(self), "../..", file + extension).replace(/\\/g, "/");
}

/**
 * The files the build adds to a page, found by path next to the plugin: they are not exports of
 * the package, so no app imports them.
 */
export const RUNTIME_FILES: Readonly<{
	/** What the background's engine lacks, filled in before anything else on that thread loads. */
	backgroundStartUp: string;
	/** The main thread's element applier and runtime for main-thread functions. */
	mainThread: string;
	/** The main thread's copy of the page, for the first frame. */
	firstFrame: string;
	/** What `import "background-only"` resolves to: an empty module that marks its importer. */
	backgroundOnly: string;
	/** What stands in for `svelte/internal/server` in the main thread's compiled components. */
	serverInternals: string;
	/** What stands in for `svelte/internal/client` in the background's compiled components. */
	clientInternals: string;
	/** What `svelte/events` resolves to on the background. */
	svelteEvents: string;
}> = {
	backgroundStartUp: programFile("background/start-up"),
	mainThread: programFile("main-thread/entry"),
	firstFrame: programFile("first-frame/index"),
	backgroundOnly: programFile("background/background-only"),
	serverInternals: programFile("svelte/runtime/server-internals"),
	clientInternals: programFile("svelte/runtime/client-internals"),
	svelteEvents: programFile("svelte/runtime/events"),
};

/** Rstest's setup file for the test preset: it ends the page each test started. */
export const TEST_SETUP_FILE: string = programFile("testing/setup-rstest");
