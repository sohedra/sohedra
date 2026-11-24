// ES2025's `RegExp.escape`, by core-js's module: on a `RegExp` that lacks it, as PrimJS's does,
// against this process's own.

import { describe, expect, it } from "@rstest/core";
import fc from "fast-check";

import { fillRegExpEscape } from "../../../src/polyfill/language/regexp-escape.ts";
import { fillOnDevice, outcome } from "./device-built-ins.ts";

// Boundary: ES2025's static, which this package's types leave out.
type Escape = (value: unknown) => string;
const own = (RegExp as unknown as { escape: Escape }).escape;
const [escape] = fillOnDevice({ gaps: [[RegExp, "escape"]], fill: fillRegExpEscape }) as Escape[];

describe("on an engine that lacks it", () => {
	it("puts core-js's in its place", () => {
		expect(escape).toBeTypeOf("function");
		expect(escape).not.toBe(own);
	});
});

describe("the RegExp.escape it gives", () => {
	it("escapes every string as V8's does, so a pattern of it matches the string itself", () => {
		fc.assert(
			fc.property(fc.string({ unit: "binary" }), (value) => {
				expect(escape!(value)).toBe(own(value));
				// Boundary: ES2024's `isWellFormed`, which this package's types leave out.
				const wellFormed = (value as unknown as { isWellFormed(): boolean }).isWellFormed();
				expect(new RegExp(`^${escape!(value)}$`, "u").test(value) || !wellFormed).toBe(true);
			}),
		);
		for (const value of ["a.b*c", "_x", "1st", " ,-=<>#&!%:;@~'`\"", "\u2028\uFEFF", "\uD800"])
			expect(escape!(value)).toBe(own(value));
		expect(outcome(() => escape!(1))).toEqual(outcome(() => own(1)));
	});
});
