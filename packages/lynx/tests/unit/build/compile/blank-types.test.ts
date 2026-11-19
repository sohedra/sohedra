// A component's TypeScript blanked out: what is left is JavaScript, every character in its place.

import { describe, expect, it } from "@rstest/core";
import * as acorn from "acorn";
import { parse } from "svelte/compiler";

import { blankTypes } from "../../../../src/build/compile/blank-types.ts";

const component = `<script lang="ts" module>
	import type { Kind } from "./kinds.ts";
	export type Pair = [Kind, Kind];
	export interface Box { size: number }
</script>

<script lang="ts">
	declare function measure(value: unknown): number;
	type Local = { size: number };
	let late!: number;
	const pick = <T,>(value: T, fallback?: T): T => value ?? fallback!;
	function sized(this: Local, scale?: number): number {
		return this.size * (scale ?? 1);
	}
	const box = { size: 2 } satisfies Local;
	const count = (<number>box.size) + (box as Local).size + pick<number>(1);
	late = sized.call(box, count);
</script>

<view ontap={(event: Event): void => void event}></view>`;

/** The scripts and markup of `source`, parsed as Svelte parses them. */
const nodes = (source: string) => {
	const ast = parse(source, { modern: true });
	return [ast.instance, ast.module, ast.fragment];
};

/** The text of each script of `source`, between its tags. */
const scripts = (source: string): string[] =>
	[...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]!);

describe("a component's TypeScript, blanked", () => {
	const blanked = blankTypes(component, nodes(component));

	it("keeps every character's place and every line break", () => {
		expect(blanked).toHaveLength(component.length);
		expect(blanked.split("\n").length).toBe(component.split("\n").length);
	});

	it("leaves JavaScript in each script, with no type left", () => {
		for (const script of scripts(blanked)) {
			expect(() =>
				acorn.parse(script, { ecmaVersion: "latest", sourceType: "module" }),
			).not.toThrow();
			expect(script).not.toMatch(
				/\b(?:Kind|Pair|Box|Local|number|unknown|satisfies|interface|declare)\b|\bas\b|!:|\?\s*:/,
			);
		}
		expect(scripts(blanked)[1]).toContain("const box = { size: 2 }");
		expect(scripts(blanked)[1]).toMatch(/function sized\(\s*scale\s*\)/);
	});

	it("blanks the markup's expressions too", () => {
		expect(blanked).toMatch(/ontap=\{\(event\s*\)\s*=> void event\}/);
	});

	it("leaves a component without TypeScript as it is", () => {
		const plain = `<script>const a = 1, b = 2;</script><text>{a < b}</text>`;
		expect(blankTypes(plain, nodes(plain))).toBe(plain);
	});
});
