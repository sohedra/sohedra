// Edits against a source text: all applied together, with the map and the way back to the source.

import { describe, expect, it } from "@rstest/core";

import { applyEdits, pieceMap, pieceText } from "../../../../src/build/source-map/edits.ts";
import { decode } from "../../../../src/build/source-map/maps.ts";

const SOURCE = "<video muted>\n<text>hi</text>\n";

describe("applyEdits", () => {
	it("replaces, inserts and deletes, whatever the order the edits come in", () => {
		const { code } = applyEdits(SOURCE, [
			{ start: 7, end: 12, text: "poster" },
			{ start: 0, end: 0, text: "<!-- a -->" },
			{ start: 13, end: 14 },
		]);
		expect(code).toBe("<!-- a --><video poster><text>hi</text>\n");
	});

	it("applies edits that start in the same place in the order given", () => {
		const { code } = applyEdits("ab", [
			{ start: 1, end: 1, text: "1" },
			{ start: 1, end: 1, text: "2" },
		]);
		expect(code).toBe("a12b");
	});

	it("writes pieces: generated text and copies of the source", () => {
		const { code } = applyEdits("let a = 1;", [
			{
				start: 4,
				end: 5,
				pieces: [{ text: "(", at: 4 }, { copy: [8, 9] }, { text: ")", at: 4 }],
			},
		]);
		expect(code).toBe("let (1) = 1;");
	});

	it("gives a map from the result to the source, under the name asked for", () => {
		const edited = applyEdits(SOURCE, [{ start: 12, end: 12, text: "={true}" }]);
		const map = edited.map("A.svelte");
		expect(map.sources).toEqual(["A.svelte"]);
		expect(map.sourcesContent).toEqual([SOURCE]);
		const lines = decode(map.mappings);
		// The text after the insertion is on the source's own columns again.
		expect(lines[0]).toEqual([
			[0, 0, 0, 0],
			[12, 0, 0, 12],
			[19, 0, 0, 12],
		]);
		expect(lines[1]).toEqual([[0, 0, 1, 0]]);
	});

	it("locates an offset of the result in the source", () => {
		const edited = applyEdits("0123456789", [
			{ start: 2, end: 4, text: "abcdef" },
			{ start: 8, end: 8, text: "!!" },
		]);
		expect(edited.code).toBe("01abcdef4567!!89");
		const { locate } = edited;
		// Before the first edit, inside its text, after it, inside the second edit's text, after it.
		expect([0, 1, 2, 7, 8, 11, 12, 13, 14, 15, 16].map(locate)).toEqual([
			0, 1, 2, 2, 4, 7, 8, 8, 8, 9, 10,
		]);
	});
});

describe("pieces", () => {
	const pieces = [
		{ text: "a(", at: 4 },
		{ copy: [4, 9] as [number, number] },
		{ text: ");\n", at: 9 },
	];

	it("make text", () => {
		expect(pieceText("let abcde = 1;", pieces)).toBe("a(abcde);\n");
	});

	it("make a map into the source", () => {
		const map = pieceMap({ source: "let abcde = 1;", pieces, name: "x.ts" });
		expect(map.sources).toEqual(["x.ts"]);
		expect(decode(map.mappings)).toEqual([
			[
				[0, 0, 0, 4],
				[2, 0, 0, 4],
				[7, 0, 0, 9],
			],
			[],
		]);
	});
});
