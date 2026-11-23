// How a fill goes on a global object or a prototype: only where what is there is missing or fails
// the fill's check, writable and configurable, and, when lazy, made on its first read.

import { describe, expect, it } from "@rstest/core";

import { holds, installEager, installLazy } from "../../../src/polyfill/install.ts";

const BUILT_IN = { writable: true, enumerable: false, configurable: true };

describe("an eager fill", () => {
	it("goes where nothing is, as a built-in does: writable, configurable, not enumerable", () => {
		const scope: Record<string, unknown> = {};
		const fill = () => {};
		expect(installEager(scope, "thing", fill)).toBe(true);
		expect(Object.getOwnPropertyDescriptor(scope, "thing")).toEqual({ value: fill, ...BUILT_IN });
	});

	it("leaves what is there, by default whatever it is", () => {
		const own = 0;
		const scope: Record<string, unknown> = { thing: own };
		expect(installEager(scope, "thing", () => {})).toBe(false);
		expect(scope["thing"]).toBe(own);
	});

	it("leaves what an object inherits, which an engine's prototypes hold", () => {
		const scope = Object.create({ thing: "inherited" }) as Record<string, unknown>;
		expect(installEager(scope, "thing", "fill")).toBe(false);
		expect(Object.hasOwn(scope, "thing")).toBe(false);
	});

	it("replaces what is there when it fails the fill's check", () => {
		const broken = () => "wrong";
		const scope: Record<string, unknown> = { thing: broken };
		const fill = () => "right";
		const works = (existing: unknown) => (existing as () => string)() === "right";
		expect(installEager(scope, "thing", fill, works)).toBe(true);
		expect(scope["thing"]).toBe(fill);
	});

	it("replaces what is there when the check throws on it", () => {
		const scope: Record<string, unknown> = { thing: 1 };
		const works = () => {
			throw new Error("the check threw");
		};
		expect(installEager(scope, "thing", "fill", works)).toBe(true);
		expect(scope["thing"]).toBe("fill");
	});

	it("can be put over by an app's own", () => {
		const scope: Record<string, unknown> = {};
		installEager(scope, "thing", "fill");
		scope["thing"] = "app";
		expect(scope["thing"]).toBe("app");
		delete scope["thing"];
		expect("thing" in scope).toBe(false);
	});
});

describe("a lazy fill", () => {
	it("makes its value on the first read only, then is a plain built-in value", () => {
		const scope: Record<string, unknown> = {};
		let loads = 0;
		const value = { made: true };
		expect(
			installLazy(scope, "thing", () => {
				loads++;
				return value;
			}),
		).toBe(true);
		expect(loads).toBe(0);
		expect(scope["thing"]).toBe(value);
		expect(scope["thing"]).toBe(value);
		expect(loads).toBe(1);
		expect(Object.getOwnPropertyDescriptor(scope, "thing")).toEqual({ value, ...BUILT_IN });
	});

	it("is not enumerable before its read either", () => {
		const scope: Record<string, unknown> = {};
		installLazy(scope, "thing", () => 1);
		expect(Object.keys(scope)).toEqual([]);
		expect("thing" in scope).toBe(true);
	});

	it("takes an app's own written before the first read, without making its value", () => {
		const scope: Record<string, unknown> = {};
		let loads = 0;
		installLazy(scope, "thing", () => loads++);
		scope["thing"] = "app";
		expect(scope["thing"]).toBe("app");
		expect(loads).toBe(0);
		expect(Object.getOwnPropertyDescriptor(scope, "thing")).toEqual({ value: "app", ...BUILT_IN });
	});

	it("counts as there for a second fill of the same name, which neither reads nor replaces it", () => {
		const scope: Record<string, unknown> = {};
		let loads = 0;
		installLazy(scope, "thing", () => ++loads);
		const checked: unknown[] = [];
		const works = (existing: unknown) => {
			checked.push(existing);
			return false;
		};
		expect(installLazy(scope, "thing", () => "second", works)).toBe(false);
		expect(installEager(scope, "thing", "second", works)).toBe(false);
		expect(checked).toEqual([]);
		expect(loads).toBe(0);
		expect(scope["thing"]).toBe(1);
	});

	it("leaves what is there when it passes the check, and replaces it when not", () => {
		const own = () => {};
		const scope: Record<string, unknown> = { kept: own, broken: own };
		expect(
			installLazy(
				scope,
				"kept",
				() => "fill",
				() => true,
			),
		).toBe(false);
		expect(
			installLazy(
				scope,
				"broken",
				() => "fill",
				() => false,
			),
		).toBe(true);
		expect(scope["kept"]).toBe(own);
		expect(scope["broken"]).toBe("fill");
	});
});

describe("a check that calls a built-in", () => {
	it("holds when it returns true, and fails when it returns false or throws", () => {
		expect(holds(() => true)).toBe(true);
		expect(holds(() => false)).toBe(false);
		expect(
			holds(() => {
				throw new TypeError("not a function");
			}),
		).toBe(false);
	});
});
