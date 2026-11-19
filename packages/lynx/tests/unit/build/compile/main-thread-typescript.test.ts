// A component's main-thread functions written in TypeScript: the main thread's copy carries them
// with their types removed by Node's own stripper, every position kept. What is more than a type
// (an `enum`, a `namespace`, a parameter property, a decorator) is refused with its place.

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "@rstest/core";
import * as acorn from "acorn";

import { stripMainThreadTypes } from "../../../../src/build/compile/strip-types.ts";
import { decode } from "../../../../src/build/source-map/maps.ts";
import { component } from "../compiling.ts";

/** The main thread's registrations of a compiled copy. */
const registrations = (code: string): string =>
	code.slice(code.indexOf("import { loadWorkletRuntime"));

/** A `lang="ts"` component whose one main-thread function has `body`. */
const withFunction = (body: string): string =>
	`<script lang="ts">\n\tfunction probe() {\n\t\t"main thread";\n${body}\n\t}\n</script>\n<view main-thread:ontap={probe}></view>`;

/** A program's tree without positions, to compare two programs' structure. */
function structure(code: string): unknown {
	const tree = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module" });
	return JSON.parse(
		JSON.stringify(tree, (key, value: unknown) =>
			["start", "end", "raw"].includes(key) ? undefined : value,
		),
	);
}

describe("a main-thread function's TypeScript, on the main thread", () => {
	it("is gone, and a name written with an escape keeps its parameter", async () => {
		const { code } = await component(
			withFunction("\t\tconst one = ((\\u0061?: number): number => 1)();\n\t\tvoid one;"),
			{ thread: "main-thread" },
		);
		const body = /"main thread";([\s\S]*?)\}\);\s*\}\s*$/.exec(registrations(code))![1]!;
		expect(structure(body)).toEqual(structure("const one = ((\\u0061) => 1)();\nvoid one;"));
	});

	it("keeps the line of each statement, which the map points at", async () => {
		const source = withFunction(
			"\t\tconst make = () => {\n\t\t\treturn <\n\t\t\t\tT,\n\t\t\t>(x: T) => x;\n\t\t};\n\t\tconsole.log(make, 'MARKER');",
		);
		const { code, map } = await component(source, { thread: "main-thread", sourceMap: true });
		const at = code.indexOf("console.log(make, 'MARKER')");
		const line = code.slice(0, at).split("\n").length - 1;
		const [segment] = decode(map!.mappings)[line] ?? [];
		expect(segment![2]).toBe(source.split("\n").findIndex((text) => text.includes("MARKER")));
	});

	it.each([
		["enum Color { Red }", "an `enum`", ":4:3"],
		["namespace Shapes { export const one = 1; }", "a `namespace`", ":4:3"],
		["class Box { constructor(private size: number) {} }", "a parameter property", ":4:27"],
	])("refuses %s, saying what to write instead, with its place", async (written, named, place) => {
		const failed = component(withFunction(`\t\t${written}`), { thread: "main-thread" });
		await expect(failed).rejects.toMatchObject({ code: "main_thread_function_typescript" });
		const message = await failed.then(
			() => "",
			(error: Error) => error.message,
		);
		expect(message).toContain(`A main-thread function cannot use ${named}`);
		expect(message).toContain(`Component.svelte${place}`);
	});
});

describe("Node's stripper", () => {
	it("is asked for, with the Node version it needs, only where there is TypeScript to strip", () => {
		const source = { file: "src/Card.svelte", text: '<script lang="ts"></script>' };
		expect(() =>
			stripMainThreadTypes("const a: number = 1;", { strip: undefined, source, unsupported: [] }),
		).toThrow(expect.objectContaining({ code: "typescript_stripper_missing" }));
		expect(() =>
			stripMainThreadTypes("const a: number = 1;", { strip: undefined, source, unsupported: [] }),
		).toThrow(/Node\.js 22\.13 or later[\s\S]*src\/Card\.svelte/);
	});

	it("says nothing of its being experimental, and lets other warnings through", () => {
		const module = pathToFileURL(
			new URL("../../../../src/build/compile/strip-types.ts", import.meta.url).pathname,
		).href;
		const script = `
			const { nodeTypeStripper, stripMainThreadTypes } = await import(${JSON.stringify(module)});
			const source = { file: "A.svelte", text: "" };
			const out = stripMainThreadTypes("const a: number = 1;", { strip: nodeTypeStripper(), source, unsupported: [] });
			process.emitWarning("another warning", "ExperimentalWarning");
			console.log(JSON.stringify(out));`;
		const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
			encoding: "utf8",
		});
		expect(run.status, run.stderr).toBe(0);
		expect(run.stdout.trim()).toBe(JSON.stringify("const a         = 1;"));
		expect(run.stderr).not.toContain("stripTypeScriptTypes");
		expect(run.stderr).toContain("another warning");
	});
});
