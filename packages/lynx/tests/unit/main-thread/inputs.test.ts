// The numbered `input` events of a page's fields: a write that answers an older event than the
// field's latest is stale, and the echo of a write is not typing.

import { describe, expect, it } from "@rstest/core";

import { createInputNumbers, inputValue } from "../../../src/main-thread/inputs.ts";

describe("a field's input events", () => {
	it("are numbered in order, and a write answering an older one is stale", () => {
		const inputs = createInputNumbers();
		const field = {};
		expect(inputs.heard(field, "a")).toBe(1);
		expect(inputs.heard(field, "ab")).toBe(2);
		expect(inputs.stale(field, 1)).toBe(true);
		expect(inputs.stale(field, 2)).toBe(false);
		// A field that never sent one takes any write.
		expect(inputs.stale({}, 0)).toBe(false);
	});

	it("keep their number for the echo of a write, and count the next typing", () => {
		const inputs = createInputNumbers();
		const field = {};
		inputs.heard(field, "a");
		inputs.wrote(field, "A");
		expect(inputs.heard(field, "A")).toBe(1);
		expect(inputs.stale(field, 1)).toBe(false);
		expect(inputs.heard(field, "Ab")).toBe(2);
		// An event that is not the write's echo is typing, and the echo is not waited for after it.
		inputs.wrote(field, "AB");
		expect(inputs.heard(field, "ABc")).toBe(3);
		expect(inputs.heard(field, "AB")).toBe(4);
	});

	it("start again once the page forgets the field", () => {
		const inputs = createInputNumbers();
		const field = {};
		inputs.heard(field, "a");
		inputs.forget(field);
		expect(inputs.stale(field, 0)).toBe(false);
		expect(inputValue({ detail: { value: "x" } })).toBe("x");
		expect(inputValue(null)).toBeUndefined();
	});
});
