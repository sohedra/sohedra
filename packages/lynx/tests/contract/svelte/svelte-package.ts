// The pinned Svelte build as the contract tests read it: its files, and its modules loaded by Node
// itself, as a thread would load them (never through the test bundler, which would give a second
// copy of every module that a compiled component imports).

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

/** The folder of the installed `svelte` package. */
export const SVELTE_ROOT: string = path.dirname(require.resolve("svelte/package.json"));

/** The folder of `@sohedra/lynx`. */
export const PACKAGE_ROOT: string = path.resolve(import.meta.dirname, "../../..");

/** A file of the Svelte package as text; `file` is relative to the package's folder. */
export function readSvelte(file: string): string {
	return fs.readFileSync(path.join(SVELTE_ROOT, file), "utf8");
}

/** How many times `text` occurs in `source`. */
export function occurrences(source: string, text: string): number {
	return source.split(text).length - 1;
}

/** A module as Node loads it, by absolute path or `file:` URL. */
export async function importNative(location: string): Promise<Record<string, unknown>> {
	const url = location.startsWith("file:") ? location : pathToFileURL(location).href;
	// Boundary: a module's exports are unknown to the type checker, and the bundler must not touch the import.
	return (await import(/* webpackIgnore: true */ url)) as Record<string, unknown>;
}

/** A source file of Svelte as Node loads it (the same instance a compiled component imports). */
export function importSvelte(file: string): Promise<Record<string, unknown>> {
	return importNative(path.join(SVELTE_ROOT, file));
}
