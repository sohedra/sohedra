// ES2022's `cause` option of the error constructors, on constructors that ignore it, as PrimJS's
// do: the fill wraps each, keeping the constructor's shape and the specification's order.

import { describe, expect, it } from "@rstest/core";

import { fillErrorCause } from "../../src/fills/language/error-cause.ts";
import { fillOnDevice } from "./device-built-ins.ts";

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
// Boundary: the error constructors, by name.
type ErrorClass = new (...args: unknown[]) => Error;
const scope = globalThis as unknown as Record<string, ErrorClass>;
const own = NAMES.map((name) => scope[name]!);

/** A constructor that ignores its options, as PrimJS's: it makes the engine's own error. */
function ignoringCause(Own: ErrorClass): ErrorClass {
	const aggregate = Own.name === "AggregateError";
	// Boundary: an old-style constructor, as an engine's built-in is.
	const Ignoring = function (this: unknown, ...args: unknown[]) {
		return aggregate ? new Own(args[0], args[1]) : new Own(args[0]);
	} as unknown as ErrorClass;
	Ignoring.prototype = Own.prototype;
	return Ignoring;
}

const filled = fillOnDevice({
	gaps: NAMES.map((name, index) => [globalThis, name, ignoringCause(own[index]!)] as const),
	fill: fillErrorCause,
	restore: own.map((Own) => [Own.prototype, "constructor"] as const),
}) as ErrorClass[];
const [FilledError, , , , , FilledTypeError, , FilledAggregateError] = filled;

describe("on an engine whose errors ignore cause", () => {
	it("wraps each constructor", () => {
		filled.forEach((Filled, index) => {
			expect(Filled, NAMES[index]).toBeTypeOf("function");
			expect(Filled, NAMES[index]).not.toBe(own[index]);
			expect(Filled.prototype, NAMES[index]).toBe(own[index]!.prototype);
		});
	});

	it("puts this process's own back", () => {
		expect(globalThis.Error).toBe(own[0]);
		expect(Error.prototype.constructor).toBe(Error);
	});
});

describe("the constructors it gives", () => {
	it("keep the cause as an own property, not enumerable, only when the options have one", () => {
		const cause = new Error("first");
		const error = new FilledError!("second", { cause });
		expect(error.cause).toBe(cause);
		expect(Object.getOwnPropertyDescriptor(error, "cause")).toEqual({
			value: cause,
			writable: true,
			enumerable: false,
			configurable: true,
		});
		expect(Object.hasOwn(new FilledError!("none", {}), "cause")).toBe(false);
		expect(Object.hasOwn(new FilledError!("none"), "cause")).toBe(false);
		expect(new FilledError!("undefined", { cause: undefined }).cause).toBe(undefined);
		expect(Object.hasOwn(new FilledError!("undefined", { cause: undefined }), "cause")).toBe(true);
	});

	it("make errors of the engine's classes, with the message, called with new or without", () => {
		const error = new FilledTypeError!("wrong", { cause: 1 });
		expect(error).toBeInstanceOf(own[5]);
		expect(error).toBeInstanceOf(own[0]);
		expect(error.message).toBe("wrong");
		expect(error.name).toBe("TypeError");
		const called = (FilledTypeError as unknown as (...args: unknown[]) => Error)("plain", {
			cause: 2,
		});
		expect(called).toBeInstanceOf(own[5]);
		expect(called.cause).toBe(2);
		expect(Object.hasOwn(new FilledError!(), "message")).toBe(false);
	});

	it("keep AggregateError's errors, and its cause from the third argument", () => {
		const error = new FilledAggregateError!([1, 2], "both", { cause: 3 }) as AggregateError;
		expect(error.errors).toEqual([1, 2]);
		expect(error.message).toBe("both");
		expect(error.cause).toBe(3);
		expect(error).toBeInstanceOf(own[7]);
	});
});

