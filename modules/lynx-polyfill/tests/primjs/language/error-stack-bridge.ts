// Makes an error of each kind in a named function, after the thread's fills, and reports the first
// entry of its stack: PrimJS writes the frame the error was made in first, with no header line, and
// the fill that adds `cause` must keep it there.

import { report } from "../realm.ts";

function makeError(): Error {
	return new Error("x");
}
function makeEvalError(): Error {
	return new EvalError("x");
}
function makeRangeError(): Error {
	return new RangeError("x");
}
function makeReferenceError(): Error {
	return new ReferenceError("x");
}
function makeSyntaxError(): Error {
	return new SyntaxError("x");
}
function makeTypeError(): Error {
	return new TypeError("x");
}
function makeURIError(): Error {
	return new URIError("x");
}
function makeAggregateError(): Error {
	return new AggregateError([], "x");
}
function makeBoundError(): Error {
	// A library's partial application of the constructor, read after the fills ran.
	// Boundary: lib types `bind` on `ErrorConstructor` by its call signature only.
	const BoundError = Error.bind(null, "x") as unknown as new () => Error;
	return new BoundError();
}
function callError(): Error {
	return Error("x");
}

/** The kinds of error, each with the function that makes one. */
export const ERROR_MAKERS: readonly (readonly [kind: string, make: () => Error])[] = [
	["Error", makeError],
	["EvalError", makeEvalError],
	["RangeError", makeRangeError],
	["ReferenceError", makeReferenceError],
	["SyntaxError", makeSyntaxError],
	["TypeError", makeTypeError],
	["URIError", makeURIError],
	["AggregateError", makeAggregateError],
	["a bound Error", makeBoundError],
	["Error called without new", callError],
];

/** The names of the first two entries of `stack`, as PrimJS and V8 write an entry: `at name (…)`. */
function firstEntries(stack: unknown): string {
	if (typeof stack !== "string") return `no stack: ${typeof stack}`;
	const names: string[] = [];
	for (const line of stack.split("\n")) {
		const entry = /^\s*at (\S+)/.exec(line);
		if (entry) names.push(entry[1]!);
		if (names.length === 2) break;
	}
	return names.join(" ");
}

/** Reports each kind's first stack entries, and whether `cause` comes through. */
export function connectErrorStack(): void {
	const stacks: Record<string, string> = {};
	for (const [kind, make] of ERROR_MAKERS) stacks[kind] = firstEntries(make().stack);
	report(stacks);
	report({
		Error: new Error("x", { cause: 7 }).cause === 7,
		AggregateError: new AggregateError([], "x", { cause: 7 }).cause === 7,
	});
}
