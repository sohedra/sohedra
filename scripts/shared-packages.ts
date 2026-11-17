// A package that runs on both the web and Lynx never imports `@sohedra/lynx`: the binding is the
// one package that touches Lynx, and web code can't load it. A package says it runs on both in its
// package.json, as `"sohedra": { "runsOn": ["web", "lynx"] }`.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { sourceFiles } from "./source-files.ts";

const BINDING = "@sohedra/lynx";
const DEPENDENCY_KINDS = [
	"dependencies",
	"devDependencies",
	"peerDependencies",
	"optionalDependencies",
] as const;
const SOURCE = /\.(?:[cm]?[jt]s|svelte)$/;
const IMPORT = /["'`]@sohedra\/lynx(?:\/[^"'`]*)?["'`]/;

interface Manifest {
	name?: string;
	sohedra?: { runsOn?: string[] };
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
			for (const { file, path } of sourceFiles(root, {
				under: join(root, folder),
				names: SOURCE,
			})) {
				if (IMPORT.test(readFileSync(path, "utf8"))) {
					problems.push(
						`${file} imports ${BINDING}, but ${folder} runs on the web and on Lynx. Use Svelte's own APIs and esm-env.`,
					);
				}
			}
		}
	}
	return problems;
}
