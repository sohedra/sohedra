// What the background sends the main thread: one patch at a time, `{ v, page, items }`, through
// the main thread's patch function. Its items run in order: the ops, a list cell's ops kept as
// text, a call (a UI method, a main-thread function) answered by a reply, and the background's
// reply to a main-thread function's call. A call rides in the patch, so it never overtakes the ops
// it depends on. A call and a reply are written as text when they are made, so a value that cannot
// cross fails there, at the developer's line, and never takes a patch down with it.

import { describe, expect, it } from "@rstest/core";

import {
	decodeCall,
	decodeCell,
	decodeError,
	decodePatch,
	decodeResult,
	encodeCall,
	encodeCell,
	encodeError,
	encodePatch,
	encodeResult,
	OpCode,
	PATCH_METHOD,
	PROTOCOL_VERSION,
	wireError,
} from "../../../src/wire/index.ts";
import type {
	CallRequest,
	MainThreadFunction,
	Op,
	PatchItem,
	Result,
} from "../../../src/wire/index.ts";

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

	it("says when it shows the page's new data, and only then", () => {
		expect(decodePatch(encodePatch({ page: 2, items: [], dataUpdated: true }))).toEqual({
			v: PROTOCOL_VERSION,
			page: 2,
			items: [],
			dataUpdated: true,
		});
		expect(
			"dataUpdated" in decodePatch(encodePatch({ page: 2, items: [], dataUpdated: false })),
		).toBe(false);
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
			["call", 1, 2, encodeCall(["invoke", "boundingClientRect", {}])],
			["ops", [[OpCode.SetAttr, 2, "class", "open"]]],
			["call", 2, 0, encodeCall(["run", ON_TAP, [1, "a"]])],
			["reply", 3, encodeResult({ ok: true, value: { x: 1 } })],
			["call", 0, 0, encodeCall(["unref", [4, 5]])],
		];
		expect(decodePatch(encodePatch({ page: 1, items })).items).toEqual(items);
	});

	it("carries a main-thread function's call as an item, with the function and its arguments", () => {
		const request: CallRequest = ["run", ON_TAP, [{ y: 3 }]];
		const { items } = decodePatch(
			encodePatch({ page: 0, items: [["call", 9, 0, encodeCall(request)]] }),
		);
		const [kind, id, element, text] = items[0] as ["call", number, number, string];
		expect([kind, id, element]).toEqual(["call", 9, 0]);
		expect(decodeCall(text)).toEqual(request);
	});

	it("carries a call that wants no answer with the id 0", () => {
		const request: CallRequest = ["style", { color: "red", width: null }];
		const { items } = decodePatch(
			encodePatch({ page: 0, items: [["call", 0, 3, encodeCall(request)]] }),
		);
		expect(items[0]).toEqual(["call", 0, 3, encodeCall(request)]);
	});

	it("carries the background's reply to a main-thread function, a value or a thrown error", () => {
		const results: Result[] = [
			{ ok: true, value: [1, 2] },
			{ ok: false, error: encodeError(new RangeError("too far")) },
		];
		const { items } = decodePatch(
			encodePatch({
				page: 0,
				items: results.map((result, index): PatchItem => ["reply", index, encodeResult(result)]),
			}),
		);
		expect(items.map((item) => decodeResult(item[2] as string))).toEqual(results);
	});

	it("does not prepare a lazy bundle, which belongs to the view and not to a page", () => {
		// @ts-expect-error: a lazy bundle is prepared through its own method, not a call of the patch
		const request: CallRequest = ["lazy-bundle", "https://example.com/Heavy.lynx.bundle"];
		expect(request).toHaveLength(2);
	});
});

describe("a value a call or a reply carries", () => {
	it("fails when the call is made if it cannot cross, naming the thread", () => {
		const cycle: Record<string, unknown> = {};
		cycle["self"] = cycle;
		for (const value of [10n, cycle]) {
			let thrown: (Error & { code?: string }) | undefined;
			try {
				encodeCall(["run", ON_TAP, [value]]);
			} catch (error) {
				thrown = error as Error & { code?: string };
			}
			expect(thrown?.code).toBe("value_not_copyable");
			expect(thrown?.message).toMatch(/^A value sent to the main thread cannot be copied/);
		}
		expect(() => encodeResult({ ok: true, value: 1n })).toThrow(
			/^A value sent to the main thread cannot be copied/,
		);
	});

	it("crosses as JSON does: undefined, NaN and Infinity in a list become null", () => {
		const text = encodeCall([
			"run",
			ON_TAP,
			[undefined, Number.NaN, Infinity, -0, { a: undefined }],
		]);
		expect(decodeCall(text)).toEqual(["run", ON_TAP, [null, null, null, 0, {}]]);
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

	it("keeps an error's code, the wire's own included", () => {
		const error = wireError({
			code: "threads_from_different_builds",
			details: { thread: "background", received: 2, expected: 1 },
		});
		const sent = encodeError(error);
		expect(sent.code).toBe("threads_from_different_builds");
		const received = decodeError(JSON.parse(JSON.stringify(sent)));
		expect(received.code).toBe("threads_from_different_builds");
		expect(received.message).toBe(error.message);
		expect(encodeError(Object.assign(new Error("gone"), { code: 404 })).code).toBeUndefined();
	});

	it("writes a thrown value that is not an error as the message of one", () => {
		expect(encodeError("no")).toEqual({ name: "Error", message: "no" });
		expect(encodeError(undefined)).toEqual({ name: "Error", message: "undefined" });
		expect(encodeError({ reason: "canceled", code: "aborted" })).toEqual({
			name: "Error",
			message: '{"reason":"canceled","code":"aborted"}',
			code: "aborted",
		});
	});

	it("never throws over the value it writes", () => {
		const bare = Object.create(null) as object;
		expect(encodeError(bare)).toEqual({ name: "Error", message: "{}" });
		const unshowable = {
			toJSON() {
				throw new Error("no JSON");
			},
			toString() {
				throw new Error("no text");
			},
		};
		expect(encodeError(unshowable)).toEqual({
			name: "Error",
			message: "A value was thrown that cannot be shown.",
		});
	});

	it("comes back without a stack when it had none", () => {
		const received = decodeError({ name: "Error", message: "no" });
		expect(received.message).toBe("no");
		expect(received.name).toBe("Error");
		expect(received.code).toBeUndefined();
	});
});
