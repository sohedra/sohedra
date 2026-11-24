// `atob` and `btoa`, against HTML's base64 utility methods, with Node's own (which pass the web
// platform tests) as the reference for every string.

import { describe, expect, it } from "@rstest/core";
import fc from "fast-check";

import { createAtob, createBtoa, fillAtob } from "../../src/fills/web/atob.ts";

const atob = createAtob({ DOMException });
const btoa = createBtoa({ DOMException });

/** What `run` throws, or `undefined`. */
function thrown(run: () => unknown): unknown {
	try {
		run();
	} catch (error) {
		return error;
	}
	return undefined;
}

/** The same outcome: the same value, or an error of the same name. */
function outcome(run: () => unknown): unknown {
	try {
		return { value: run() };
	} catch (error) {
		return { error: (error as Error).name };
	}
}

describe("btoa", () => {
	it.each([
		["", ""],
		["a", "YQ=="],
		["ab", "YWI="],
		["abc", "YWJj"],
		["abcd", "YWJjZA=="],
		["\x00\xff", "AP8="],
	])("encodes %j as %j", (data, encoded) => {
		expect(btoa(data)).toBe(encoded);
	});

	it("encodes every string of bytes as Node's does", () => {
		fc.assert(
			fc.property(
				fc.string({
					unit: fc.integer({ min: 0, max: 255 }).map((code) => String.fromCharCode(code)),
				}),
				(data) => {
					expect(btoa(data)).toBe(globalThis.btoa(data));
				},
			),
		);
	});

	it("refuses a character outside Latin-1 with an InvalidCharacterError DOMException", () => {
		const error = thrown(() => btoa("€"));
		expect(error).toBeInstanceOf(DOMException);
		expect((error as DOMException).name).toBe("InvalidCharacterError");
		expect((error as DOMException).message).toBe("btoa was given a character outside Latin-1.");
	});

	it("converts its argument to a string as WebIDL does, and refuses none and a symbol", () => {
		expect(btoa(null as unknown as string)).toBe(globalThis.btoa("null"));
		expect(btoa(12 as unknown as string)).toBe("MTI=");
		expect(thrown(() => (btoa as () => string)())).toBeInstanceOf(TypeError);
		expect(thrown(() => btoa(Symbol() as unknown as string))).toBeInstanceOf(TypeError);
	});
});

describe("atob", () => {
	it.each([
		["YWJjZA==", "abcd"],
		["YWJjZA", "abcd"],
		[" YWJj\tZA==\n", "abcd"],
		["", ""],
		["AP8=", "\x00\xff"],
	])("decodes %j as %j", (encoded, data) => {
		expect(atob(encoded)).toBe(data);
	});

	it.each(["Zm9vYg=", "Zm9vY", "Z===", "Zm9v=Yg==", "Zm9v!", "Zm9v€", "===="])(
		"refuses %j with an InvalidCharacterError DOMException",
		(encoded) => {
			const error = thrown(() => atob(encoded));
			expect(error).toBeInstanceOf(DOMException);
			expect((error as DOMException).name).toBe("InvalidCharacterError");
		},
	);

	it("decodes or refuses every string as Node's does", () => {
		const characters = fc.constantFrom(
			..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/= \t\n\f\r!-_\u00e9".split(
				"",
			),
		);
		fc.assert(
			fc.property(fc.string({ unit: characters, maxLength: 24 }), (encoded) => {
				expect(outcome(() => atob(encoded))).toEqual(outcome(() => globalThis.atob(encoded)));
			}),
			{ numRuns: 2000 },
		);
	});

	it("gives back what btoa encoded", () => {
		fc.assert(
			fc.property(
				fc.string({
					unit: fc.integer({ min: 0, max: 255 }).map((code) => String.fromCharCode(code)),
				}),
				(data) => {
					expect(atob(btoa(data))).toBe(data);
				},
			),
		);
	});
});

describe("on a thread without DOMException", () => {
	it("throws an Error named InvalidCharacterError", () => {
		const error = thrown(() => createAtob({})("!"));
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).name).toBe("InvalidCharacterError");
	});
});

describe("the fill", () => {
	it("puts both on a thread that lacks them, made on first read", () => {
		const scope: Record<string, unknown> = {};
		fillAtob(scope);
		expect(Object.getOwnPropertyDescriptor(scope, "atob")?.get).toBeTypeOf("function");
		expect((scope["btoa"] as typeof btoa)("a")).toBe("YQ==");
		expect((scope["atob"] as typeof atob)("YQ")).toBe("a");
	});

	it("leaves a thread's own that works, and replaces one that gets base64 wrong", () => {
		const own = { atob: globalThis.atob, btoa: globalThis.btoa };
		const scope: Record<string, unknown> = { ...own };
		fillAtob(scope);
		expect(scope).toEqual(own);
		const wrong: Record<string, unknown> = { atob: () => "", btoa: () => "" };
		fillAtob(wrong);
		expect((wrong["btoa"] as typeof btoa)("a")).toBe("YQ==");
		expect((wrong["atob"] as typeof atob)("YQ")).toBe("a");
	});
});
