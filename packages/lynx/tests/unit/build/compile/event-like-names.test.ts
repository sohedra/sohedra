// Attribute names that look like events: what Svelte itself does with them, and that the build
// does the same. Svelte's rule: any attribute whose name starts with `on` and has one expression
// is an event, whatever follows `on`; a string under such a name is a compile error in markup.

import { describe, expect, it } from "@rstest/core";

import { component } from "../compiling.ts";

describe("online={x} in markup", () => {
	it("is the event `line` in Svelte, and the build binds it as `bindline` on the first frame", async () => {
		const source = "<script>let f = () => {};</script><view online={f}></view>";
		// The background listens for the event `line`, as Svelte does.
		const background = await component(source, { thread: "background" });
		expect(background.code).toMatch(/\$\.event\(\s*["']line["']/);
		expect((await component(source, { thread: "main-thread" })).code).toContain(
			"$.attr('bindline', f)",
		);
	});

	it("is a compile error with a string in Svelte, which the build leaves to Svelte", async () => {
		const error = await component('<view online="x"></view>').catch((thrown: Error) => thrown);
		expect((error as Error).message).toMatch(/^Event attribute must be a JavaScript expression/);
	});
});
