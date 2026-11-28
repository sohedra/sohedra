// Prints which experts a change needs and the files each should read, for the
// sohedra-expert-review skill.
//
//   node scripts/expert-scope.ts              Each expert from its own "Last reviewed" commit.
//   node scripts/expert-scope.ts --base main  Everyone from one base, like a branch before merging.
//   node scripts/expert-scope.ts --json       The same plan as JSON, for the skill.
//
// A file reaches the experts whose area holds it: Svelte code and the web primitives reach the
// Svelte expert; the binding, the modules, the Lynx playground and the Lynx primitives reach the
// Lynx expert. Core and the binding's Svelte layer reach both, since both platforms run them.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

/** An expert and the files it owns. */
interface Expert {
	name: string;
	owns: (file: string) => boolean;
}

export const EXPERTS: Expert[] = [
	{
		name: "svelte",
		owns: (file) =>
			file.startsWith("packages/primitives-web/") ||
			(/\.svelte(?:\.[jt]s)?$/.test(file) && !isLynx(file) && !isShared(file)),
	},
	{ name: "lynx", owns: isLynx },
];

/** Files every expert reads: both platforms run them. */
export function isShared(file: string): boolean {
	return (
		file.startsWith("packages/primitives-core/") ||
		file.startsWith("packages/lynx/src/svelte/") ||
		file === "contributing/architecture.md"
	);
}

function isLynx(file: string): boolean {
	return (
		(file.startsWith("packages/lynx/") && !file.startsWith("packages/lynx/src/svelte/")) ||
		file.startsWith("packages/primitives-lynx/") ||
		file.startsWith("modules/") ||
		file.startsWith("playgrounds/lynx/")
	);
}

/** The commit an expert last reviewed, from `Last reviewed: \`<sha>\`` in its decisions.md. */
function lastReviewed(root: string, expert: string): string | undefined {
	const file = join(root, ".agents/experts", expert, "decisions.md");
	if (!existsSync(file)) return undefined;
	return /^Last reviewed: `([0-9a-f]{7,40})`/m.exec(readFileSync(file, "utf8"))?.[1];
}

function changed(root: string, base: string): string[] {
	try {
		return execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], {
			cwd: root,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		})
			.split("\n")
			.filter(Boolean);
	} catch {
		// Like a shallow clone that doesn't have the commit.
		console.error(`Can't diff ${base}...HEAD. Fetch the history it needs, or pass another --base.`);
		process.exit(1);
	}
}

if (import.meta.main) {
	const { values: flags } = parseArgs({
		options: { base: { type: "string" }, json: { type: "boolean", default: false } },
	});
	const plan: {
		expert: string;
		base: string | null;
		own: string[];
		shared: string[];
		note?: string;
	}[] = [];
	for (const { name, owns } of EXPERTS) {
		const base = flags.base ?? lastReviewed(".", name);
		if (base === undefined) {
			plan.push({
				expert: name,
				base: null,
				own: [],
				shared: [],
				note: "no Last reviewed commit; pass --base",
			});
			continue;
		}
		const files = changed(".", base);
		const own = files.filter(owns);
		const shared = files.filter(isShared);
		if (own.length > 0 || shared.length > 0) plan.push({ expert: name, base, own, shared });
	}
	if (flags.json) {
		console.log(JSON.stringify(plan, null, 2));
	} else if (plan.length === 0) {
		console.log("No expert needed: nothing Svelte or Lynx sees changed.");
	} else {
		for (const entry of plan) {
			if (entry.note !== undefined) {
				console.log(`${entry.expert}: ${entry.note}`);
				continue;
			}
			const list = (files: string[], max: number): string =>
				`${files.slice(0, max).join(", ")}${files.length > max ? ", ..." : ""}`;
			const base = /^[0-9a-f]{40}$/.test(entry.base!) ? entry.base!.slice(0, 8) : entry.base;
			console.log(`${entry.expert}-expert, ${base}...HEAD`);
			console.log(`  own (${entry.own.length}): ${list(entry.own, 8)}`);
			console.log(`  shared (${entry.shared.length}): ${list(entry.shared, 5)}`);
		}
	}
}
