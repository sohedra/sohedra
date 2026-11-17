// A main-thread function written as a function declaration keeps what a declaration means: it
// exists before the line it is written on, `export function` exports it, and
// `export default function name` keeps `name`. Where its object cannot be made early enough, the
// build says so.

import { describe, expect, it } from "@rstest/core";

import { compileScript, component } from "../compiling.ts";
import { evaluate, readOutput } from "./output.ts";

/** Runs a module's background code as a function body that returns `result`. */
function load(source: string, result: string): unknown {
	const { code } = compileScript(source, { thread: "background" });
	const body = code.replace(/export default \w+;/, "").replace(/\bexport /g, "");
	return evaluate(`${body}\nreturn ${result};`);
}

/** The error the build throws for `source`, or undefined. */
function failure(source: string): (Error & { code?: string }) | undefined {
	try {
		compileScript(source, { file: "early.ts" });
	} catch (thrown) {
		return thrown as Error & { code?: string };
	}
	return undefined;
}

describe("a main-thread function declaration", () => {
	it("can be used above its line", () => {
		const source = `const handlers = { onScroll };\nfunction onScroll(event) {\n  "main thread";\n  return event;\n}\n`;
		expect(load(source, "handlers.onScroll")).toMatchObject({ _wkltId: expect.any(String) });
	});

	it("can be captured by a main-thread function above it", () => {
		const source = `export const run = () => {\n  "main thread";\n  return helper();\n};\nfunction helper() {\n  "main thread";\n  return 1;\n}\n`;
		expect(load(source, "run")).toMatchObject({ _c: { helper: { _wkltId: expect.any(String) } } });
	});

	it("can be used above its line inside a function", () => {
		const source = `export function make() {\n  const handlers = { onTap };\n  return handlers;\n  function onTap() {\n    "main thread";\n    return 1;\n  }\n}\n`;
		expect(load(source, "make().onTap")).toMatchObject({ _wkltId: expect.any(String) });
	});

	it("stays below what it captures, where nothing above uses it", () => {
		const source = `let scale = 2;\nscale = 3;\nfunction onTap() {\n  "main thread";\n  return scale;\n}\nexport const made = onTap;\n`;
		expect(load(source, "made")).toMatchObject({ _c: { scale: 3 } });
	});

	it("is exported by `export function` from a plain module", () => {
		const source = `export function onTap() {\n  "main thread";\n  return 1;\n}\nexport const again = onTap;\n`;
		const { code } = compileScript(source);
		expect(code).toMatch(/export const onTap = \{/);
		expect(load(source, "again")).toMatchObject({ _wkltId: expect.any(String) });
	});

	it("keeps its name in `export default function name`", () => {
		const source = `export default function handler() {\n  "main thread";\n  return 1;\n}\nexport const again = handler;\n`;
		for (const thread of ["background", "main-thread"] as const)
			expect(compileScript(source, { thread }).code).toMatch(/\bexport default handler;/);
		expect(load(source, "again")).toMatchObject({ _wkltId: expect.any(String) });
	});

	it("is exported by `export function` from a component's scripts", async () => {
		for (const source of [
			`<script module>export function onTap() { 'main thread'; return 1; }</script>\n<view main-thread:ontap={onTap}></view>`,
			`<script>export function onTap() { 'main thread'; return 1; }</script>\n<view main-thread:ontap={onTap}></view>`,
		]) {
			for (const thread of ["background", "main-thread"] as const) {
				const compiled = await component(source, { thread });
				expect(compiled.functionIds).toHaveLength(1);
				expect(readOutput(compiled.code).functions).toHaveLength(1);
			}
		}
	});

	it("can be used above its line in a component", async () => {
		const source = `<script>\n  const handlers = { onScroll };\n  function onScroll(event) { 'main thread'; return event; }\n</script>\n<scroll-view main-thread:onscroll={handlers.onScroll}></scroll-view>`;
		for (const thread of ["background", "main-thread"] as const) {
			const { code } = await component(source, { thread });
			const made = code.search(/let onScroll = /);
			expect(made).toBeGreaterThan(-1);
			expect(made).toBeLessThan(code.indexOf("const handlers = "));
		}
	});

	it("is an error where it is used above its line and captures what is set below that", () => {
		const source = `const scale = 2;\nconst handlers = { onScroll };\nfunction onScroll() {\n  "main thread";\n  return scale;\n}\n`;
		const error = failure(source);
		expect(error?.code).toBe("main_thread_function_used_early");
		expect(error?.message).toMatch(
			/^The main-thread function `onScroll` is used above its declaration, where it does not exist yet: it captures `scale`/,
		);
		expect(error?.message).toContain("early.ts:2:20");
	});

	it("is no error for a use in a function that runs later", () => {
		const source = `export function later() {\n  return onScroll;\n}\nconst scale = 2;\nfunction onScroll() {\n  "main thread";\n  return scale;\n}\n`;
		expect(failure(source)).toBeUndefined();
	});
});
