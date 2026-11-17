// Where PrimJS runs the background thread, a Proxy's accessor comes back as a data descriptor, so
// Svelte's `prop()` finds no setter for a binding passed beside `{...rest}`. The build patches the
// text of Svelte's `props.js` at two places; this is what the patch does and what it reports when
// Svelte's text has moved. That the bindings then work is a library test, for a later pull request.

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";

import {
	SPREAD_SETTER_ANCHORS,
	SPREAD_SETTER_FILE,
	patchSpreadSetter,
} from "../../../../src/svelte/build/index.ts";

const require = createRequire(import.meta.url);
const propsFile = path.join(
	path.dirname(require.resolve("svelte/package.json")),
	"src/internal/client/reactivity/props.js",
);
const source = fs.readFileSync(propsFile, "utf8");

describe("the file the patch is for", () => {
	it("is Svelte's client props.js, and no other file", () => {
		expect(SPREAD_SETTER_FILE.test(propsFile)).toBe(true);
		expect(SPREAD_SETTER_FILE.test(propsFile.replace(/\//g, "\\"))).toBe(true);
		expect(SPREAD_SETTER_FILE.test(propsFile.replace("client", "server"))).toBe(false);
		expect(SPREAD_SETTER_FILE.test(propsFile.replace("props.js", "store.js"))).toBe(false);
	});
});

describe("the patch", () => {
	it("changes each anchor's line once, and adds the setter lookup", () => {
		const patched = patchSpreadSetter(source);
		if (!("code" in patched)) throw new Error("the patch did not apply");
		for (const anchor of SPREAD_SETTER_ANCHORS) {
			expect(source.split(anchor.text).length - 1).toBe(1);
			expect(patched.code.split(anchor.replacement).length - 1).toBe(1);
		}
		expect(patched.code).not.toContain("return new Proxy({ props }, spread_props_handler);");
		expect(patched.code).toContain("new WeakMap()");
		expect(patched.code).toMatch(/get_descriptor\(props, key\)\?\.set \?\? \w+\(props, key\) \?\?/);
	});

	it("changes the two lines in place and appends its helpers: every other line keeps its number", () => {
		const patched = patchSpreadSetter(source);
		if (!("code" in patched)) throw new Error("the patch did not apply");
		const before = source.split("\n");
		const after = patched.code.split("\n");
		const changed = before.flatMap((line, index) => (after[index] === line ? [] : [index]));
		expect(changed).toHaveLength(2);
		expect(after.length).toBeGreaterThan(before.length);
	});
});

describe("a Svelte whose props.js has moved", () => {
	it.each(SPREAD_SETTER_ANCHORS.map((anchor) => [anchor.what, anchor] as const))(
		"reports the anchor that is gone: %s",
		(_what, anchor) => {
			const result = patchSpreadSetter(source.replace(anchor.text, "/* moved */"));
			expect(result).toEqual({ missing: anchor.what });
		},
	);

	it("reports an anchor that is there twice, since the patch could not tell which to change", () => {
		const anchor = SPREAD_SETTER_ANCHORS[0]!;
		expect(patchSpreadSetter(`${source}\n${anchor.text}\n`)).toEqual({ missing: anchor.what });
	});
});
