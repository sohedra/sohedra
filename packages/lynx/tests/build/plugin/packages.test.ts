// How packages in `node_modules` are built and resolved: compiled by each thread's rules whatever
// the app says about `source.include`, and one install of the packages `dedupe` names.

import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "@rstest/core";

import { buildApp, cleanBuild, scriptsOf } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";

let build: AppBuild | undefined;
afterEach(() => {
	if (build) cleanBuild(build);
	build = undefined;
});

describe("a package of node_modules", () => {
	it("is compiled for each thread, with its constants replaced and its other branch dropped", async () => {
		build = await buildApp("include", { packages: ["thread-lib"] });
		expect(build.error + build.messages).toBe("");
		const { mainThread, background } = scriptsOf(build);
		expect(mainThread).toContain("main-thread-lib-branch");
		expect(mainThread).not.toContain("background-lib-branch");
		expect(background).toContain("background-lib-branch");
		expect(background).not.toContain("main-thread-lib-branch");
		expect(mainThread).not.toContain("__MAIN_THREAD__");
		expect(background).not.toContain("__MAIN_THREAD__");
	}, 180_000);

	it("keeps its assignment to fetch, and points only the background's reads at the global's", async () => {
		build = await buildApp("include", { packages: ["thread-lib"] });
		expect(build.error + build.messages).toBe("");
		const { mainThread, background } = scriptsOf(build);
		// The assignment is to the wrapper's `fetch` parameter, which the minifier renames.
		expect(background).toMatch(
			/typeof\s*\(\s*globalThis\.fetch\s*\|\|\s*[\w$]+\.fetch\s*\)\s*&&\s*\(?[\w$]+\s*=\s*function/,
		);
		// The main thread has no `fetch` of its own: a read stays one, whose ReferenceError the
		// runtime's report names the import for.
		expect(mainThread).toMatch(/typeof fetch\b/);
		expect(mainThread).not.toContain("globalThis.fetch");
	}, 180_000);

	it("still is, when the app sets its own source.include", async () => {
		build = await buildApp("include", {
			packages: ["thread-lib"],
			rsbuild: { source: { include: [/never-matches-a-file/] } },
		});
		expect(build.error + build.messages).toBe("");
		const { mainThread, background } = scriptsOf(build);
		expect(mainThread).toContain("main-thread-lib-branch");
		expect(mainThread).not.toContain("__MAIN_THREAD__");
		expect(background).toContain("background-lib-branch");
		expect(background).not.toContain("__MAIN_THREAD__");
	}, 180_000);

	it("is compiled in a test run too, as the background's, where Rstest compiles none of them", async () => {
		build = await buildApp("include", { packages: ["thread-lib"], callerName: "rstest" });
		expect(build.error + build.messages).toBe("");
		const out = path.join(build.dist, "out");
		const code = fs
			.readdirSync(out, { recursive: true, encoding: "utf8" })
			.filter((file) => file.endsWith(".js"))
			.map((file) => fs.readFileSync(path.join(out, file), "utf8"))
			.join("\n");
		expect(code).toContain("background-lib-branch");
		expect(code).not.toContain("__MAIN_THREAD__");
	}, 180_000);
});

describe("dedupe", () => {
	it("resolves a package a library imports from the app's folder, not from the library's own", async () => {
		build = await buildApp("dedupe", {
			packages: ["thread-lib", "outer-lib"],
			plugin: { dedupe: ["thread-lib"] },
		});
		expect(build.error + build.messages).toBe("");
		const { mainThread, background } = scriptsOf(build);
		expect(background).toContain("background-lib-branch");
		expect(background).not.toContain("nested-copy-of-thread-lib");
		expect(mainThread).not.toContain("nested-copy-of-thread-lib");
	}, 180_000);
});
