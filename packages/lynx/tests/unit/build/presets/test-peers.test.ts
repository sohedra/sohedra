// The test presets check that the app has what they run the tests with, its optional peers, and
// name what is missing in one message.

import fs from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import { withSvelteLynx, withSvelteLynxFromConfig } from "../../../../src/build/presets/rstest.ts";
import { checkTestPeers, TEST_PEERS } from "../../../../src/build/presets/test-peers.ts";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
// An app beside the package, outside its `node_modules`, with only what each test puts there.
const APPS = path.join(ROOT, "../.lynx-test-peers");

/** An app folder with these packages installed. */
function app(name: string, packages: readonly string[]): string {
	const folder = path.join(APPS, name);
	for (const each of packages) {
		const at = path.join(folder, "node_modules", each);
		fs.mkdirSync(at, { recursive: true });
		fs.writeFileSync(path.join(at, "package.json"), JSON.stringify({ name: each }));
	}
	fs.mkdirSync(folder, { recursive: true });
	return folder;
}

describe("the test presets' peers", () => {
	beforeAll(() => fs.rmSync(APPS, { recursive: true, force: true }));
	afterAll(() => fs.rmSync(APPS, { recursive: true, force: true }));

	it("are Rstest's and Vitest's runners, jsdom and @testing-library/dom", () => {
		expect(TEST_PEERS).toEqual({
			rstest: ["@rstest/core", "jsdom", "@testing-library/dom"],
			vitest: ["vitest", "vite", "jsdom", "@testing-library/dom"],
		});
	});

	it("pass where the app has them, also in a folder above it", () => {
		const root = app("all", TEST_PEERS.rstest);
		const nested = path.join(root, "packages/ui");
		fs.mkdirSync(nested, { recursive: true });
		expect(() =>
			checkTestPeers({ runner: "rstest", preset: "withSvelteLynx()", root: nested }),
		).not.toThrow();
	});

	it("name each missing one, the preset and the app", () => {
		const root = app("some", ["@rstest/core"]);
		expect(() => checkTestPeers({ runner: "rstest", preset: "withSvelteLynx()", root })).toThrow(
			`\`withSvelteLynx()\` runs the tests with jsdom and @testing-library/dom, which are not installed in ${root}.`,
		);
		expect(() => checkTestPeers({ runner: "vitest", preset: "svelteLynx()", root })).toThrow(
			"`svelteLynx()` runs the tests with vitest, vite, jsdom and @testing-library/dom",
		);
	});

	it("are checked as the Rstest preset is made", () => {
		const root = app("none", []);
		const cwd = process.cwd();
		process.chdir(root);
		try {
			expect(() => withSvelteLynx()).toThrow("@rstest/core, jsdom and @testing-library/dom");
		} finally {
			process.chdir(cwd);
		}
	});

	it("ask an app's config preset for the Rsbuild adapter it reads the config with", () => {
		const root = app("adapter", TEST_PEERS.rstest);
		expect(() => withSvelteLynx).not.toThrow();
		expect(() => withSvelteLynxFromConfig({ rootPath: root })).toThrow(
			"`withSvelteLynxFromConfig()` runs the tests with @rstest/adapter-rsbuild, which is not installed",
		);
		app("adapter", ["@rstest/adapter-rsbuild"]);
		expect(() => withSvelteLynxFromConfig({ rootPath: root })).not.toThrow();
	});
});
