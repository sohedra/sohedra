// How packages in `node_modules` are built and resolved: compiled by each thread's rules whatever
// the app says about `source.include`, and one copy of the packages `singleCopy` names.

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
});

describe("singleCopy", () => {
	it("resolves a package a library imports from the app's folder, not from the library's own", async () => {
		build = await buildApp("single-copy", {
			packages: ["thread-lib", "outer-lib"],
			plugin: { singleCopy: ["thread-lib"] },
		});
		expect(build.error + build.messages).toBe("");
		const { mainThread, background } = scriptsOf(build);
		expect(background).toContain("background-lib-branch");
		expect(background).not.toContain("nested-copy-of-thread-lib");
		expect(mainThread).not.toContain("nested-copy-of-thread-lib");
	}, 180_000);
});
