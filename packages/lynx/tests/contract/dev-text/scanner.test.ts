// The scanner lists the text a production build must not contain. An empty or wrong list would pass
// every build test, so this pins what it finds and what it leaves out, on a source written for it.
// The scan of the binding's own sources, and the check of a built bundle, arrive with the code
// they scan.

import path from "node:path";

import { describe, expect, it } from "@rstest/core";

import { MIN_FRAGMENT, scanDevText, SHIPPED_DIRS } from "../../dev-text/scanner.ts";

const fixtures = path.resolve(import.meta.dirname, "../../fixtures/dev-text");
const texts = scanDevText([fixtures]).map(({ text }) => text);
const has = (part: string): boolean => texts.some((text) => text.includes(part));

describe("the list of development text", () => {
	it("is not empty, and every fragment is long enough", () => {
		expect(texts.length).toBeGreaterThan(5);
		for (const text of texts) expect(text.length).toBeGreaterThanOrEqual(MIN_FRAGMENT);
	});

	it("has the text of each kind of development guard", () => {
		expect(has("a development message in an if branch")).toBe(true);
		expect(has("a development message in a conditional")).toBe(true);
		expect(has("a development message after an and")).toBe(true);
		expect(has("a development message guarded by NODE_ENV")).toBe(true);
		expect(has("a development message after an early return")).toBe(true);
		expect(has("a development message after an or return")).toBe(true);
	});

	it("has the text of a function only development code calls", () => {
		expect(has("update the list ")).toBe(true);
	});

	it("does not have text that ships, or a function production code calls", () => {
		expect(has("this message ships in every build")).toBe(false);
		expect(has("this helper also runs in production builds")).toBe(false);
		expect(has("this text is used in both builds")).toBe(false);
	});

	it("does not have text that runs when a production test with another condition is false", () => {
		// `!__DEV__ && x` is false in production whenever `x` is.
		expect(has("this runs in production whenever x is false")).toBe(false);
		expect(has("this else runs in production whenever x is false")).toBe(false);
		expect(has("this right side runs in production whenever x is false")).toBe(false);
	});

	it("says where each text is", () => {
		const found = scanDevText([fixtures]).find(({ text }) => text.includes("in an if branch"));
		expect(found).toMatchObject({ file: "tests/fixtures/dev-text/guards.ts", line: 17 });
	});
});

describe("the folders scanned", () => {
	it("are the ones whose code ships in a thread's bundle", () => {
		expect(SHIPPED_DIRS).toEqual([
			"src/background",
			"src/main-thread",
			"src/first-frame",
			"src/wire",
			"src/svelte/runtime",
			"src/gesture",
			"src/host",
			"src/env",
		]);
	});

	it("find no development text yet, because they hold no code", () => {
		expect(scanDevText()).toEqual([]);
	});
});
