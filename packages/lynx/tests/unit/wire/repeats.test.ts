// An error that repeats is reported the first time and at each power of ten, with its count on its
// first line, until it has been quiet for five seconds: then it is reported as new.

import { afterEach, describe, expect, it, rs } from "@rstest/core";

import { createRepeats, withCount } from "../../../src/wire/index.ts";

/** One error thrown from one place, as each repeat of it is. */
const thrown = (message: string): Error => {
	const error = new Error(message);
	error.stack = `Error: ${message}\n    at onTap (src/App.svelte:4:9)\n    at run (runtime.js:1:1)`;
	return error;
};

afterEach(() => {
	rs.restoreAllMocks();
});

/** The thread's clock, moved by the test: `Date.now`, in milliseconds. */
function clock(): { pass(milliseconds: number): void } {
	let now = 1_000_000;
	rs.spyOn(Date, "now").mockImplementation(() => now);
	return {
		pass(milliseconds) {
			now += milliseconds;
		},
	};
}

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

	it("counts apart two callers of one helper, whose stacks differ below its frame", () => {
		const repeats = createRepeats();
		const fromSave = thrown("not allowed");
		fromSave.stack =
			"Error: not allowed\n    at fail (src/fail.ts:2:9)\n    at onSave (src/App.svelte:4:3)";
		const fromSend = thrown("not allowed");
		fromSend.stack =
			"Error: not allowed\n    at fail (src/fail.ts:2:9)\n    at onSend (src/App.svelte:9:3)";
		expect(repeats.count(fromSave)).toBe(1);
		expect(repeats.count(fromSend)).toBe(1);
	});

	it("counts an error whose fields are not text, and throws nothing", () => {
		const repeats = createRepeats();
		const odd = Object.assign(new Error("odd"), { stack: 42 as unknown as string });
		expect(repeats.count(odd)).toBe(1);
		expect(repeats.count(odd)).toBeUndefined();
		const counted = withCount(
			Object.assign(new Error("x"), { message: 7 as unknown as string }),
			10,
		);
		expect(counted.message).toBe("7 (×10)");
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

describe("createRepeats over time", () => {
	it("still counts a repeat that comes within five seconds of the last", () => {
		const time = clock();
		const repeats = createRepeats();
		expect(repeats.count(thrown("the tap failed"))).toBe(1);
		time.pass(4999);
		expect(repeats.count(thrown("the tap failed"))).toBeUndefined();
	});

	it("reports an error as new once it has been quiet for five seconds", () => {
		const time = clock();
		const repeats = createRepeats();
		for (let tap = 0; tap < 5; tap++) repeats.count(thrown("the tap failed"));
		time.pass(5000);
		expect(repeats.count(thrown("the tap failed"))).toBe(1);
		const reported: number[] = [];
		for (let tap = 1; tap < 10; tap++) {
			const count = repeats.count(thrown("the tap failed"));
			if (count !== undefined) reported.push(count);
		}
		expect(reported).toEqual([10]);
	});

	it("keeps counting an error that never goes quiet, however long it lasts", () => {
		const time = clock();
		const repeats = createRepeats();
		const reported: number[] = [];
		for (let frame = 1; frame <= 100; frame++) {
			const count = repeats.count(thrown("the frame failed"));
			if (count !== undefined) reported.push(count);
			time.pass(1000);
		}
		expect(reported).toEqual([1, 10, 100]);
	});

	it("times each error on its own", () => {
		const time = clock();
		const repeats = createRepeats();
		repeats.count(thrown("one"));
		time.pass(3000);
		repeats.count(thrown("two"));
		time.pass(3000);
		expect(repeats.count(thrown("one"))).toBe(1);
		expect(repeats.count(thrown("two"))).toBeUndefined();
	});
});

describe("withCount", () => {
	it("is the error itself the first time", () => {
		const error = thrown("one");
		expect(withCount(error, 1)).toBe(error);
	});

	it("ends the first line with the count, keeping the rest, the name, the stack, the code and the cause", () => {
		const error = Object.assign(new TypeError("A value failed.\nWhere it failed."), {
			code: "value_failed",
			cause: { status: 500 },
		});
		const counted = withCount(error, 10) as TypeError & { code?: string };
		expect(counted.message).toBe("A value failed. (×10)\nWhere it failed.");
		expect(counted.name).toBe("TypeError");
		expect(counted.stack).toBe(error.stack);
		expect(counted.code).toBe("value_failed");
		expect(counted.cause).toEqual({ status: 500 });
		expect(error.message).toBe("A value failed.\nWhere it failed.");
	});
});
