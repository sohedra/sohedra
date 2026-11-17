// What the background sends the main thread: one patch at a time, `{ v, page, items }`, through
// the main thread's patch function. Its items run in order: the ops, a list cell's ops kept as
// text, a call (a UI method, a main-thread function) answered by a reply, and the background's
// reply to a main-thread function's call. A call rides in the patch, so it never overtakes the ops
// it depends on.

import { describe, expect, it } from "@rstest/core";

import {
	decodeCell,
	decodeError,
	decodePatch,
	encodeCell,
	encodeError,
	encodePatch,
	OpCode,
	PATCH_METHOD,
	PROTOCOL_VERSION,
} from "../../../src/wire/index.ts";
import type { MainThreadFunction, Op, PatchItem } from "../../../src/wire/index.ts";

const ON_TAP: MainThreadFunction = { _wkltId: "a1b2:onTap", _c: { step: 2 }, _execId: 7 };

describe("a patch", () => {
	it("is text in the params of the main thread's patch function, stamped with the version", () => {
		const items: PatchItem[] = [["ops", [[OpCode.Create, 2, "view"]]]];
		const params = encodePatch({ page: 0, items });
		expect(Object.keys(params)).toEqual(["data"]);
		expect(typeof params.data).toBe("string");
		expect(decodePatch(params)).toEqual({ v: PROTOCOL_VERSION, page: 0, items });
		expect(PATCH_METHOD).toMatch(/^[A-Za-z_$][\w$]*$/);
	});

	it("keeps its items in order, whatever their kind", () => {
		const items: PatchItem[] = [
			[
				"ops",
				[
					[OpCode.Create, 2, "view"],
					[OpCode.Insert, 1, 2, 0],
				],
			],
			["call", 1, 2, ["invoke", "boundingClientRect", {}]],
			["ops", [[OpCode.SetAttr, 2, "class", "open"]]],
			["call", 2, 0, ["run", ON_TAP, [1, "a"]]],
			["reply", 3, { ok: true, value: { x: 1 } }],
			["call", 0, 0, ["unref", [4, 5]]],
		];
		expect(decodePatch(encodePatch({ page: 1, items })).items).toEqual(items);
	});

	it("carries a main-thread function's call as an item, with the function and its arguments", () => {
		const { items } = decodePatch(
			encodePatch({ page: 0, items: [["call", 9, 0, ["run", ON_TAP, [{ y: 3 }]]]] }),
		);
		expect(items).toEqual([["call", 9, 0, ["run", ON_TAP, [{ y: 3 }]]]]);
	});

	it("carries a call that wants no answer with the id 0", () => {
		const { items } = decodePatch(
			encodePatch({ page: 0, items: [["call", 0, 3, ["style", { color: "red", width: null }]]] }),
		);
		expect(items[0]).toEqual(["call", 0, 3, ["style", { color: "red", width: null }]]);
	});

	it("carries the background's reply to a main-thread function, a value or a thrown error", () => {
		const thrown = encodeError(new RangeError("too far"));
		const { items } = decodePatch(
			encodePatch({
				page: 0,
				items: [
					["reply", 1, { ok: true, value: [1, 2] }],
					["reply", 2, { ok: false, error: thrown }],
				],
			}),
		);
		expect(items).toEqual([
			["reply", 1, { ok: true, value: [1, 2] }],
			["reply", 2, { ok: false, error: thrown }],
		]);
	});
});

describe("a list cell's ops", () => {
	it("go as text inside the patch, and come back as the same ops", () => {
		const ops: Op[] = [
			[OpCode.Create, 10, "list-item"],
			[OpCode.SetAttr, 10, "item-key", "a"],
			[OpCode.CreateText, 11, "A"],
			[OpCode.Insert, 10, 11, 0],
		];
		const cell = encodeCell(ops);
		expect(typeof cell).toBe("string");
		const { items } = decodePatch(encodePatch({ page: 0, items: [["cell", 10, cell]] }));
		expect(items).toEqual([["cell", 10, cell]]);
		expect(decodeCell(cell)).toEqual(ops);
	});
});

describe("a thrown error", () => {
	it("keeps an error's name, message and stack", () => {
		const error = new TypeError("x is not a function");
		const sent = encodeError(error);
		expect(sent).toEqual({ name: "TypeError", message: "x is not a function", stack: error.stack });
		const received = decodeError(JSON.parse(JSON.stringify(sent)));
		expect(received).toBeInstanceOf(Error);
		expect(received.name).toBe("TypeError");
		expect(received.message).toBe("x is not a function");
		expect(received.stack).toBe(error.stack);
	});

	it("writes a thrown value that is not an error as the message of one", () => {
		expect(encodeError("no")).toEqual({ name: "Error", message: "no" });
		expect(encodeError(undefined)).toEqual({ name: "Error", message: "undefined" });
		expect(encodeError({ name: 3, message: "half an error" })).toEqual({
			name: "Error",
			message: "[object Object]",
		});
	});

	it("comes back without a stack when it had none", () => {
		const received = decodeError({ name: "Error", message: "no" });
		expect(received.message).toBe("no");
		expect(received.name).toBe("Error");
	});
});
