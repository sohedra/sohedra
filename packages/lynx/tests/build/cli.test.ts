// Apps built as apps build them, through a CLI in a process of its own (cli-build.ts), beside the
// playground (playground.test.ts): Rsbuild's CLI with only the binding's plugin, for production,
// twice with its build cache; and rspeedy's, for development.

import fs from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import type { LynxElement, TestPage } from "../../src/testing/index.ts";
import { cliApp, cliBuild } from "./cli-build.ts";
import type { CliBuild } from "./cli-build.ts";
import { startDevicePage } from "./device-threads.ts";

/** A warning or error the CLI's logger printed. */
const MESSAGE = /^\s*(?:warn|error)\s/m;

/** A thread's script of entry `main`. */
const script = (build: CliBuild, file: string): string =>
	fs.readFileSync(path.join(build.dist, ".lynx/main", file), "utf8");

function byClass(page: TestPage, token: string): LynxElement {
	const found = page.engine
		.all()
		.find((element) => page.engine.state(element).classes.split(" ").includes(token));
	if (!found) throw new Error(`No element has the class ${token}.`);
	return found;
}

describe("an app built with Rsbuild's CLI and the binding's plugin alone, twice with its build cache", () => {
	let app: string;
	const builds: CliBuild[] = [];
	/** After each build, how many times the bundler has compiled the page's component. */
	const compiled: number[] = [];
	const compiledLines = (): number => {
		const log = path.join(app, "compiled.log");
		return fs.existsSync(log) ? fs.readFileSync(log, "utf8").split("\n").filter(Boolean).length : 0;
	};
	beforeAll(async () => {
		app = cliApp("rsbuild", ["press-lib"]);
		for (const round of [0, 1]) {
			// The second build restores the component from the cache, and builds the entry again.
			if (round === 1) fs.appendFileSync(path.join(app, "index.ts"), "\n// Changed.\n");
			builds.push(await cliBuild({ cli: "rsbuild", cwd: app }));
			compiled.push(compiledLines());
		}
	}, 360_000);
	afterAll(() => fs.rmSync(path.dirname(app), { recursive: true, force: true }));

	/** The page of build `round`, started on threads shaped like a device's. */
	const start = (round: number) =>
		startDevicePage({
			mainThread: script(builds[round]!, "main-thread.js"),
			background: script(builds[round]!, "background.js"),
		}).page;

	it("builds both times, Lynx's build plugin registered by the plugin, the second from the cache", () => {
		for (const build of builds) {
			expect(build.ok, build.output).toBe(true);
			expect(build.output).not.toMatch(MESSAGE);
			expect(fs.existsSync(path.join(build.dist, "main.lynx.bundle"))).toBe(true);
		}
		// Once for each thread, then not at all: the second build restored the component.
		expect(compiled[0]).toBeGreaterThan(0);
		expect(compiled[1]).toBe(compiled[0]);
	});

	it("runs a library's main-thread function at a main-thread tap, from a `.js` file of a package that has no side effects", async () => {
		const page = start(0);
		try {
			await page.settle();
			const press = byClass(page, "press");
			page.engine.dispatch(press, { type: "tap" });
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(page.engine.state(press).inlineStyles.get("width")).toBe("3px");
		} finally {
			page.dispose();
		}
	});

	it("runs a library's main-thread function that only an effect calls, from a package that has no side effects", async () => {
		const page = start(0);
		try {
			await page.settle();
			page.engine.dispatch(byClass(page, "ask"), { type: "tap" });
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(page.engine.texts()).toContain("Tripled 6");
		} finally {
			page.dispose();
		}
	});

	it("runs a library's main-thread function that only a rune module's effect calls, from a package that has no side effects", async () => {
		const page = start(0);
		try {
			await page.settle();
			page.engine.dispatch(byClass(page, "ask-module"), { type: "tap" });
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(page.engine.texts()).toContain("Quadrupled 8");
		} finally {
			page.dispose();
		}
	});

	it("never restores a component without its styles", async () => {
		const styles = builds.map((build) =>
			JSON.stringify(JSON.parse(script(build, "tasm.json"))["css"]),
		);
		expect(styles[0]).toContain("margin-top");
		expect(styles[1]).toBe(styles[0]);
		const page = start(1);
		try {
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(page.engine.texts()).toContain("Press");
		} finally {
			page.dispose();
		}
	});
});

describe("an app built with rspeedy's CLI for development", () => {
	let app: string;
	let build: CliBuild;
	beforeAll(async () => {
		app = cliApp("rspeedy");
		build = await cliBuild({ cli: "rspeedy", cwd: app, args: ["--mode", "development"] });
	}, 180_000);
	afterAll(() => fs.rmSync(path.dirname(app), { recursive: true, force: true }));

	it("builds", () => {
		expect(build.ok, build.output).toBe(true);
		expect(build.output).not.toMatch(MESSAGE);
	});

	it("has the dev client and hot reload on the background, with the binding's calls in the client", () => {
		const background = script(build, "background.js");
		expect(background).toContain("reloadNeedsDevTool");
		expect(background).toContain("svelteLynxComponent");
		expect(script(build, "main-thread.js")).not.toContain("reloadNeedsDevTool");
	});
});
