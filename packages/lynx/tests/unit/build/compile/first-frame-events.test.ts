// For the first frame, `on…` attributes on elements are written as Lynx binds them, and a
// main-thread function's `main-thread:on…` attribute in the same spelling after its prefix. Any
// name that starts with `on` and holds one expression counts, as in Svelte.

import { describe, expect, it } from "@rstest/core";

import { component } from "../compiling.ts";

const mainThread = async (source: string): Promise<string> =>
	(await component(source, { thread: "main-thread" })).code;

describe("the first frame's event attributes", () => {
	it.each([
		["ontap", "bindtap"],
		["ontapcapture", "capture-bindtap"],
		["oncatchtap", "catchtap"],
		["oncatchtapcapture", "capture-catchtap"],
		// Svelte's two events that end in `capture` without being capture ones.
		["ongotpointercapture", "bindgotpointercapture"],
		["onlostpointercapture", "bindlostpointercapture"],
		["ongotpointercapturecapture", "capture-bindgotpointercapture"],
		// `catch` alone is an event name, not the prefix.
		["oncatch", "bindcatch"],
		["oncatchcapture", "capture-bindcatch"],
		["oncapture", "capture-bind"],
		// Any case, and any name that starts with `on`.
		["onTap", "bindTap"],
		["online", "bindline"],
	])("write %s={f} as %s", async (name, lynx) => {
		const code = await mainThread(`<script>function f() {}</script><view ${name}={f}></view>`);
		expect(code).toContain(`$.attr('${lynx}', f)`);
	});

	it("write the shorthand, a quoted expression, and svelte:element", async () => {
		const code = await mainThread(
			`<script>function ontap() {} function f() {}</script><view {ontap} oncatchtap="{f}"></view><svelte:element this="view" ontap={f} />`,
		);
		expect(code).toContain("$.attr('bindtap', ontap)");
		expect(code).toContain("$.attr('catchtap', f)");
		expect(code).toMatch(/\$\.attr\('bindtap', f\)/);
	});

	it("write a main-thread function's event the same way after its prefix", async () => {
		const code = await mainThread(`<script>function f() { 'main thread'; }
		</script><view main-thread:ontap={f} main-thread:oncatchscrollcapture={f}></view>`);
		expect(code).toContain("$.attr('main-thread:bindtap', f)");
		expect(code).toContain("$.attr('main-thread:capture-catchscroll', f)");
	});

	it("leave bare names and components alone", async () => {
		const code = await mainThread(
			`<script>import Widget from "./W.svelte"; function f() {}</script><view onscroll></view><Widget ontap={f} />`,
		);
		expect(code).not.toContain("bindscroll");
		expect(code).not.toContain("bindtap");
		expect(code).toContain("Widget(");
	});

	it("are left to Svelte on the background, where the renderer binds the event", async () => {
		const { code } = await component(`<script>function f() {}</script><view ontap={f}></view>`, {
			thread: "background",
		});
		expect(code).toContain("$.event('tap', view, f)");
		expect(code).not.toContain("bindtap");
	});
});
