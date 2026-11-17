// The shape of a message: the sentence first, then where, the code frame, the fix and the link.

import { describe, expect, it } from "@rstest/core";

import { DOCS_BASE, docsLink, formatMessage } from "../../../src/wire/index.ts";

describe("formatMessage", () => {
	it("puts the sentence first and every part after it", () => {
		expect(
			formatMessage({
				sentence: "`this` cannot be used in a main-thread function.",
				where: "/app/A.svelte:3:7",
				frame: "3: return this;\n          ^",
				fix: "Read what it needs into a variable outside the function.",
				link: docsLink("main_thread_function_this"),
			}),
		).toBe(
			[
				"`this` cannot be used in a main-thread function.",
				"/app/A.svelte:3:7",
				"",
				"3: return this;\n          ^",
				"",
				"Read what it needs into a variable outside the function.",
				"https://sohedra.com/e/main_thread_function_this",
			].join("\n"),
		);
	});

	it("leaves out what a message does not have", () => {
		expect(formatMessage({ sentence: "Plain." })).toBe("Plain.");
		expect(formatMessage({ sentence: "A.", fix: "Do B.", link: "https://x" })).toBe(
			"A.\n\nDo B.\nhttps://x",
		);
		expect(formatMessage({ sentence: "A.", where: "a.ts:1:1", frame: "" })).toBe("A.\na.ts:1:1");
	});
});

describe("docsLink", () => {
	it("is the page of the code under the docs' address", () => {
		expect(docsLink("a_code")).toBe(`${DOCS_BASE}a_code`);
		expect(DOCS_BASE).toBe("https://sohedra.com/e/");
	});
});
