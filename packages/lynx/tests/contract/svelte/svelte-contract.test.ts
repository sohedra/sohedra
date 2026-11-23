// What @sohedra/lynx assumes about Svelte's custom renderers, in the Svelte installed here.
// Not about our code: when an upgrade changes one of these, the failing case is named for the row of
// src/svelte/manifest.ts to revisit. The test walks the manifest, so a row without a check fails,
// and a check without a row does too.

import fs from "node:fs";
import path from "node:path";

import { afterAll, describe, expect, it } from "@rstest/core";

import { SVELTE_CONTRACT } from "../../../src/svelte/index.ts";
import type { Checks } from "./check.ts";
import { checks as compilerChecks } from "./checks-compiler.ts";
import { checks as runtimeChecks } from "./checks-runtime.ts";
import { checks as sourceChecks } from "./checks-source.ts";
import { removeFixtures } from "./runtime-fixture.ts";
import { PACKAGE_ROOT, SVELTE_ROOT, occurrences, readSvelte } from "./svelte-package.ts";

/** The modules that hold checks, by the path a manifest row names them with. */
const MODULES: Record<string, Checks> = {
	"tests/contract/svelte/checks-source.ts": sourceChecks,
	"tests/contract/svelte/checks-compiler.ts": compilerChecks,
	"tests/contract/svelte/checks-runtime.ts": runtimeChecks,
};

afterAll(removeFixtures);

describe("the manifest", () => {
	it("has rows with distinct ids", () => {
		const ids = SVELTE_CONTRACT.map((row) => row.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids.length).toBeGreaterThan(0);
	});

	it("names a module that holds each row's check, and every check has a row", () => {
		const rows = new Set<string>();
		for (const row of SVELTE_CONTRACT) {
			rows.add(row.id);
			expect(fs.existsSync(path.join(PACKAGE_ROOT, row.test)), `${row.id}: ${row.test}`).toBe(true);
			expect(typeof MODULES[row.test]?.[row.id], `${row.id} has no check in ${row.test}`).toBe(
				"function",
			);
		}
		for (const [file, checks] of Object.entries(MODULES)) {
			for (const id of Object.keys(checks)) {
				expect(rows.has(id), `${file} checks "${id}", which is not a row`).toBe(true);
			}
		}
	});
});

describe("each row", () => {
	for (const row of SVELTE_CONTRACT) {
		describe(row.id, () => {
			it(`finds its anchor in ${row.file}`, () => {
				expect(fs.existsSync(path.join(SVELTE_ROOT, row.file)), row.file).toBe(true);
				expect(occurrences(readSvelte(row.file), row.anchor), row.anchor).toBeGreaterThan(0);
			});

			it(`holds: ${row.reliesOn}`, async () => {
				const check = MODULES[row.test]?.[row.id];
				await expect((async () => check?.())()).resolves.toBeUndefined();
			});
		});
	}
});
