// One `prepare` step, one map: whatever the passes inserted, positions in the compiled code point
// at the source as written, for a component in which every pass is active.

import { describe, expect, it } from "@rstest/core";

import { decode } from "../../../../src/build/source-map/maps.ts";
import type { SourceMap } from "../../../../src/build/source-map/maps.ts";
import { component, compileScript } from "../compiling.ts";

const source = `<script lang="ts">
	let count = $state(0);
	function onScroll(event: { detail: { scrollTop: number } }) {
		'main thread';
		console.log(count, event.detail.scrollTop);
	}
	$effect(() => { import("./Lazy.svelte"); });
</script>
<scroll-view muted main-thread:onscroll={onScroll} ontap={() => count++}>
	{#each [1, 2] as row (row)}<list-item>{row}</list-item>{/each}
	<view main-thread:ontap={() => { 'main thread'; console.log(count); }}></view>
</scroll-view>
<video muted></video><view class="marker">{count}</view>`;

const sourceLines = source.split("\n");
/** The 0-based line of the source that holds `text`. */
const lineWith = (text: string): number => {
	const line = sourceLines.findIndex((candidate) => candidate.includes(text));
	expect(line, `a line with ${text}`).toBeGreaterThanOrEqual(0);
	return line;
};

/** The line and column of the source that `needle`'s first occurrence in `code` is mapped to. */
function mapped(code: string, map: SourceMap, needle: string): [number, number] {
	const at = code.indexOf(needle);
	expect(at, `${needle} in the code`).toBeGreaterThanOrEqual(0);
	const before = code.slice(0, at).split("\n");
	const line = before.length - 1;
	const column = before[line]!.length;
	const segments = decode(map.mappings)[line] ?? [];
	const segment = segments.filter((candidate) => candidate[0] <= column).at(-1) ?? segments[0];
	expect(segment, `a segment for ${needle}`).toBeDefined();
	return [segment![2]!, segment![3]!];
}

describe("the map of a component", () => {
	for (const thread of ["background", "main-thread"] as const) {
		describe(thread, () => {
			const compiled = component(source, { thread, sourceMap: true });

			it("names the file as written and holds its text", async () => {
				const { map } = await compiled;
				expect(map!.sources).toEqual(["Component.svelte"]);
				expect(map!.sourcesContent).toEqual([source]);
			});

			it("points the effect's import at its line", async () => {
				const { code, map } = await compiled;
				if (thread === "background")
					expect(mapped(code, map!, 'import("./Lazy.svelte")')[0]).toBe(lineWith("$effect"));
				else expect(mapped(code, map!, "__svelteLynxEffectImports")[0]).toBe(lineWith("$effect"));
			});

			it("points the bare attribute and the item-key at their lines", async () => {
				const { code, map } = await compiled;
				const needle = thread === "background" ? "'muted', true" : "$.attr('muted', true, true)";
				expect(mapped(code, map!, needle)[0]).toBe(lineWith("<scroll-view"));
				expect(mapped(code, map!, "'item-key'")[0]).toBe(lineWith("{#each"));
			});

			it("points the markup's main-thread function at its attribute, within the line as written", async () => {
				const { code, map } = await compiled;
				const [line, column] = mapped(code, map!, '_wkltId: "' + (await compiled).functionIds[1]);
				expect(line).toBe(lineWith("<view main-thread:ontap"));
				expect(column).toBeLessThanOrEqual(sourceLines[line]!.length);
			});

			it("keeps every position inside the file as written", async () => {
				const { map } = await compiled;
				for (const [index, segments] of decode(map!.mappings).entries())
					for (const segment of segments) {
						const [, , line, column] = segment;
						expect(line, `line ${index}`).toBeLessThan(sourceLines.length);
						expect(column, `line ${index}`).toBeLessThanOrEqual(sourceLines[line!]!.length);
					}
			});
		});
	}

	it("points the main thread's registrations at the function's own lines", async () => {
		const { code, map } = await component(source, { thread: "main-thread", sourceMap: true });
		expect(mapped(code, map!, "console.log(count, event.detail.scrollTop);")[0]).toBe(
			lineWith("console.log(count, event.detail"),
		);
		expect(mapped(code, map!, "'main thread'; console.log(count); });")[0]).toBe(
			lineWith("<view main-thread:ontap"),
		);
	});

	it("is not made when it is not asked for", async () => {
		expect((await component(source, { sourceMap: false })).map).toBeUndefined();
	});
});

describe("the map of a script", () => {
	const text = `const scale = 2;\n\nexport function double(value: number): number {\n  "main thread";\n  return value * scale;\n}\n\nexport const last = 1;\n`;

	it("maps the code after a function to where it was, and the registrations to the body", () => {
		const { code, map } = compileScript(text, { thread: "main-thread", sourceMap: true });
		const lines = text.split("\n");
		expect(mapped(code, map!, "export const last = 1;")[0]).toBe(
			lines.indexOf("export const last = 1;"),
		);
		expect(mapped(code, map!, "return value * scale;")[0]).toBe(
			lines.findIndex((line) => line.includes("return value")),
		);
	});

	it("names the file and holds its text", () => {
		const { map } = compileScript(text, { sourceMap: true });
		expect(map!.sources).toEqual(["handlers.ts"]);
		expect(map!.sourcesContent).toEqual([text]);
	});
});
