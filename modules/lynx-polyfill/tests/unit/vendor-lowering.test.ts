// What bundling the package's packages writes besides the bundle: Unicode property escapes,
// which PrimJS refuses, written out as the code points they stand for; and the `atob` a package
// reads as it loads, which a thread lacks until the fills run.

import vm from "node:vm";

import { describe, expect, it } from "@rstest/core";
import fc from "fast-check";

import { lowerPropertyEscapes } from "../../scripts/vendor/bundle.ts";
import { atob } from "../../scripts/vendor/provide/atob.js";

describe("lowerPropertyEscapes", () => {
	it("writes out a literal's \\p{…} and \\P{…}, keeping its flags, and matches what it matched", () => {
		const code = "const start = /[$_\\p{ID_Start}]/u; const other = /\\P{L}+/gu;";
		const lowered = lowerPropertyEscapes(code);
		expect(lowered).not.toMatch(/\\[pP]\{/);
		const [start, other] = vm.runInNewContext(`${lowered} [start, other];`) as RegExp[];
		expect([start!.flags, other!.flags]).toEqual(["u", "gu"]);
		for (const text of ["a", "é", "日", "1", "$", " ", "😀"]) {
			expect(new RegExp(start!.source, "u").test(text), text).toBe(/[$_\p{ID_Start}]/u.test(text));
			expect(new RegExp(other!.source, "u").test(text), text).toBe(/\P{L}+/u.test(text));
		}
	});

	it("leaves code without them as it is, regular expressions and strings that look like them too", () => {
		const code = 'const a = /x\\d/g; const b = "\\\\p{L}"; const c = a / 2 / 3;';
		expect(lowerPropertyEscapes(code)).toBe(code);
	});
});

describe("the atob given to a package as it loads", () => {
	it("decodes base64 as the standard's does", () => {
		fc.assert(
			fc.property(fc.uint8Array({ maxLength: 64 }), (bytes) => {
				const encoded = Buffer.from(bytes).toString("base64");
				expect(atob(encoded)).toBe(globalThis.atob(encoded));
			}),
		);
	});
});
