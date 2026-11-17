// Lynx's main-thread engine rejects a `/u` regex with an astral escape when it makes bytecode,
// even when the code never runs it. Two of Svelte's regexes are that, and the build rewrites them.

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";
import * as acorn from "acorn";

import {
	isPrimjsRegexFile,
	PRIMJS_REGEX_REWRITES,
	rewritePrimjsRegex,
} from "../../../../src/svelte/build/index.ts";

const require = createRequire(import.meta.url);
const svelteRoot = path.dirname(require.resolve("svelte/package.json"));

/** The `/u` regex literals of `code`, which PrimJS refuses. */
function unicodeRegexes(code: string): string[] {
	const found: string[] = [];
	acorn.parse(code, {
		ecmaVersion: "latest",
		sourceType: "module",
		onToken(token) {
			const value = (token as { value?: { flags?: string; pattern?: string } }).value;
			if (token.type.label === "regexp" && value?.flags?.includes("u"))
				found.push(value.pattern ?? "");
		},
	});
	return found;
}

describe("the regexes PrimJS rejects", () => {
	for (const rewrite of PRIMJS_REGEX_REWRITES) {
		const file = path.join(svelteRoot, "src", rewrite.file);

		it(`${rewrite.name} is in ${rewrite.file} and has the /u form`, () => {
			expect(unicodeRegexes(fs.readFileSync(file, "utf8")).length).toBeGreaterThan(0);
		});

		it(`${rewrite.name} is rewritten, and the file has no /u regex left`, () => {
			const source = fs.readFileSync(file, "utf8");
			const result = rewritePrimjsRegex(source, file);
			if (typeof result !== "string") throw new Error("the rewrite did not apply");
			expect(unicodeRegexes(result)).toEqual([]);
			expect(result).not.toBe(source);
		});

		it(`${rewrite.name} is reported when Svelte's declaration has moved`, () => {
			const source = fs.readFileSync(file, "utf8").replace(rewrite.name, "RENAMED");
			expect(rewritePrimjsRegex(source, file)).toEqual({ missing: rewrite.name });
		});
	}

	it("leaves every other file alone, and says it is not one of them", () => {
		expect(rewritePrimjsRegex("const a = 1;", "/app/src/other.js")).toBeUndefined();
	});

	it("rewrites the tag-name regex to ASCII letters, digits and the dash set", () => {
		const file = path.join(svelteRoot, "src/utils.js");
		const result = rewritePrimjsRegex(fs.readFileSync(file, "utf8"), file);
		expect(result).toMatch(
			/REGEX_VALID_TAG_NAME =\s*\/\^\[a-zA-Z\]\[a-zA-Z0-9\]\*\(-\[a-zA-Z0-9\._-\]\*\)\?\$\/;/,
		);
	});
});

describe("isPrimjsRegexFile", () => {
	const [first] = PRIMJS_REGEX_REWRITES;

	it("takes the file of Svelte's `src` folder the rewrite is for, with either separator", () => {
		expect(isPrimjsRegexFile("/app/node_modules/svelte/src/utils.js", "utils.js")).toBe(true);
		expect(isPrimjsRegexFile("C:\\app\\node_modules\\svelte\\src\\utils.js", "utils.js")).toBe(
			true,
		);
		expect(first?.file).toBe("utils.js");
	});

	it("takes no other file: a longer folder name, another file, a file of another folder", () => {
		expect(isPrimjsRegexFile("/app/node_modules/my-svelte/src/utils.js", "utils.js")).toBe(false);
		expect(isPrimjsRegexFile("/app/node_modules/svelte/src/other.js", "utils.js")).toBe(false);
		expect(isPrimjsRegexFile("/app/node_modules/svelte/src/internal/utils.js", "utils.js")).toBe(
			false,
		);
		expect(isPrimjsRegexFile("/app/node_modules/svelte/src/utilsXjs", "utils.js")).toBe(false);
	});
});
