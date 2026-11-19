// The playground, built as an app builds: through rspeedy's own CLI, in its own folder, with the
// binding as a dependency. One build serves every test in this file.

import fs from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import { PATCH_METHOD } from "../../src/wire/index.ts";
import { cliBuild } from "./cli-build.ts";
import type { CliBuild } from "./cli-build.ts";
import { startDevicePage } from "./device-threads.ts";

const PLAYGROUND = path.resolve(import.meta.dirname, "../../../../playgrounds/lynx");

let build: CliBuild;
const read = (file: string): string => fs.readFileSync(path.join(build.dist, file), "latin1");

beforeAll(async () => {
	build = await cliBuild({ cli: "rspeedy", cwd: PLAYGROUND });
}, 180_000);
afterAll(() => fs.rmSync(build.dist, { recursive: true, force: true }));

describe("the playground, built with rspeedy's CLI", () => {
	it("builds", () => {
		expect(build.ok, build.output).toBe(true);
	});

	it("is one bundle that holds both threads' scripts and the page", () => {
		const bundle = read("main.lynx.bundle");
		expect(bundle).toContain("Svelte on Lynx");
		expect(bundle).toContain(PATCH_METHOD);
	});

	it("gives the main thread the runtime that applies the background's patches", () => {
		const script = read(".lynx/main/main-thread.js");
		expect(script).toContain(PATCH_METHOD);
		expect(script).toContain("__RenderPage");
	});

	it("gives the background the page: its component, its renderer and the start", () => {
		const script = read(".lynx/main/background.js");
		expect(script).toContain("Svelte on Lynx");
		expect(script).toContain("Reverse the list");
		expect(script).toContain("callDestroyLifetimeFun");
		expect(script).not.toContain("__RenderPage");
	});

	it("reverses its list on a tap, on threads shaped like a device's", async () => {
		const script = (thread: string) =>
			fs.readFileSync(path.join(build.dist, ".lynx/main", thread), "utf8");
		const { page } = startDevicePage({
			mainThread: script("main-thread.js"),
			background: script("background.js"),
		});
		try {
			await page.settle();
			const buttons = page.engine
				.all()
				.filter((element) => page.engine.state(element).classes.split(" ").includes("button"));
			page.engine.dispatch(buttons[1]!, { type: "tap" });
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(page.engine.texts().slice(-3)).toEqual(["Cherry", "Banana", "Apple"]);
		} finally {
			page.dispose();
		}
	});
});
