// The playground, built as an app builds: through rspeedy's own CLI, in its own folder, with the
// binding as a dependency. One build serves every test in this file.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import { PATCH_METHOD } from "../../src/wire/index.ts";
import { lock } from "./build-app.ts";
import { startDevicePage } from "./device-threads.ts";

const PLAYGROUND = path.resolve(import.meta.dirname, "../../../../playgrounds/lynx");
const DIST = path.join(PLAYGROUND, "dist");

let status: number | null = null;
let output = "";
const read = (file: string): string => fs.readFileSync(path.join(DIST, file), "latin1");

beforeAll(async () => {
	const require = createRequire(path.join(PLAYGROUND, "package.json"));
	const manifest = require.resolve("@lynx-js/rspeedy/package.json");
	// Boundary: the package's manifest, read for its `bin`.
	const { bin } = JSON.parse(fs.readFileSync(manifest, "utf8")) as { bin: Record<string, string> };
	const cli = path.join(path.dirname(manifest), bin["rspeedy"]!);
	fs.rmSync(DIST, { recursive: true, force: true });
	const release = await lock();
	try {
		// `DEBUG=lynx` keeps each thread's script in `dist/.lynx/<entry>/`.
		const run = spawnSync(process.execPath, [cli, "build"], {
			cwd: PLAYGROUND,
			env: { ...process.env, DEBUG: "lynx", NODE_ENV: "production" },
			encoding: "utf8",
			timeout: 170_000,
		});
		status = run.status;
		output = `${run.stdout}\n${run.stderr}`;
	} finally {
		release();
	}
}, 180_000);
afterAll(() => fs.rmSync(DIST, { recursive: true, force: true }));

describe("the playground, built with rspeedy's CLI", () => {
	it("builds", () => {
		expect(status, output).toBe(0);
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
			fs.readFileSync(path.join(DIST, ".lynx/main", thread), "utf8");
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
