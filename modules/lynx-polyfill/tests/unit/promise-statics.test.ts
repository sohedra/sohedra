// ES2024's `Promise.withResolvers` and ES2025's `Promise.try` on the engine's `Promise`, by core-js's
// modules: on a `Promise` that lacks them, as PrimJS's does.

import { describe, expect, it } from "@rstest/core";

import { fillPromiseStatics } from "../../src/fills/language/promise-statics.ts";
import { fillOnDevice } from "./device-built-ins.ts";

// Boundary: ES2024's and ES2025's statics, which this package's types leave out.
interface Statics {
	withResolvers<T>(): {
		promise: Promise<T>;
		resolve: (value: T) => void;
		reject: (reason: unknown) => void;
	};
	try<T>(callback: (...args: unknown[]) => T, ...args: unknown[]): Promise<T>;
}
const own = Promise as unknown as Statics;
const ownStatics = [own.withResolvers, own.try];
const filled = fillOnDevice({
	gaps: [
		[Promise, "withResolvers"],
		[Promise, "try"],
	],
	fill: fillPromiseStatics,
});
const statics = { withResolvers: filled[0], try: filled[1] } as unknown as Statics;

describe("on an engine's Promise that lacks them", () => {
	it("puts core-js's in their place", () => {
		expect(filled.map((method) => typeof method)).toEqual(["function", "function"]);
		expect(filled).not.toEqual(ownStatics);
	});
});

describe("the statics it gives", () => {
	it("withResolvers: a promise of the class it is called on, and its functions", async () => {
		const { promise, resolve } = statics.withResolvers.call(Promise) as ReturnType<
			Statics["withResolvers"]
		>;
		expect(promise).toBeInstanceOf(Promise);
		resolve(5);
		await expect(promise).resolves.toBe(5);
		class Own extends Promise<unknown> {}
		expect(statics.withResolvers.call(Own).promise).toBeInstanceOf(Own);
		expect(() => statics.withResolvers.call({})).toThrow(TypeError);
	});

	it("try: calls the function at once with the arguments, and settles with what it returns or throws", async () => {
		const order: string[] = [];
		const result = statics.try.call(
			Promise,
			(a: unknown, b: unknown) => {
				order.push("called");
				return [a, b];
			},
			1,
			2,
		);
		order.push("after");
		expect(order).toEqual(["called", "after"]);
		await expect(result).resolves.toEqual([1, 2]);
		const failure = new Error("it threw");
		await expect(
			statics.try.call(Promise, () => {
				throw failure;
			}),
		).rejects.toBe(failure);
		await expect(statics.try.call(Promise, () => Promise.resolve(3))).resolves.toBe(3);
	});
});