describe("the constructors' own shape", () => {
	it("have the engine's name and length, a fixed prototype, and Error's class side", () => {
		filled.forEach((Filled, index) => {
			const name = NAMES[index]!;
			expect(Filled.name, name).toBe(name);
			expect(Filled.length, name).toBe(name === "AggregateError" ? 2 : 1);
			expect(Object.getOwnPropertyDescriptor(Filled, "prototype"), name).toEqual({
				value: own[index]!.prototype,
				writable: false,
				enumerable: false,
				configurable: false,
			});
			if (name !== "Error") expect(Object.getPrototypeOf(Filled), name).toBe(FilledError);
		});
	});

	it("make a subclass's errors, and take the prototype from new.target", () => {
		class AppError extends FilledError! {}
		const error = new AppError("app", { cause: 1 });
		expect(error).toBeInstanceOf(AppError);
		expect(error).toBeInstanceOf(own[0]);
		expect(error.cause).toBe(1);
		const custom = { custom: true };
		const target = new Proxy(function () {}, {
			get: (base, key) => (key === "prototype" ? custom : base[key as keyof typeof base]),
		});
		expect(Object.getPrototypeOf(Reflect.construct(FilledAggregateError!, [[]], target))).toBe(
			custom,
		);
		const plain = function () {};
		plain.prototype = 1;
		expect(Object.getPrototypeOf(Reflect.construct(FilledTypeError!, [], plain))).toBe(
			own[5]!.prototype,
		);
	});

	it("read the message, then the cause, then an AggregateError's errors", () => {
		const order: string[] = [];
		const message = {
			toString: () => {
				order.push("message");
				return "m";
			},
		};
		const options = {
			get cause() {
				order.push("cause");
				return 0;
			},
		};
		const errors = {
			[Symbol.iterator]: () => {
				order.push("errors");
				return [][Symbol.iterator]();
			},
		};
		new FilledError!(message, options);
		new FilledAggregateError!(errors, message, options);
		expect(order).toEqual(["message", "cause", "message", "cause", "errors"]);
	});
});

/**
 * `Error` filled over an engine's that ignores cause and gives each error `stack`: a data property
 * holding `stack(message)`, or what `define` puts there.
 */
function filledWithStack(define: (error: Error, message: string) => void): ErrorClass {
	// Boundary: an old-style constructor, as an engine's built-in is.
	const Ignoring = function (message: string) {
		const error = new own[0]!(message);
		define(error, message);
		return error;
	} as unknown as ErrorClass;
	Ignoring.prototype = own[0]!.prototype;
	const [Filled] = fillOnDevice({
		gaps: [[globalThis, "Error", Ignoring]],
		fill: fillErrorCause,
		restore: [[own[0]!.prototype, "constructor"]],
	}) as ErrorClass[];
	return Filled!;
}

/** The stack an error made by `Filled` has, given the engine wrote `stack`. */
function trimmed(stack: (message: string) => string, message = "x"): unknown {
	const Filled = filledWithStack((error, text) =>
		Object.defineProperty(error, "stack", {
			value: stack(text),
			writable: true,
			configurable: true,
		}),
	);
	return new Filled(message).stack;
}

describe("the stack of an error the wrapper makes", () => {
	it("loses the wrapper's entry when there is no header line, as PrimJS writes it", () => {
		expect(trimmed(() => "    at wrapper (f:1:1)\n    at maker (f:2:2)\n")).toBe(
			"    at maker (f:2:2)\n",
		);
	});

	it("keeps a header line, and loses the entry after it", () => {
		expect(
			trimmed((message) => `Error: ${message}\n    at wrapper (f:1:1)\n    at maker (f:2:2)`),
		).toBe("Error: x\n    at maker (f:2:2)");
	});

	it("keeps a header whose message has a line that looks like an entry", () => {
		const message = "first\n    at line (of the message)";
		expect(
			trimmed((text) => `Error: ${text}\n    at wrapper (f:1:1)\n    at maker (f:2:2)`, message),
		).toBe(`Error: ${message}\n    at maker (f:2:2)`);
	});

	it("stays as the engine wrote it in another shape, as JavaScriptCore's", () => {
		expect(trimmed(() => "wrapper@f:1:1\nmaker@f:2:2")).toBe("wrapper@f:1:1\nmaker@f:2:2");
	});

	it("is left alone when it is not a string, or an accessor", () => {
		const Number = filledWithStack((error) =>
			Object.defineProperty(error, "stack", { value: 7, writable: true, configurable: true }),
		);
		expect(new Number("x").stack).toBe(7);
		const read = (): string => "    at wrapper (f:1:1)";
		const Accessor = filledWithStack((error) =>
			Object.defineProperty(error, "stack", { get: read, configurable: true }),
		);
		expect(Object.getOwnPropertyDescriptor(new Accessor("x"), "stack")?.get).toBe(read);
	});
});

describe("the engine's statics of Error", () => {
	it("are on the wrapper, read and written through to the engine's", () => {
		const Ignoring = ignoringCause(own[0]!) as ErrorClass & { stackTraceLimit?: number };
		Ignoring.stackTraceLimit = 10;
		const [Filled] = fillOnDevice({
			gaps: [[globalThis, "Error", Ignoring]],
			fill: fillErrorCause,
			restore: [[own[0]!.prototype, "constructor"]],
		}) as (ErrorClass & { stackTraceLimit?: number })[];
		expect(Filled!.stackTraceLimit).toBe(10);
		Filled!.stackTraceLimit = 50;
		expect(Ignoring.stackTraceLimit).toBe(50);
	});
});
