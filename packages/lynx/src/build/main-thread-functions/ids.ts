// The ids of main-thread functions: a hash of the file's path under the app's folder, a hash of
// the text of its script as written, and a count. Both threads give a function the same id
// because both read the same text, a changed script gives new ids, and two checkouts of one app
// build the same bundle.

import { createHash } from "node:crypto";
import path from "node:path";

/** The first `length` hex digits of the SHA-1 of `text`. */
export const hash = (text: string, length: number): string =>
	createHash("sha1").update(text).digest("hex").slice(0, length);

/** The file's path under the app's folder with `/` between names. */
export function pathInApp(filename: string, root: string): string {
	const inApp = path.isAbsolute(filename) ? path.relative(root, filename) : filename;
	return inApp.split(path.sep).join("/");
}

/** What the ids of one script's functions start with; a function's id adds its number. */
export function idPrefix(options: { filename: string; root: string; script: string }): string {
	const { filename, root, script } = options;
	return `${hash(pathInApp(filename, root), 4)}:${hash(script, 5)}:`;
}
