// `@sohedra/lynx/environment` and `esm-env` in a built app: each thread's bundle has its own
// values, a branch on one is dropped from the bundle that never runs it, also when the branch is in
// another module than the constant's, and an app with no dependency of its own on the binding still
// builds.

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import { buildApp, cleanBuild, scriptsOf } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";

const MARKS = [
	"main-thread-branch",
	"background-branch",
	"browser-branch",
	"esm-dev-branch",
	"env-dev-branch",
];

/** The marks a script has, by the name of the branch that carries each. */
const marksIn = (script: string): string[] =>
	[
		...script.matchAll(
			/(?:not-|no-)?(?:main-thread|background|browser|esm-dev|esm-prod|env-dev|env-prod)-branch/g,
		),
	]
		.map((match) => match[0])
		.toSorted((a, b) => a.localeCompare(b));

describe("a production build", () => {
	let build: AppBuild;
	let scripts: ReturnType<typeof scriptsOf>;

	beforeAll(async () => {
		build = await buildApp("env", { outside: true });
		scripts = build.ok ? scriptsOf(build) : { mainThread: "", background: "" };
	}, 180_000);
	afterAll(() => cleanBuild(build));

	it("builds an app that has no dependency on the binding, through the plugin's own copy of it", () => {
		expect(build.error + build.messages).toBe("");
		expect(build.ok).toBe(true);
	});

	it("gives the main thread its constants and drops the other thread's branches, across modules", () => {
		expect(marksIn(scripts.mainThread)).toEqual(
			[
				"main-thread-branch",
				"not-background-branch",
				"no-browser-branch",
				"esm-prod-branch",
				"env-prod-branch",
			].toSorted((a, b) => a.localeCompare(b)),
		);
	});

	it("gives the background thread its constants and drops the other thread's branches, across modules", () => {
		expect(marksIn(scripts.background)).toEqual(
			[
				"not-main-thread-branch",
				"background-branch",
				"browser-branch",
				"esm-prod-branch",
				"env-prod-branch",
			].toSorted((a, b) => a.localeCompare(b)),
		);
	});

	it("keeps no development branch of either library", () => {
		for (const script of [scripts.mainThread, scripts.background]) {
			for (const mark of MARKS.filter((name) => name.includes("dev")))
				expect(script).not.toContain(mark);
		}
	});
});

describe("a development build", () => {
	let build: AppBuild;
	let scripts: ReturnType<typeof scriptsOf>;

	beforeAll(async () => {
		build = await buildApp("env", { outside: true, development: true });
		scripts = build.ok ? scriptsOf(build) : { mainThread: "", background: "" };
	}, 180_000);
	afterAll(() => cleanBuild(build));

	it("builds", () => {
		expect(build.error + build.messages).toBe("");
		expect(build.ok).toBe(true);
	});

	it("keeps the development branch of `dev` and of `esm-env`'s DEV on both threads", () => {
		for (const script of [scripts.mainThread, scripts.background]) {
			expect(script).toContain("env-dev-branch");
			expect(script).toContain("esm-dev-branch");
		}
	});
});
