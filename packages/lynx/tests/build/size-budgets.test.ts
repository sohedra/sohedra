// The size of each thread's script, in bytes of a production build of its own entry, against a
// budget: the measured size and 2% more, rounded to the nearest hundred. A build of one entry, as an
// app's is: in a build of several, a module more than one entry uses is not concatenated into its
// entry's scope, which makes it larger. Growth here usually means code reaching a thread that does
// not run it, so raising a budget is a deliberate change, explained in its pull request.
//
// The same builds hold none of the text only a development build shows (tests/dev-text), except a
// page's background script: many of its modules stay apart there, unconcatenated, so their reads of
// `DEV` are not folded and what they guard ships.

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import { scanDevText } from "../dev-text/scanner.ts";
import { buildApp, cleanBuild, scriptsOf } from "./build-app.ts";
import type { AppBuild } from "./build-app.ts";

/** The bytes of `text`, as the engine reads the file. */
const bytes = (text: string): number => Buffer.byteLength(text, "utf8");

let runtime: AppBuild;
let page: AppBuild;

beforeAll(async () => {
	// No page: what each thread's script holds is the binding's runtime alone.
	runtime = await buildApp("minimal", { entry: "./runtime.ts" });
	page = await buildApp("minimal");
}, 180_000);
afterAll(() => {
	cleanBuild(runtime);
	cleanBuild(page);
});

describe("the size of a thread's script", () => {
	it("builds", () => {
		for (const build of [runtime, page]) {
			expect(build.error + build.messages).toBe("");
			expect(build.ok).toBe(true);
		}
	});

	it("is within budget for the main thread's runtime: an entry with no page (86,079 bytes measured)", () => {
		expect(bytes(scriptsOf(runtime).mainThread)).toBeLessThanOrEqual(87_800);
	});

	it("is within budget for the background's runtime: an entry with no page (22,238 bytes measured)", () => {
		expect(bytes(scriptsOf(runtime).background)).toBeLessThanOrEqual(22_700);
	});

	it("is within budget for a minimal page's main thread, with its first frame (103,040 bytes measured)", () => {
		expect(bytes(scriptsOf(page).mainThread)).toBeLessThanOrEqual(105_100);
	});

	it("is within budget for a minimal page's background: Svelte, the renderer and the page (115,678 bytes measured)", () => {
		expect(bytes(scriptsOf(page).background)).toBeLessThanOrEqual(118_000);
	});
});

describe("a production build of a thread's script", () => {
	/** The fragments of development text in `script`, with where each is written. */
	const developmentText = (script: string): string[] =>
		scanDevText()
			.filter(({ text }) => script.includes(text))
			.map(({ text, file, line }) => `${file}:${line} ${text}`);

	it("holds no text only a development build shows: the runtime's, on both threads", () => {
		expect(developmentText(scriptsOf(runtime).mainThread)).toEqual([]);
		expect(developmentText(scriptsOf(runtime).background)).toEqual([]);
	});

	it("holds no text only a development build shows: a page's main thread", () => {
		expect(developmentText(scriptsOf(page).mainThread)).toEqual([]);
	});
});
