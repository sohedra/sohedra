// The spellings Lynx uses for events are not written in components: `ontap` is, and each old
// spelling is a compile error naming the attribute and the one to write instead.

import { describe, expect, it } from "@rstest/core";

import { docsLink } from "../../../../src/wire/index.ts";
import { inApp, withoutRoot } from "../app.ts";
import { component } from "../compiling.ts";

const file = inApp("Component.svelte");

const failure = async (source: string): Promise<Error & { code?: string }> => {
	const error = await component(source).catch((thrown: Error) => thrown);
	expect(error).toBeInstanceOf(Error);
	return error as Error;
};

describe("an old spelling of an event attribute", () => {
	it.each([
		["bindtap", "ontap", "bind"],
		["catchtap", "oncatchtap", "catch"],
		["capture-bindtap", "ontapcapture", "capture-bind"],
		["capture-catchtap", "oncatchtapcapture", "capture-catch"],
		["bindscrolltolower", "onscrolltolower", "bind"],
		// Any name that starts with `bind` or `catch` and holds an expression counts, as `online` is the
		// event `line` in Svelte.
		["catcher", "oncatcher", "catch"],
	])("%s is an error that names %s", async (name, replacement, spelling) => {
		const error = await failure(`<script>function f() {}</script>\n<view ${name}={f}></view>`);
		expect(error.code).toBe("event_attribute_renamed");
		expect(error.message.split("\n")[0]).toBe(
			`\`${name}\` reads as the old \`${spelling}\` spelling of an event attribute, which a component does not write.`,
		);
		expect(error.message).toContain(`${file}:2:7`);
		expect(error.message).toContain(`Write \`${replacement}\` instead.`);
		expect(error.message).toContain(docsLink("event_attribute_renamed"));
	});

	it.each([
		["main-thread:bindtap", "main-thread:ontap", "bind"],
		["main-thread:catchtap", "main-thread:oncatchtap", "catch"],
		["main-thread:capture-bindtap", "main-thread:ontapcapture", "capture-bind"],
		["main-thread:capture-catchtap", "main-thread:oncatchtapcapture", "capture-catch"],
	])("%s is an error that names %s", async (name, replacement, spelling) => {
		const error = await failure(
			`<script>function f() { 'main thread'; }</script>\n<view ${name}={f}></view>`,
		);
		expect(error.code).toBe("event_attribute_renamed");
		expect(error.message.split("\n")[0]).toBe(
			`\`${name}\` reads as the old \`${spelling}\` spelling of an event attribute, which a component does not write.`,
		);
		expect(error.message).toContain(`Write \`${replacement}\` instead.`);
	});

	it("`global-bind…` is an error that says there is no attribute for it", async () => {
		const error = await failure(
			`<script>function f() {}</script>\n<view global-bindtap={f}></view>`,
		);
		expect(error.code).toBe("global_event_attribute");
		expect(withoutRoot(error.message)).toMatchSnapshot();
		const prefixed = await failure(
			`<script>function f() { 'main thread'; }</script>\n<view main-thread:global-bindtap={f}></view>`,
		);
		expect(prefixed.code).toBe("global_event_attribute");
	});

	it("is an error on the main thread's copy as well", async () => {
		const error = await component("<view bindtap={f}></view>", { thread: "main-thread" }).catch(
			(thrown: Error) => thrown,
		);
		expect((error as Error).message).toContain("`bindtap` reads as the old `bind` spelling");
	});

	it("is found in an element inside a block, at its place in the file as written", async () => {
		const error = await failure(
			`<script>let a = [1]; function f() {}</script>\n{#each a as x (x)}\n  <view muted bindtap={f}></view>\n{/each}`,
		);
		expect(error.message).toContain(`${file}:3:15`);
	});

	it("leaves strings, components and names that do not start alike alone", async () => {
		const source = `<script>import Widget from "./W.svelte"; function f() {}</script>
<view binding="x" bindtap="y" captured={f}></view><Widget bindtap={f} />`;
		expect((await component(source)).code).toContain("Widget(");
	});
});
