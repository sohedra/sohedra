// The statics on lynx-core's `Promise`, which the background's bundle names as `Promise`: on a class
// shaped like it (no `any`, `withResolvers`, `try`, no `Symbol.species`), against this process's own.

import { describe, expect, it } from "@rstest/core";

import type { ThreadLynx } from "../../../src/polyfill/globals.ts";
import { fillLynxPromise } from "../../../src/polyfill/language/lynx-promise.ts";
import { isConstructor } from "./device-built-ins.ts";

// Boundary: ES2024's and ES2025's statics, which this package's types leave out.
interface Statics {
	any<T>(values: Iterable<unknown>): Promise<T>;
	allSettled(values: Iterable<unknown>): Promise<PromiseSettledResult<unknown>[]>;
	withResolvers<T>(): {
		promise: Promise<T>;
		resolve: (value: T) => void;
		reject: (reason: unknown) => void;
	};
	try<T>(callback: (...args: unknown[]) => T, ...args: unknown[]): Promise<T>;
}

/** A class shaped like lynx-core's `Promise`: its own statics, and none of ES2021's to ES2025's. */
function lynxCorePromise(): PromiseConstructor & Statics {
	class LynxPromise<T> extends Promise<T> {}
	for (const name of ["any", "withResolvers", "try"])
		void Object.defineProperty(LynxPromise, name, {
			value: undefined,
			writable: true,
			configurable: true,
		});
	void Object.defineProperty(LynxPromise, Symbol.species, { value: undefined });
	return LynxPromise as unknown as PromiseConstructor & Statics;
}

/** lynx-core's `lynx` with `Promise`, the class filled. */
function filled(): PromiseConstructor & Statics {
	const PromiseClass = lynxCorePromise();
	fillLynxPromise(() => ({ Promise: PromiseClass, reportError: () => {} }) as ThreadLynx);
	return PromiseClass;
}

const own = Promise as unknown as Statics;

/** How a promise settles: its value, or its reason. */
async function settled(promise: PromiseLike<unknown>): Promise<unknown> {
	try {
		return { value: await promise };
	} catch (reason) {
		return reason instanceof AggregateError
			? { aggregate: reason.errors, message: reason.message }
			: { reason };
	}
}

describe("on lynx-core's Promise", () => {
	it("puts the missing statics, not enumerable, and leaves its own allSettled", () => {
		const PromiseClass = lynxCorePromise();
		const allSettled = PromiseClass.allSettled;
		fillLynxPromise(() => ({ Promise: PromiseClass, reportError: () => {} }));
		for (const name of ["any", "withResolvers", "try"])
			expect(Object.getOwnPropertyDescriptor(PromiseClass, name)).toEqual({
				value: expect.any(Function),
				writable: true,
				enumerable: false,
				configurable: true,
			});
		expect(PromiseClass.allSettled).toBe(allSettled);
	});

	it("gives methods named and sized as the specification's, which can't be called with new", () => {
		const PromiseClass = filled();
		const statics = PromiseClass as unknown as Record<string, (...args: unknown[]) => unknown>;
		expect(
			["any", "withResolvers", "try"].map((name) => [statics[name]!.name, statics[name]!.length]),
		).toEqual([
			["any", 1],
			["withResolvers", 0],
			["try", 1],
		]);
		for (const name of ["any", "withResolvers", "try"])
			expect(isConstructor(statics[name]), name).toBe(false);
	});

	it("puts allSettled where it lacks it too", () => {
		const PromiseClass = lynxCorePromise();
		Object.defineProperty(PromiseClass, "allSettled", { value: undefined, configurable: true });
		fillLynxPromise(() => ({ Promise: PromiseClass, reportError: () => {} }));
		expect(PromiseClass.allSettled).toBeTypeOf("function");
	});

	it("does nothing on a lynx without Promise, as the main thread's", () => {
		expect(() => fillLynxPromise(() => ({ reportError: () => {} }))).not.toThrow();
	});
});

describe("the statics it gives", () => {
	const PromiseClass = filled();
	const allSettled = (values: Iterable<unknown>) => {
		const ShapedLike = lynxCorePromise();
		Object.defineProperty(ShapedLike, "allSettled", { value: undefined, configurable: true });
		fillLynxPromise(() => ({ Promise: ShapedLike, reportError: () => {} }));
		return ShapedLike.allSettled(values);
	};
	const failure = new Error("rejected");

	it.each([
		["values", () => [1, 2]],
		["one fulfilled among rejected", () => [Promise.reject(failure), Promise.resolve(2), 3]],
		["all rejected", () => [Promise.reject(1), Promise.reject(2)]],
		["none", () => []],
		// oxlint-disable-next-line unicorn/no-thenable -- a thenable is what the statics must take
		["thenables", () => [{ then: (resolve: (value: unknown) => void) => resolve(4) }]],
		["a string", () => "ab"],
	])("settle as V8's for %s", async (_, make: () => Iterable<unknown>) => {
		// V8's, called on a class shaped the same: which promise settles first depends on the class,
		// as `C.resolve` wraps a promise of another class.
		const Shaped = lynxCorePromise();
		expect(await settled(PromiseClass.any(make()))).toEqual(
			await settled(own.any.call(Shaped, make())),
		);
		expect(await settled(allSettled(make()))).toEqual(
			await settled(own.allSettled.call(Shaped, make())),
		);
	});

	it("make promises of the class they are called on", () => {
		expect(PromiseClass.any([Promise.resolve(1)])).toBeInstanceOf(PromiseClass);
		expect(PromiseClass.withResolvers().promise).toBeInstanceOf(PromiseClass);
		expect(PromiseClass.try(() => 1)).toBeInstanceOf(PromiseClass);
	});

	it("reject what is not iterable, and refuse a class that is not a constructor", async () => {
		expect(await settled(PromiseClass.any(1 as unknown as Iterable<unknown>))).toEqual({
			reason: expect.any(TypeError),
		});
		expect(await settled(allSettled(1 as unknown as Iterable<unknown>))).toEqual({
			reason: expect.any(TypeError),
		});
		expect(() => PromiseClass.withResolvers.call({})).toThrow(TypeError);
		expect(() => PromiseClass.any.call(() => {}, [])).toThrow(TypeError);
	});

	it("reject when the class's resolve is not a function", async () => {
		type Executor = (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => void;
		const Base: new (executor: Executor) => Promise<unknown> = PromiseClass;
		class NoResolve extends Base {}
		void Object.defineProperty(NoResolve, "resolve", { value: undefined });
		expect(await settled(PromiseClass.any.call(NoResolve, [1]))).toEqual({
			reason: expect.any(TypeError),
		});
	});

	it("withResolvers: a promise and its functions", async () => {
		const { promise, resolve } = PromiseClass.withResolvers<number>();
		resolve(5);
		expect(await promise).toBe(5);
	});

	it("try: calls at once with the arguments, and settles with what it returns or throws", async () => {
		const order: string[] = [];
		const result = PromiseClass.try((a: unknown) => {
			order.push(`called ${String(a)}`);
			return a;
		}, 7);
		order.push("after");
		expect(order).toEqual(["called 7", "after"]);
		expect(await result).toBe(7);
		expect(
			await settled(
				PromiseClass.try(() => {
					throw failure;
				}),
			),
		).toEqual({ reason: failure });
	});
});
