// The contract tests write compiled components to disk for Node to load. Two runs of the tests in
// one checkout at a time (a push hook and an editor) must not overwrite or remove each other's.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "@rstest/core";

import { mountComponent, removeFixtures } from "./runtime-fixture.ts";

const FIXTURE_MODULE = pathToFileURL(`${import.meta.dirname}/runtime-fixture.ts`).href;

describe("the compiled components of a run", () => {
	it("survive another run, from its first component to its cleanup", async () => {
		const mounted = await mountComponent("<view></view>");
		const other = spawnSync(
			process.execPath,
			[
				"--conditions=svelte-custom-renderer",
				"--input-type=module",
				"--eval",
				`import { mountComponent, removeFixtures } from ${JSON.stringify(FIXTURE_MODULE)};
				const mounted = await mountComponent("<view></view>");
				await mounted.unmount();
				removeFixtures();`,
			],
			{ encoding: "utf8" },
		);
		expect(other.status, other.stderr).toBe(0);
		expect(fs.existsSync(mounted.file)).toBe(true);

		await mounted.unmount();
		removeFixtures();
		expect(fs.existsSync(mounted.file)).toBe(false);
	});
});
