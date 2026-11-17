// The main thread's copy of a CSS file: the background layer's copy carries the CSS into the
// template, so the main thread's is dropped, and a CSS Module keeps its class-name map.

import { describe, expect, it } from "@rstest/core";

import ignoreCssLoader from "../../../../src/build/loaders/ignore-css.ts";
import { runLoader } from "./loader-context.ts";

describe("the main thread's CSS", () => {
	it("is an empty module for plain CSS", async () => {
		const { code } = await runLoader(
			ignoreCssLoader,
			"___CSS_LOADER_EXPORT___.push([module.id, '.a{}'])",
			{
				file: "app.css",
			},
		);
		expect(code).toBe("export {}");
	});

	it("keeps the class names of a CSS Module, which the first frame renders", async () => {
		const source = 'export default { "a": "a_1x" };';
		expect((await runLoader(ignoreCssLoader, source, { file: "app.module.css" })).code).toBe(
			source,
		);
	});
});
