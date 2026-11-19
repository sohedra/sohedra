// An error that repeats is reported the first time and at each power of ten, with its count on its
// first line.

import { describe, expect, it } from "@rstest/core";

import { createRepeats, withCount } from "../../../src/wire/index.ts";

/** One error thrown from one place, as each repeat of it is. */
const thrown = (message: string): Error => {
	const error = new Error(message);
	error.stack = `Error: ${message}\n    at onTap (src/App.svelte:4:9)\n    at run (runtime.js:1:1)`;
	return error;
};

describe("createRepeats", () => {
	it("reports the 1st, 10th, 100th and 1000th of one error, and counts the rest", () => {
		const repeats = createRepeats();
		const reported: number[] = [];
		for (let time = 1; time <= 1000; time++) {
			const count = repeats.count(thrown("the tap failed"));
			if (count !== undefined) reported.push(count);
		}
		expect(reported).toEqual([1, 10, 100, 1000]);
	});

	it("counts errors apart by their message and by the place they were thrown", () => {
		const repeats = createRepeats();
		expect(repeats.count(thrown("one"))).toBe(1);
		expect(repeats.count(thrown("two"))).toBe(1);
		const elsewhere = thrown("one");
		elsewhere.stack = "Error: one\n    at onScroll (src/List.svelte:9:3)";
		expect(repeats.count(elsewhere)).toBe(1);
		expect(repeats.count(thrown("one"))).toBeUndefined();
	});

	it("counts from none again once cleared", () => {
		const repeats = createRepeats();
		repeats.count(thrown("one"));
		repeats.clear();
		expect(repeats.count(thrown("one"))).toBe(1);
	});

	it("keeps a bounded number of errors: past it, it counts from none", () => {
		const repeats = createRepeats();
		for (let error = 0; error < 100; error++) repeats.count(thrown(`error ${error}`));
		expect(repeats.count(thrown("error 0"))).toBeUndefined();
		expect(repeats.count(thrown("one more"))).toBe(1);
		expect(repeats.count(thrown("error 0"))).toBe(1);
	});
});

describe("withCount", () => {
	it("is the error itself the first time", () => {
		const error = thrown("one");
		expect(withCount(error, 1)).toBe(error);
	});

	it("ends the first line with the count, keeping the rest, the name, the stack and the code", () => {
		const error = Object.assign(new TypeError("A value failed.\nWhere it failed."), {
			code: "value_failed",
		});
		const counted = withCount(error, 10) as TypeError & { code?: string };
		expect(counted.message).toBe("A value failed. (×10)\nWhere it failed.");
		expect(counted.name).toBe("TypeError");
		expect(counted.stack).toBe(error.stack);
		expect(counted.code).toBe("value_failed");
		expect(error.message).toBe("A value failed.\nWhere it failed.");
	});
});
