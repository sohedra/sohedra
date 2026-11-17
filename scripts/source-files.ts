// The files the repository checks read: everything but installed packages, agent worktrees and
// build output. Build output is skipped by where it is, at a package's root next to its
// package.json, never by name: a bare `lib` would also hide SvelteKit's `src/lib/`.

import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const SKIPPED = new Set([".git", "node_modules", ".svelte-kit"]);
const OUTPUT = new Set(["lib", "dist", "coverage"]);
const WORKTREES = ".claude/worktrees";

/** A file the checks read. */
export interface SourceFile {
	/** Its path from the root, with `/` between folders on every system, as messages and lists show it. */
	file: string;
	/** Where to read it. */
	path: string;
}

/** The files under `options.under` (a folder; default `root`) whose names match `options.names`. */
export function sourceFiles(
	root: string,
	options: { under?: string; names: RegExp },
): SourceFile[] {
	return walk(root, options.under ?? root, options.names);
}

function walk(root: string, dir: string, names: RegExp): SourceFile[] {
	const isPackage = existsSync(join(dir, "package.json"));
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		// Windows' `relative()` separates folders with `\`, which no name in the repository holds.
		const file = relative(root, path).replaceAll("\\", "/");
		if (SKIPPED.has(entry.name) || (isPackage && OUTPUT.has(entry.name)) || file === WORKTREES) {
			return [];
		}
		if (entry.isDirectory()) return walk(root, path, names);
		return names.test(entry.name) ? [{ file, path }] : [];
	});
}
