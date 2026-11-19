// How Svelte's compile errors and warnings are printed: the plain sentence, file:line:column, the
// code frame and Svelte's link. Places are in the file as written, whatever the passes inserted.

import { describe, expect, it } from "@rstest/core";

import {
	compileError,
	compileWarnings,
	preprocessError,
} from "../../../../src/build/diagnostics/svelte-errors.ts";
import { docsLink } from "../../../../src/wire/index.ts";
import { inApp } from "../app.ts";
import { component } from "../compiling.ts";

const file = inApp("Component.svelte");

/** The error `source` fails with. */
async function failure(
	source: string,
	options: Parameters<typeof component>[1] = {},
): Promise<string> {
	const error = await component(source, options).then(
		() => undefined,
		(thrown: Error) => thrown,
	);
	expect(error, "a compile error").toBeInstanceOf(Error);
	return error!.message;
}

describe("compile errors", () => {
	const broken =
		"<script>let a = $state(0);</script>\n<view>\n  {#if a}\n  <text>{a}</text>\n</view>";

	it("carry the sentence first, then file:line:column, the code frame and Svelte's link", async () => {
		expect(await failure(broken)).toBe(
			[
				"`</view>` attempted to close an element that was not open",
				`${file}:5:1`,
				"",
				"4:   <text>{a}</text>",
				"5: </view>",
				"   ^",
				"",
				"https://svelte.dev/e/element_invalid_closing_tag",
			].join("\n"),
		);
	});

	it("point at the file as written when a pass inserted text before them", async () => {
		// `muted` becomes `muted={true}` before Svelte sees it: the `bind:` is further right in
		// Svelte's text than in the file.
		const source = "<video muted></video><view bind:this={el}></view>";
		const message = await failure(source);
		expect(message).toContain(`${file}:1:28`);
		expect(message).toContain("1: <video muted></video><view bind:this={el}></view>");
		// The caret is under `bind:` in the line as written.
		expect(message).toContain(`${" ".repeat("1: ".length + 27)}^`);
	});

	it("point at the file as written when a main-thread function moved out of the markup", async () => {
		const source = `<script>let a = 1;</script>
<view main-thread:ontap={() => { 'main thread'; console.log(a); }}></view>
{#if a}
<view></view>`;
		const message = await failure(source);
		expect(message).toContain(`${file}:3:1`);
		expect(message).toContain("3: {#if a}");
	});

	it("name the file when a preprocessor fails", async () => {
		const message = await failure("<view />", {
			preprocess: [
				{
					markup() {
						throw new Error("unexpected }");
					},
				},
			],
		});
		expect(message).toBe(
			[
				"A preprocessor failed on this file.",
				"unexpected }",
				file,
				"",
				"Fix the error the preprocessor reports, or check its options in svelte.config.js.",
				docsLink("preprocess_failed"),
			].join("\n"),
		);
	});
});

describe("warnings", () => {
	const warns = "<script>let a = 0;</script>\n<view ontap={() => a++}><text>{a}</text></view>";

	it("are reported with file:line:column and the code frame, once, from the background", async () => {
		const { warnings } = await component(warns, { thread: "background" });
		expect(warnings.length).toBeGreaterThan(0);
		const [first] = warnings;
		expect(first!.message).toContain(`${file}:`);
		expect(first!.message).toContain("1: <script>let a = 0;</script>");
		expect(first!.message).toContain("https://svelte.dev/e/");
		expect(first!.code).toMatch(/^[a-z_]+$/);
		expect((await component(warns, { thread: "main-thread" })).warnings).toEqual([]);
	});

	it("in node_modules are left out", async () => {
		const { warnings } = await component(warns, { file: "../node_modules/some-library/W.svelte" });
		expect(warnings).toEqual([]);
	});

	it("are located in the file as written", async () => {
		// `muted` is rewritten to `muted={true}`: the style is further right in Svelte's text.
		const source = "<video muted></video><style>.unused { color: red }</style>";
		const { warnings } = await component(source);
		const unused = warnings.find((warning) => warning.code === "css_unused_selector");
		expect(unused, "a css_unused_selector warning").toBeDefined();
		expect(unused!.message).toContain(`${file}:1:29`);
		expect(unused!.message).toContain(`1: ${source}`);
		expect(unused!.message).toContain(`${" ".repeat("1: ".length + 28)}^`);
	});
});

describe("errors that are not Svelte's", () => {
	const context = { source: { file, text: "<view></view>" }, locate: (offset: number) => offset };

	it("are left as they are", () => {
		const error = new Error("boom");
		expect(compileError(error, context)).toBe(error);
		expect(error.message).toBe("boom");
		expect(compileError("text", context)).toBe("text");
	});

	it("keep Svelte's text for a refused feature the build does not know", () => {
		const error = Object.assign(new Error("`@future` is not compatible with `customRenderer`"), {
			code: "incompatible_with_custom_renderer",
			start: { line: 1, column: 0, character: 0 },
		});
		expect((compileError(error, context) as Error).message).toBe(
			`\`@future\` is not compatible with \`customRenderer\`\n${file}:1:1\n\n1: <view></view>\n   ^`,
		);
	});

	it("give a preprocessor's error that is not an Error its text", () => {
		expect(preprocessError("plain text", file).message).toContain("plain text");
	});

	it("give a warning without a place its message alone", () => {
		const [warning] = compileWarnings([{ code: "x", message: "something" } as never], context);
		expect(warning).toEqual({ code: "x", message: "something" });
	});
});
