// `Promise.any`, `Promise.allSettled`, `Promise.withResolvers` and `Promise.try` on the `Promise`
// the background's bundle names: ECMA-262 § 27.2.4. Lynx's runtime wrapper starts the bundle with
// `var Promise = lynx.Promise`, lynx-core's own (the `then/promise` library), which lacks `any`,
// `withResolvers` and `try`. It has no `Symbol.species` either, and its `then` throws "not a
// constructor" when it would read one, so core-js's statics, which check for it, refuse it: these
// are the specification's steps, which never read `Symbol.species`. `then` on a subclass of it
// stays a promise of lynx-core's own class.

import type { ThreadLynx } from "../globals.ts";
import { installEager } from "../install.ts";

/** A `Promise` class: lynx-core's, or the engine's. */
type PromiseClass = PromiseConstructor;

/** What `NewPromiseCapability` makes: a promise of the class, and its functions. */
interface Capability {
	promise: Promise<unknown>;
	resolve: (value: unknown) => void;
	reject: (reason: unknown) => void;
}

/**
 * Background only: the main thread's bundle names the engine's `Promise`.
 *
 * @workaround lynx-promise-statics kind=lynx-gap delete-when="lynx-core's Promise has any, withResolvers and try, or the runtime wrapper stops replacing the engine's Promise"
 */
export function fillLynxPromise(readLynx: () => ThreadLynx): void {
	const lynxPromise = readLynx().Promise;
	if (typeof lynxPromise !== "function") return;
	for (const name of ["any", "allSettled", "withResolvers", "try"] as const)
		installEager(lynxPromise, name, STATICS[name], isFunction);
}

const isFunction = (existing: unknown): boolean => typeof existing === "function";

/** `NewPromiseCapability(C)`. */
function capability(C: PromiseClass): Capability {
	if (typeof C !== "function")
		throw new TypeError("A Promise static was called on a non-constructor.");
	let resolve: Capability["resolve"] | undefined;
	let reject: Capability["reject"] | undefined;
	const promise = new C((resolveWith, rejectWith) => {
		if (resolve !== undefined || reject !== undefined)
			throw new TypeError("A promise's executor was called twice.");
		resolve = resolveWith;
		reject = rejectWith;
	});
	if (typeof resolve !== "function" || typeof reject !== "function")
		throw new TypeError("A promise's executor was not given its resolve and reject functions.");
	return { promise, resolve, reject };
}

/** `C.resolve`, which the combinators call on each value. */
function resolver(C: PromiseClass): (value: unknown) => PromiseLike<unknown> {
	const resolve: unknown = C.resolve;
	if (typeof resolve !== "function") throw new TypeError("Promise.resolve is not a function.");
	return (value) => (resolve as (value: unknown) => PromiseLike<unknown>).call(C, value);
}

/**
 * The statics, as the specification's steps. Methods, as a built-in's are: they can't be called with
 * `new`, and each has its name.
 */
const STATICS = {
	/** `Promise.any`. */
	any(this: PromiseClass, iterable: Iterable<unknown>): Promise<unknown> {
		const { promise, resolve, reject } = capability(this);
		try {
			const next = resolver(this);
			const errors: unknown[] = [];
			let remaining = 1;
			const settle = () => {
				if (--remaining === 0) reject(new AggregateError(errors, "All promises were rejected"));
			};
			for (const value of iterable) {
				const index = errors.length;
				errors.push(undefined);
				remaining++;
				let called = false;
				next(value).then(resolve, (error: unknown) => {
					if (called) return;
					called = true;
					errors[index] = error;
					settle();
				});
			}
			settle();
		} catch (error) {
			reject(error);
		}
		return promise;
	},

	/** `Promise.allSettled`. */
	allSettled(this: PromiseClass, iterable: Iterable<unknown>): Promise<unknown> {
		const { promise, resolve, reject } = capability(this);
		try {
			const next = resolver(this);
			const results: PromiseSettledResult<unknown>[] = [];
			let remaining = 1;
			const settle = () => {
				if (--remaining === 0) resolve(results);
			};
			for (const value of iterable) {
				const index = results.length;
				results.push(undefined as unknown as PromiseSettledResult<unknown>);
				remaining++;
				let called = false;
				const record = (result: PromiseSettledResult<unknown>) => {
					if (called) return;
					called = true;
					results[index] = result;
					settle();
				};
				next(value).then(
					(fulfilled: unknown) => record({ status: "fulfilled", value: fulfilled }),
					(reason: unknown) => record({ status: "rejected", reason }),
				);
			}
			settle();
		} catch (error) {
			reject(error);
		}
		return promise;
	},

	/** `Promise.withResolvers`. */
	withResolvers(this: PromiseClass): Capability {
		return capability(this);
	},

	/** `Promise.try`. */
	try(
		this: PromiseClass,
		callback: (...args: unknown[]) => unknown,
		...args: unknown[]
	): Promise<unknown> {
		const { promise, resolve, reject } = capability(this);
		try {
			resolve(callback(...args));
		} catch (error) {
			reject(error);
		}
		return promise;
	},
};
