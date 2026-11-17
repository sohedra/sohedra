// The names the build and both threads agree on are the package's, each spelled once.

import { describe, expect, it } from "@rstest/core";

import * as wire from "../../../src/wire/index.ts";

/** Every text the wire exports, at any depth of its constants. */
function texts(value: unknown, seen = new Set<unknown>()): string[] {
	if (typeof value === "string") return [value];
	if (value === null || typeof value !== "object" || seen.has(value)) return [];
	seen.add(value);
	const values = value instanceof Set ? [...value] : Object.values(value);
	return values.flatMap((member) => texts(member, seen));
}

describe("the wire's names", () => {
	it("carry the package's name, not an older one", () => {
		const all = texts(wire);
		expect(all.length).toBeGreaterThan(10);
		for (const text of all) expect(text).not.toMatch(/svelte-?lynx/i);
	});

	it("give each way between the threads a name of its own", () => {
		const ways = [wire.PATCH_METHOD, ...Object.values(wire.TO_BACKGROUND)];
		expect(new Set(ways).size).toBe(ways.length);
		expect(wire.FIRST_FRAME_GLOBAL).toMatch(/^__sohedra/);
		expect(wire.PATCH_METHOD).toMatch(/^sohedra/);
	});
});
