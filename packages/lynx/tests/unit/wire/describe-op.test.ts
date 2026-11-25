// The phrase that names an op in a development build's error, with or without the tags.

import { describe, expect, it } from "@rstest/core";

import { describeOp, OpCode } from "../../../src/wire/index.ts";
import type { Op } from "../../../src/wire/index.ts";

const TAGS: Record<number, string> = { 7: "scroll-view", 42: "view" };

describe("describeOp", () => {
	it.each<[Op, string, string]>([
		[[OpCode.Create, 42, "view"], "create <view> 42", "create <view> 42"],
		[[OpCode.CreateText, 43, "hi"], "create the text 43", "create the text 43"],
		[[OpCode.SetText, 43, "hi"], "set the text of element 43", "set the text of element 43"],
		[[OpCode.SetAttr, 42, "class", "a"], 'set "class" on element 42', 'set "class" on <view> 42'],
		[
			[OpCode.Insert, 7, 42, 0],
			"insert element 42 into element 7",
			"insert <view> 42 into <scroll-view> 7",
		],
		[
			[OpCode.Insert, 7, 42, 9],
			"insert element 42 into element 7 before element 9",
			"insert <view> 42 into <scroll-view> 7 before element 9",
		],
		[
			[OpCode.Remove, 7, 42],
			"remove element 42 from element 7",
			"remove <view> 42 from <scroll-view> 7",
		],
		[
			[OpCode.SetEvent, 42, "bindEvent", "tap", 3],
			'set the "tap" event of element 42',
			'set the "tap" event of <view> 42',
		],
		[
			[OpCode.SetEvent, 42, "bindEvent", "tap", 0],
			'remove the "tap" event of element 42',
			'remove the "tap" event of <view> 42',
		],
		[[OpCode.Release, 42], "release element 42", "release <view> 42"],
		[
			[OpCode.SetStyles, 42, { color: "red" }],
			"set styles from code on element 42",
			"set styles from code on <view> 42",
		],
		[[OpCode.Animate, 42, [1, "fade"]], "animate element 42", "animate <view> 42"],
		[[OpCode.Branch, 42, 0, 1, 0], "mark a block in element 42", "mark a block in <view> 42"],
		[
			[OpCode.ListUpdate, 7, { insertAction: [], removeAction: [], updateAction: [] }, [], [], []],
			"update the list element 7",
			"update the list <scroll-view> 7",
		],
	])("%j is %s, and with tags %s", (op, plain, tagged) => {
		expect(describeOp(op)).toBe(plain);
		expect(describeOp(op, (id) => TAGS[id])).toBe(tagged);
	});

	it("names the kind of an op this build does not know", () => {
		// Boundary: a kind no reader has, as another build could send it.
		expect(describeOp([99, 42] as unknown as Op)).toBe("apply a change of unknown kind 99");
	});
});
