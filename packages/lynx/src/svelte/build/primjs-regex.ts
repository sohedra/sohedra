// Rewrites two of Svelte's `/u` regexes with astral escapes (`\u{10000}`…) to BMP and ASCII ones:
//
// - `REGEX_VALID_TAG_NAME` (`src/utils.js`) checks tag names, and every Lynx tag name is ASCII;
// - `INVALID_ATTR_NAME_CHAR_REGEX` (`src/internal/server/index.js`, in the main thread's first
//   frame) checks attribute names; only the astral noncharacters are dropped.
//
// Lynx's main-thread engine (PrimJS) rejects such regexes when it makes bytecode, even when the
// code never runs them, and SWC does not lower `/u` regexes at any target, so this is a rewrite
// of the source text.
//
// @workaround primjs-unicode-regex kind=lynx-limit delete-when="the main-thread engine compiles regexes with astral escapes"

/** One regex to rewrite. */
export interface PrimjsRegexRewrite {
	/** The file in Svelte's `src` folder, with `/` separators. */
	file: string;
	/** The declaration, from the name to the end of the regex. */
	declaration: RegExp;
	/** What the regex is written as instead. */
	replacement: string;
	/** The regex's name. */
	name: string;
}

/** The regexes the build rewrites. */
export const PRIMJS_REGEX_REWRITES: readonly PrimjsRegexRewrite[] = [
	{
		file: "utils.js",
		declaration: /(REGEX_VALID_TAG_NAME\s*=\s*)\/\^\[a-zA-Z\][\s\S]*?\/u;/,
		replacement: "/^[a-zA-Z][a-zA-Z0-9]*(-[a-zA-Z0-9._-]*)?$/;",
		name: "REGEX_VALID_TAG_NAME",
	},
	{
		file: "internal/server/index.js",
		declaration: /(INVALID_ATTR_NAME_CHAR_REGEX\s*=\s*)\/\[[\s\S]*?\]\/u;/,
		replacement: "/[\\s'\">/=\\uFDD0-\\uFDEF\\uFFFE\\uFFFF]/;",
		name: "INVALID_ATTR_NAME_CHAR_REGEX",
	},
];

/** Whether `resourcePath` is `file` of Svelte's `src` folder. */
const isSvelteFile = (resourcePath: string, file: string): boolean =>
	resourcePath.replace(/\\/g, "/").endsWith(`/svelte/src/${file}`);

/**
 * The file's source with its regex rewritten; `undefined` when `resourcePath` is none of the
 * files; the regex's name when the file is one of them and the declaration is not there.
 */
export function rewritePrimjsRegex(
	source: string,
	resourcePath: string,
): string | { missing: string } | undefined {
	const rewrite = PRIMJS_REGEX_REWRITES.find((entry) => isSvelteFile(resourcePath, entry.file));
	if (rewrite === undefined) return undefined;
	if (!rewrite.declaration.test(source)) return { missing: rewrite.name };
	return source.replace(
		rewrite.declaration,
		(_, prefix: string) => `${prefix}${rewrite.replacement}`,
	);
}
