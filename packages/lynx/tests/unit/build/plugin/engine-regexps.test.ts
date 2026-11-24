// The regular expressions Lynx's engine refuses: PrimJS fails to parse the whole script for one
// written as a literal, and throws where one made with `RegExp` runs. The build finds them in each
// module as the loaders left it (after SWC, which keeps them or turns a `v` literal into a call).

import path from "node:path";

import { describe, expect, it } from "@rstest/core";

import { refusedRegExps } from "../../../../src/build/plugin/engine-regexps.ts";
import { scriptParser } from "../../../../src/svelte/build/index.ts";

const parse = scriptParser(path.resolve(import.meta.dirname, "../../../.."));

/** What is refused in `code`, as `[text, syntax]` pairs. */
const found = (code: string) =>
	refusedRegExps(code, parse).map(({ text, syntax }) => [text, syntax]);

describe("the regular expressions the engine refuses", () => {
	it("are those with the v or d flag, written as literals", () => {
		expect(found("const a = /[\\p{L}--[a-z]]/v; const b = /x/dg; const c = /x/giu;")).toEqual([
			["/[\\p{L}--[a-z]]/v", "v_flag"],
			["/x/dg", "d_flag"],
		]);
	});

	it("are those made with RegExp and a flag it refuses, as SWC writes a v literal", () => {
		expect(
			found(
				'const a = RegExp("[\\\\p{L}--[a-z]]", "v"); const b = new RegExp(x, "dg"); RegExp("a", "g");',
			),
		).toEqual([
			['RegExp("[\\\\p{L}--[a-z]]", "v")', "v_flag"],
			['new RegExp(x, "dg")', "d_flag"],
		]);
	});

	it("are those with a modifier, and not a group that only groups or looks around", () => {
		expect(
			found("/(?i:a)b/; /(?-m:^a)/; /(?im-s:a)/; /(?:a)/; /(?=a)(?!b)(?<=c)(?<!d)/; /\\(?i:a\\)/"),
		).toEqual([
			["/(?i:a)b/", "modifier"],
			["/(?-m:^a)/", "modifier"],
			["/(?im-s:a)/", "modifier"],
		]);
	});

	it("are those that name two groups alike, and not one with distinct names", () => {
		expect(found("/(?<y>a)|(?<y>b)/; /(?<y>a)(?<z>b)/; /[(?<y>](?<y>a)/")).toEqual([
			["/(?<y>a)|(?<y>b)/", "duplicate_group"],
		]);
		expect(found('new RegExp("(?<y>a)|(?<y>b)")')).toEqual([
			['new RegExp("(?<y>a)|(?<y>b)")', "duplicate_group"],
		]);
	});

	it("say which are calls, which throw only where they run", () => {
		expect(refusedRegExps('/x/v; new RegExp("x", "v");', parse).map(({ call }) => call)).toEqual([
			false,
			true,
		]);
	});

	it("give where each starts in the code", () => {
		const code = "let a = 1;\nconst b = /x/v;";
		expect(refusedRegExps(code, parse).map(({ start }) => start)).toEqual([code.indexOf("/x/v")]);
	});

	it("are none in code without them, or that does not parse", () => {
		expect(found("const a = b / c / d; const e = '/x/v'; // /x/v")).toEqual([]);
		expect(found("const = ;")).toEqual([]);
	});
});
