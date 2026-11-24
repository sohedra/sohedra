// The binding's hint for a global Lynx lacks (packages/lynx/src/wire/missing-globals.ts) is a table
// of names written by hand, and @sohedra/lynx-polyfill's entries are what installs them. Neither
// package may import the other, so this reads both as text: every global an entry installs has a
// row, every row is a global its import installs, and the background-only list is what the main
// thread never gets.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const TABLE = "packages/lynx/src/wire/missing-globals.ts";
const SNAPSHOT = "modules/lynx-polyfill/tests/package/__snapshots__/entries.test.ts.snap";

/** Names the snapshot's realm (Node's) has already, so no entry adds them there, with why. */
const IN_NODE: Readonly<Record<string, string>> = {
	Iterator: "Node's realm has ES2025's Iterator; PrimJS's has none.",
};

/** The quoted names in `text`. */
function namesIn(text: string): string[] {
	return [...text.matchAll(/"([^"]*)"/g)].map((match) => match[1]!);
}

/** The body of the `const` named `name` in `source`, to its closing bracket. */
function constBody(source: string, name: string, close: string): string {
	const start = source.indexOf(`const ${name}`);
	if (start === -1) throw new Error(`${TABLE} has no ${name}.`);
	return source.slice(start, source.indexOf(`\n${close};`, start));
}

/** What is wrong with the binding's missing-global table in the repository in `root`. */
export function checkMissingGlobals(root: string): string[] {
	try {
		return problemsOf(root);
	} catch (error) {
		// Boundary: a thrown value is `unknown`; this is constBody's `Error`.
		return [(error as Error).message];
	}
}

function problemsOf(root: string): string[] {
	const source = readFileSync(join(root, TABLE), "utf8");
	const snapshot = readFileSync(join(root, SNAPSHOT), "utf8");
	const filled = new Map<string, string[]>();
	for (const match of constBody(source, "FILLED", "}").matchAll(/"([^"]*)":\s*\[([^\]]*)\]/g))
		filled.set(match[1]!, namesIn(match[2]!));
	const backgroundOnly = new Set(namesIn(constBody(source, "BACKGROUND_ONLY", "]")));
	const installed = new Map<string, Set<string>>();
	for (const match of snapshot.matchAll(
		/exports\[`import "@sohedra\/lynx-polyfill([^"]*)" > on the ([\w-]+): its globals, and its size within budget 1`\] = `\n\[([^\]]*)\]/g,
	))
		installed.set(`${match[1]!} ${match[2]!}`, new Set(namesIn(match[3]!)));
	const onThread = (thread: string): Set<string> =>
		new Set(
			[...installed].flatMap(([key, names]) => (key.endsWith(` ${thread}`) ? [...names] : [])),
		);
	const background = onThread("background");
	const mainThread = onThread("main-thread");
	const rows = new Set([...filled.values()].flat());
	const problems: string[] = [];
	const fix = `Update ${TABLE}, whose tables must match the globals in ${SNAPSHOT}.`;
	for (const name of [...background, ...mainThread])
		if (!rows.has(name)) problems.push(`${TABLE} has no row for \`${name}\`. ${fix}`);
	for (const [subpath, names] of filled)
		for (const name of names) {
			const own = new Set([
				...(installed.get(`${subpath} background`) ?? []),
				...(installed.get(`${subpath} main-thread`) ?? []),
			]);
			if (!own.has(name) && !(name in IN_NODE))
				problems.push(
					`${TABLE} names "@sohedra/lynx-polyfill${subpath}" for \`${name}\`, which that import doesn't install. ${fix}`,
				);
		}
	for (const name of rows) {
		if (name in IN_NODE) continue;
		const only = background.has(name) && !mainThread.has(name);
		if (only !== backgroundOnly.has(name))
			problems.push(
				`${TABLE}: \`${name}\` ${only ? "is installed on the background only, and BACKGROUND_ONLY lacks it" : "is installed on the main thread too, and BACKGROUND_ONLY lists it"}. ${fix}`,
			);
	}
	return problems;
}
