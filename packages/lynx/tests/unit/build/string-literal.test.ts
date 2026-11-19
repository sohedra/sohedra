// Source-derived text written into generated JavaScript.

import vm from "node:vm";

import { describe, expect, it } from "@rstest/core";

import { escapeRegExp, stringLiteral } from "../../../src/build/string-literal.ts";

describe("stringLiteral", () => {
	it("is a literal that reads back as the text", () => {
		for (const text of [
			"",
			"plain",
			'a "quoted" \\ word',
			"line\nbreak",
			"  ",
			"</script>",
			"a > b < c",
		]) {
			expect(vm.runInNewContext(stringLiteral(text))).toBe(text);
		}
	});

	it("writes `<`, `>` and the line and paragraph separators as escapes, which JSON.stringify leaves raw", () => {
		const literal = stringLiteral("<a>  ");
		expect(literal).toBe('"\\u003ca\\u003e\\u2028\\u2029"');
		expect(literal).not.toMatch(new RegExp("[<>\\u2028\\u2029]"));
	});
});

describe("escapeRegExp", () => {
	it("makes a pattern that matches the text and nothing else, for every character with a meaning", () => {
		for (const text of ["a.b", "a+b", "(a|b)", "[a]", "{1}", "^a$", "a\\b", "a*?", "-/"]) {
			const pattern = new RegExp(`^${escapeRegExp(text)}$`);
			expect(pattern.test(text), text).toBe(true);
		}
		expect(new RegExp(`^${escapeRegExp("a.b")}$`).test("axb")).toBe(false);
		expect(new RegExp(`^${escapeRegExp("a\\b")}$`).test("a\\b")).toBe(true);
	});

	it("escapes the backslash itself, which a partial escape leaves", () => {
		expect(escapeRegExp("\\.")).toBe("\\\\\\.");
	});
});
