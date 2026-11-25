// ES2022's `cause` option of the error constructors: ECMA-262 § 20.5.8.1 (`InstallErrorCause`), for
// `Error` (§ 20.5.1), its six native errors (§ 20.5.6) and `AggregateError` (§ 20.5.7). Each
// constructor that ignores the option is wrapped: the wrapper makes the engine's error, so the
// prototype, `name`, `message` and `stack` are the engine's own, and adds the cause; the engine's
// statics stay readable and writable through it. Leaves out WebAssembly's errors, which PrimJS lacks.
// Two differences from a built-in: `Function.prototype.toString` gives the wrapper's source, not
// `[native code]`, and an `AggregateError`'s own `errors` come before its `cause`.

import { globalScope } from "../globals.ts";
import { holds, installEager } from "../install.ts";

/** An error constructor, which `new` and a call both take. */
interface ErrorClass {
	new (...args: unknown[]): Error;
	(...args: unknown[]): Error;
	readonly prototype: Error;
}

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
		const value = globalScope[name];
		if (typeof value !== "function" || keepsCause(value, aggregate)) continue;
		// Boundary: `Scope` holds unknowns, and lib's `ErrorConstructor` and
		// `AggregateErrorConstructor` take different arguments: one type with unknown ones stands for both.
		const Original = value as ErrorClass;
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
		// A template is the specification's `ToString`, which throws on a symbol where `String()`
		// would not. Boundary: a template takes any value; TypeScript's lint asks for a string.
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
		dropOwnEntry(error, text);
		return error;
	};
	// Boundary: TypeScript types a function expression as a call only; `new` takes it too.
	const Wrapped = wrapper as unknown as ErrorClass;
	Object.defineProperty(Wrapped, "name", { value: name, configurable: true });
	Object.defineProperty(Wrapped, "length", { value: aggregate ? 2 : 1, configurable: true });
	Object.defineProperty(Wrapped, "prototype", { value: prototype, writable: false });
	// The engine's statics, or a host's set before the fill (`stackTraceLimit`, `captureStackTrace`),
	// read and written through, as the engine reads them on its own constructor.
	const statics = Original as unknown as Record<PropertyKey, unknown>;
	const keys: PropertyKey[] = [
		...Object.getOwnPropertyNames(Original),
		...Object.getOwnPropertySymbols(Original),
	];
	for (const key of keys)
		if (Object.getOwnPropertyDescriptor(Wrapped, key) === undefined)
			Object.defineProperty(Wrapped, key, {
				get: () => statics[key],
				set: (value: unknown) => {
					statics[key] = value;
				},
				configurable: true,
			});
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
 * Removes the wrapper's own entry from `error`'s stack, made with `message`: the first entry line, as
 * the wrapper makes the error itself. PrimJS's `stack` is a data property with no header line. An
 * engine that writes a header (`Error: message`) into a data `stack` keeps the header, the
 * message's lines included. A stack in another shape (JavaScriptCore's `name@file:line:column`), or
 * one that is not a string in a data property (V8's accessor; V8 keeps the cause, so the fill never
 * wraps it), stays as the engine wrote it. Put back after the cause, so the error's own properties
 * come in the built-in's order: `message`, then `cause`.
 */
function dropOwnEntry(error: Error, message: string | undefined): void {
	const descriptor = Object.getOwnPropertyDescriptor(error, "stack");
	if (typeof descriptor?.value !== "string") return;
	const lines = descriptor.value.split("\n");
	const header = ENTRY.test(lines[0]!) ? 0 : (message ?? "").split("\n").length;
	const first = lines.findIndex((line, index) => index >= header && ENTRY.test(line));
	if (first === -1) return;
	lines.splice(first, 1);
	delete (error as { stack?: string }).stack;
	Object.defineProperty(error, "stack", { ...descriptor, value: lines.join("\n") });
}
