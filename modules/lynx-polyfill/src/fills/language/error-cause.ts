// ES2022's `cause` option of the error constructors: ECMA-262 § 20.5.8.1 (`InstallErrorCause`), for
// `Error` (§ 20.5.1), its six native errors (§ 20.5.6) and `AggregateError` (§ 20.5.7). Each
// constructor that ignores the option is wrapped: the wrapper makes the engine's error, so the
// prototype, `name`, `message` and `stack` are the engine's own, and adds the cause. Leaves out
// WebAssembly's errors and the engine's own statics of `Error` (V8's `captureStackTrace`), which
// PrimJS lacks.

import { globalScope } from "../globals.ts";
import { holds, installEager } from "../install.ts";

/** An error constructor, called with `new` or without. */
type ErrorClass = new (...args: unknown[]) => Error;

/** The constructors, `Error` first: the others' class side inherits the `Error` in place. */
const NAMES = [
	"Error",
	"EvalError",
	"RangeError",
	"ReferenceError",
	"SyntaxError",
	"TypeError",
	"URIError",
	"AggregateError",
] as const;

/**
 * PrimJS ignores the option on both threads. Replaces core-js's `es.error.cause` and
 * `es.aggregate-error.cause` for this fill: their trim of the wrapper's stack entries expects V8's
 * header line, and on PrimJS's stacks, which have none, it removed the caller's entries instead.
 *
 * @workaround language-error-cause kind=lynx-gap delete-when="the engine of the oldest Lynx the package supports keeps the cause option of Error and AggregateError"
 */
export function fillErrorCause(): void {
	for (const name of NAMES) {
		const aggregate = name === "AggregateError";
		// Boundary: the error constructors, by name.
		const Original = globalScope[name] as ErrorClass | undefined;
		if (typeof Original !== "function") continue;
		const Wrapped = withCause(Original, name, aggregate);
		if (installEager(globalScope, name, Wrapped, (existing) => keepsCause(existing, aggregate)))
			Original.prototype.constructor = Wrapped;
	}
}

/** Whether `Class` puts the `cause` of its options on the error it makes. */
function keepsCause(Class: unknown, aggregate: boolean): boolean {
	const options = { cause: 7 };
	return holds(() => {
		// Boundary: what is in the global's place; `holds` takes it throwing as not keeping the cause.
		const Constructor = Class as ErrorClass;
		const error = aggregate
			? new Constructor([], undefined, options)
			: new Constructor(undefined, options);
		return error.cause === 7;
	});
}

/** `Original`, wrapped to take the `cause` of its options, with its `name`, `length` and prototype. */
function withCause(Original: ErrorClass, name: string, aggregate: boolean): ErrorClass {
	const { prototype } = Original;
	const wrapper = function (this: unknown, first?: unknown, ...rest: unknown[]): Error {
		// In the specification's order (§ 20.5.1.1, § 20.5.7.1.1): the prototype from `new.target`,
		// the message, the cause, and then an `AggregateError`'s errors.
		let target: object = prototype;
		if (new.target !== undefined && new.target !== wrapper) {
			const custom: unknown = new.target.prototype;
			if (isObject(custom)) target = custom;
		}
		const message = aggregate ? rest[0] : first;
		const text = message === undefined ? undefined : `${message as string}`;
		const options = rest[aggregate ? 1 : 0];
		const hasCause = isObject(options) && "cause" in options;
		const cause = hasCause ? options.cause : undefined;
		const error = aggregate ? new Original(first, text) : new Original(text);
		if (target !== prototype) Object.setPrototypeOf(error, target);
		if (hasCause)
			Object.defineProperty(error, "cause", {
				value: cause,
				writable: true,
				enumerable: false,
				configurable: true,
			});
		dropOwnEntry(error);
		return error;
	};
	// Boundary: an old-style constructor, as the engine's built-in is, which `new` and a call take.
	const Wrapped = wrapper as unknown as ErrorClass;
	Object.defineProperty(Wrapped, "name", { value: name, configurable: true });
	Object.defineProperty(Wrapped, "length", { value: aggregate ? 2 : 1, configurable: true });
	Object.defineProperty(Wrapped, "prototype", { value: prototype, writable: false });
	// Boundary: the `Error` in place, this fill's or the engine's, read by name.
	if (name !== "Error") Object.setPrototypeOf(Wrapped, globalScope.Error as object);
	return Wrapped;
}

/** Whether `value` is an object, a function included, as the specification's `Object` type. */
function isObject(value: unknown): value is object {
	return (typeof value === "object" && value !== null) || typeof value === "function";
}

/** Matches an entry of a stack as PrimJS and V8 write it, `    at name (file:line:column)`. */
const ENTRY = /^\s+at /;

/**
 * Removes the wrapper's own entry from `error`'s stack: the first entry line, as the wrapper makes
 * the error itself, after any header line (V8 writes one, PrimJS none). A stack in another shape
 * stays as the engine wrote it.
 */
function dropOwnEntry(error: Error): void {
	const descriptor = Object.getOwnPropertyDescriptor(error, "stack");
	if (typeof descriptor?.value !== "string") return;
	const lines = descriptor.value.split("\n");
	const first = lines.findIndex((line) => ENTRY.test(line));
	if (first === -1) return;
	lines.splice(first, 1);
	Object.defineProperty(error, "stack", { ...descriptor, value: lines.join("\n") });
}
