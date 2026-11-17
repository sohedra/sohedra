// The source-map helpers: decoding, composing two maps, and building a map for assembled code.

import { describe, expect, it } from "@rstest/core";

import {
	appendMap,
	compose,
	decode,
	encode,
	MapBuilder,
	position,
} from "../../../../src/build/source-map/maps.ts";
import type { Segment, SourceMap } from "../../../../src/build/source-map/maps.ts";

const map = (lines: Segment[][], source = "a.ts"): SourceMap => ({
	version: 3,
	sources: [source],
	mappings: encode(lines),
});

describe("encode and decode", () => {
	it("round-trip, including negative deltas and empty lines", () => {
		const lines: Segment[][] = [
			[
				[0, 0, 5, 3],
				[10, 0, 2, 0],
			],
			[],
			[[4, 0, 40, 100]],
		];
		expect(decode(encode(lines))).toEqual(lines);
	});

	it("read a map written by another tool", () => {
		// "AAAA;AACA" is line 0 column 0 to 0:0, and line 1 column 0 to 1:0.
		expect(decode("AAAA;AACA")).toEqual([[[0, 0, 0, 0]], [[0, 0, 1, 0]]]);
	});

	it("skip a segment that has no source", () => {
		expect(decode("A,AAAA")).toEqual([[[0, 0, 0, 0]]]);
	});

	it("read a segment that continues over several digits", () => {
		const lines: Segment[][] = [[[1000, 0, 2000, 3000]]];
		expect(decode(encode(lines))).toEqual(lines);
	});
});

describe("compose", () => {
	it("traces through both maps", () => {
		const outer = map([[[0, 0, 2, 0]]]); // output 0:0 to intermediate 2:0
		const inner = { ...map([[], [], [[0, 0, 7, 4]]], "original.ts"), sourcesContent: ["..."] };
		const composed = compose(outer, inner)!;
		expect(decode(composed.mappings)).toEqual([[[0, 0, 7, 4]]]);
		expect(composed.sources).toEqual(["original.ts"]);
		expect(composed.sourcesContent).toEqual(["..."]);
	});

	it("keeps the column offset inside a coarse segment", () => {
		const outer = map([[[0, 0, 0, 9]]]);
		const inner = map([[[0, 0, 3, 2]]]);
		expect(decode(compose(outer, inner)!.mappings)).toEqual([[[0, 0, 3, 11]]]);
	});

	it("drops a position that the inner map does not know", () => {
		const outer = map([[[0, 0, 5, 0]]]);
		const inner = map([[[0, 0, 0, 0]]]);
		expect(decode(compose(outer, inner)!.mappings)).toEqual([[]]);
	});

	it("traces a position that starts before the inner line's first segment", () => {
		const outer = map([[[0, 0, 0, 0]]]);
		const inner = map([[[4, 0, 1, 2]]]);
		expect(decode(compose(outer, inner)!.mappings)).toEqual([[[0, 0, 1, 2]]]);
	});

	it("returns the other map when one is missing, and accepts JSON strings", () => {
		const only = map([[[0, 0, 1, 0]]]);
		expect(compose(only, undefined)).toEqual(only);
		expect(compose(undefined, only)).toEqual(only);
		const first = map([[[0, 0, 0, 0]]]);
		expect(decode(compose(JSON.stringify(first), JSON.stringify(only))!.mappings)).toEqual([
			[[0, 0, 1, 0]],
		]);
	});
});

describe("MapBuilder", () => {
	it("maps copied text to where it came from, line by line", () => {
		const builder = new MapBuilder();
		builder.copy("ab\ncd", [4, 2]);
		expect(decode(builder.toMap("x", "").mappings)).toEqual([[[0, 0, 4, 2]], [[0, 0, 5, 0]]]);
	});

	it("points generated text at the given position, on each of its lines", () => {
		const builder = new MapBuilder();
		builder.copy("xx", [0, 0]);
		builder.generated("a\nb", [3, 1]);
		expect(decode(builder.toMap("x", "").mappings)).toEqual([
			[
				[0, 0, 0, 0],
				[2, 0, 3, 1],
			],
			[[0, 0, 3, 1]],
		]);
	});

	it("leaves nothing for an empty piece", () => {
		const builder = new MapBuilder();
		builder.generated("", [3, 1]);
		builder.copy("", [0, 0]);
		expect(decode(builder.toMap("x", "").mappings)).toEqual([[]]);
	});

	it("names the file and keeps its text", () => {
		const built = new MapBuilder().toMap("A.svelte", "<view />");
		expect(built).toMatchObject({
			version: 3,
			file: "A.svelte",
			sources: ["A.svelte"],
			sourcesContent: ["<view />"],
		});
	});
});

describe("appendMap", () => {
	it("puts the map of the text that follows after the code's lines", () => {
		const base = map([[[0, 0, 4, 0]], [[0, 0, 5, 0]]]);
		// Two lines of code, the second without a newline: the extra's first line continues it.
		const extra = map([[[0, 0, 9, 9]], [[2, 0, 7, 1]]], "./a.ts");
		const result = appendMap({ code: "x\ny", map: base }, extra);
		expect(result.sources).toEqual(["a.ts"]);
		expect(decode(result.mappings)).toEqual([
			[[0, 0, 4, 0]],
			// Shifted by the length of the code's last line.
			[
				[0, 0, 5, 0],
				[1, 0, 9, 9],
			],
			[[2, 0, 7, 1]],
		]);
	});

	it("adds the lines the code does not reach", () => {
		const base = map([[[0, 0, 0, 0]]]);
		const extra = map([[[0, 0, 1, 1]], [[0, 0, 2, 2]]]);
		const result = appendMap({ code: "a\n\n\n", map: base }, extra);
		expect(decode(result.mappings)).toEqual([
			[[0, 0, 0, 0]],
			[],
			[],
			[[0, 0, 1, 1]],
			[[0, 0, 2, 2]],
		]);
	});
});

describe("position", () => {
	it("gives the 0-based line and column of an offset", () => {
		expect(position("ab\ncd\nef", 4)).toEqual([1, 1]);
		expect(position("ab", 0)).toEqual([0, 0]);
	});
});
