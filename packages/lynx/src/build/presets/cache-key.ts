// The key of the Vitest preset's module cache: what a transformed module depends on besides its
// source.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { PACKAGE_NAME } from "../../wire/index.ts";
import { PACKAGE_ROOT } from "../plugin/layers.ts";

/** The hash of the binding's version and of the code that compiles: read once a process. */
let bindingHash: string | undefined;

function hashBinding(): string {
	const hash = createHash("sha256");
	const manifest = fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8");
	hash.update((JSON.parse(manifest) as { version: string }).version);
	// The code that compiles: the build's folder and Svelte's touchpoints of it, as installed.
	const programs = path.dirname(path.dirname(import.meta.dirname));
	for (const folder of ["build", "svelte/build"]) {
		const at = path.join(programs, folder);
		const files = fs
			.readdirSync(at, { recursive: true, encoding: "utf8" })
			.filter((file) => /\.[jt]s$/.test(file))
			.sort();
		for (const file of files) hash.update(file).update(fs.readFileSync(path.join(at, file)));
	}
	return hash.digest("hex");
}

/**
 * What keys a transformed module in Vitest's file-system cache, besides its source: the binding's
 * version, its build code, the plugin's options, and what the compile read (`compiling`: the app's
 * Svelte options and the installed Svelte). Vitest keys the cache on the source and Vite's config
 * only, so after an upgrade of the binding or of Svelte, or a change of `svelte.config.js`, a run
 * would test what was compiled before.
 */
export function cacheKey(given: unknown, compiling = ""): string {
	bindingHash ??= hashBinding();
	const hash = createHash("sha256").update(bindingHash).update(compiling);
	hash.update(
		JSON.stringify(given ?? {}, (_key, value: unknown) =>
			typeof value === "function" ? String(value) : value,
		),
	);
	return `${PACKAGE_NAME}:${hash.digest("hex").slice(0, 16)}`;
}
