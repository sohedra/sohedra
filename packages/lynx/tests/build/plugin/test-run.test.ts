// A test run (Rstest) compiles the app with the build's rules, on one thread, with no Lynx engine:
// no template, no bundle, no layers.

import fs from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import { buildApp, cleanBuild } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";

let build: AppBuild;
let files: string[];
let code: string;

/** Every file under `folder`. */
function listFiles(folder: string): string[] {
	return fs
		.readdirSync(folder, { withFileTypes: true })
		.flatMap((entry) =>
			entry.isDirectory()
				? listFiles(path.join(folder, entry.name))
				: [path.join(folder, entry.name)],
		);
}

beforeAll(async () => {
	build = await buildApp("app", { callerName: "rstest", outside: true });
	files = listFiles(path.join(build.dist, "out"));
	code = files
		.filter((file) => file.endsWith(".js"))
		.map((file) => fs.readFileSync(file, "utf8"))
		.join("\n");
}, 180_000);
afterAll(() => cleanBuild(build));

describe("a build for a test run", () => {
	it("builds the app, its components and its rune modules", () => {
		expect(build.error + build.messages).toBe("");
		expect(build.ok).toBe(true);
		// The component's own text, through Svelte and the rune module's `$state`.
		expect(code).toContain("label caption");
	});

	it("leaves no template and no Lynx bundle: the engine is not part of a test run", () => {
		expect(files.some((file) => file.endsWith(".lynx.bundle") || file.endsWith("tasm.json"))).toBe(
			false,
		);
	});

	it("compiles the app for the background, and each component's first-frame copy for the main thread", () => {
		expect(code).toContain("lepus=false js=true");
		expect(code).toContain("lepus=true js=false");
	});

	it("resolves background-only to its empty module, so a test can import what the app guards with it", () => {
		expect(code).toContain("https://example.com");
		expect(code).not.toContain("The first frame used");
	});
});
