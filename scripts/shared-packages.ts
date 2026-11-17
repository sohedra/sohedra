// A package that runs on both the web and Lynx never imports `@sohedra/lynx`: the binding is the
// one package that touches Lynx, and web code can't load it. A package says it runs on both in its
// package.json, as `"sohedra": { "runsOn": ["web", "lynx"] }`.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const BINDING = "@sohedra/lynx";
const DEPENDENCY_KINDS = [
	"dependencies",
	"devDependencies",
	"peerDependencies",
	"optionalDependencies",
] as const;
const SKIPPED = new Set(["node_modules", "lib", "dist", "coverage", ".svelte-kit"]);
const SOURCE = /\.(?:[cm]?[jt]s|svelte)$/;
const IMPORT = /["'`]@sohedra\/lynx(?:\/[^"'`]*)?["'`]/;

interface Manifest {
	name?: string;
	sohedra?: { runsOn?: string[] };
}

/** The files under `dir`, as paths from `root`, without build output and installed packages. */
function sources(root: string, dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		if (SKIPPED.has(entry.name)) return [];
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return sources(root, path);
		return SOURCE.test(entry.name) ? [relative(root, path)] : [];
	});
}

/** What is wrong with the packages of `root` that run on both the web and Lynx. */
export function checkSharedPackages(root: string): string[] {
	const problems: string[] = [];
	for (const parent of ["packages", "modules"]) {
		if (!existsSync(join(root, parent))) continue;
		for (const entry of readdirSync(join(root, parent), { withFileTypes: true })) {
			const folder = `${parent}/${entry.name}`;
			const file = join(root, folder, "package.json");
			if (!entry.isDirectory() || !existsSync(file)) continue;
			// Boundary: JSON has no type.
			const manifest = JSON.parse(readFileSync(file, "utf8")) as Manifest & Record<string, unknown>;
			const runsOn = manifest.sohedra?.runsOn ?? [];
			if (!runsOn.includes("web") || !runsOn.includes("lynx")) continue;
			for (const kind of DEPENDENCY_KINDS) {
				// Boundary: JSON has no type; the field is optional.
				const list = manifest[kind] as Record<string, string> | undefined;
				if (list !== undefined && BINDING in list) {
					problems.push(
						`${folder}/package.json lists ${BINDING} under ${kind}. A package that runs on the web and on Lynx never imports it: use Svelte's own APIs and esm-env.`,
					);
				}
			}
			for (const source of sources(root, join(root, folder))) {
				if (IMPORT.test(readFileSync(join(root, source), "utf8"))) {
					problems.push(
						`${source} imports ${BINDING}, but ${folder} runs on the web and on Lynx. Use Svelte's own APIs and esm-env.`,
					);
				}
			}
		}
	}
	return problems;
}
