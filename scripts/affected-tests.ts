// Runs the tests a branch's changes can reach, in every mode they run in.
//
//   pnpm test:affected               Against the merge base with origin/main.
//   pnpm test:affected --base <ref>
//   pnpm test:affected --dry         Prints the commands without running them.
//
// The primitives run `vitest related` on the changed files, so a test runs when it imports one,
// directly or through other modules: core in its two modes, the web in its four. A change to core
// reaches the web's tests too, since the web imports it. Every other package runs its whole suite.
// Each command runs through scripts/test-slot.sh and stops the run at the first that fails.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { mergeBase } from "./comments.ts";

const WEB_MODES = [
	["--project", "ssr", "--project", "browser (chromium)"],
	["--mode", "async", "--project", "ssr", "--project", "browser (chromium)"],
	["--project", "ssr", "--project", "browser (webkit)"],
	["--mode", "async", "--project", "ssr", "--project", "browser (webkit)"],
];
const CORE_MODES = [[], ["--mode", "async"]];
const CODE = /\.(?:[cm]?[jt]s|svelte)$/;

/** One command of the plan: the package it runs in and its arguments after `pnpm`. */
interface Step {
	pkg: string;
	args: string[];
}

/** The steps that test what changed between `base` and the working tree. */
export function planFor(root: string, files: string[]): Step[] {
	const byFolder = new Map<string, string[]>();
	for (const file of files) {
		const folder = /^((?:packages|modules|playgrounds)\/[^/]+)\//.exec(file)?.[1];
		if (folder === undefined || !existsSync(join(root, folder, "package.json"))) continue;
		byFolder.set(folder, [...(byFolder.get(folder) ?? []), file]);
	}
	const steps: Step[] = [];
	const core = (byFolder.get("packages/primitives-core") ?? []).filter((file) => CODE.test(file));
	const web = (byFolder.get("packages/primitives-web") ?? []).filter((file) => CODE.test(file));
	const absolute = (list: string[]): string[] => list.map((file) => resolve(root, file));
	if (core.length > 0) {
		for (const mode of CORE_MODES) {
			steps.push({
				pkg: "@sohedra/primitives-core",
				args: ["exec", "vitest", "related", "--run", ...mode, ...absolute(core)],
			});
		}
	}
	const webReach = [...web, ...core.filter((file) => file.includes("/src/"))];
	if (webReach.length > 0) {
		for (const mode of WEB_MODES) {
			steps.push({
				pkg: "@sohedra/primitives-web",
				args: ["exec", "vitest", "related", "--run", ...mode, ...absolute(webReach)],
			});
		}
	}
	for (const folder of byFolder.keys()) {
		if (folder === "packages/primitives-core" || folder === "packages/primitives-web") continue;
		const manifest = JSON.parse(readFileSync(join(root, folder, "package.json"), "utf8")) as {
			name: string;
			scripts?: Record<string, string>;
		};
		if (manifest.scripts?.test !== undefined) steps.push({ pkg: manifest.name, args: ["test"] });
	}
	return steps;
}

if (import.meta.main) {
	const { values: flags } = parseArgs({
		options: { base: { type: "string" }, dry: { type: "boolean", default: false } },
	});
	const base = flags.base ?? mergeBase(".");
	if (base === undefined) {
		console.error("No origin/main here to compare with: pass --base <ref>.");
		process.exit(1);
	}
	const files = execFileSync("git", ["diff", "--name-only", base], { encoding: "utf8" })
		.split("\n")
		.concat(
			execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
				encoding: "utf8",
			}).split("\n"),
		)
		// A deleted file reaches no test that still runs.
		.filter((file) => file !== "" && existsSync(file));
	const steps = planFor(".", files);
	if (steps.length === 0) {
		console.log("No tests reach what changed.");
		process.exit(0);
	}
	for (const { pkg, args } of steps) {
		const command = ["bash", "scripts/test-slot.sh", "pnpm", "-F", pkg, ...args];
		console.log(
			command.map((word) => (/[\s()]/.test(word) ? JSON.stringify(word) : word)).join(" "),
		);
		if (flags.dry) continue;
		const result = spawnSync(command[0]!, command.slice(1), { stdio: "inherit" });
		if (result.status !== 0) process.exit(result.status ?? 1);
	}
}
