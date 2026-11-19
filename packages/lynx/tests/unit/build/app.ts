// The app the build tests compile for: this package's own folder, where the pinned Svelte is installed.

import path from "node:path";

/** The app's folder: Svelte's compiler is resolved from it, and the ids of functions are relative to it. */
export const APP_ROOT: string = path.resolve(import.meta.dirname, "../../..");

/** The path of a file of the test app, under its `src` folder. */
export function inApp(...segments: string[]): string {
	return path.join(APP_ROOT, "src", ...segments);
}

/**
 * `text` with the app's folder written as `/app`, and the paths under it with `/`, so a snapshot is
 * the same on every machine: Windows separates the folders with `\`.
 */
export function withoutRoot(text: string): string {
	return text
		.split(APP_ROOT)
		.join("/app")
		.replace(/\/app(?:\\[\w.-]+)+/g, (file) => file.replaceAll("\\", "/"));
}
