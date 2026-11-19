// CSS custom properties given to a component (`<Child --tone="green" />`): Svelte wraps the
// component in an element that holds the properties.

import { describe, expect, it } from "@rstest/core";

import type { ElementNode } from "../../src/background/renderer/element.ts";
import type { LynxElement } from "../../src/testing/index.ts";
import CssVariables from "../fixtures/threads/CssVariables.svelte";
import CssWrapperCall from "../fixtures/threads/CssWrapperCall.svelte";
import { startSveltePage } from "./svelte-page.ts";

async function cssVariables() {
	const page = startSveltePage(CssVariables);
	await page.settle();
	const styleOf = (element: LynxElement) =>
		Object.fromEntries(page.engine.state(element).inlineStyles);
	const tagOf = (element: LynxElement) => page.engine.state(element).tag;
	const wrapperIn = (parent: LynxElement) => parent.firstChild as LynxElement;
	return { page, styleOf, tagOf, wrapperIn };
}

describe("<Child --x={…}>", () => {
	it("puts the properties on one element that holds the component's elements", async () => {
		const { page, styleOf, wrapperIn } = await cssVariables();
		const wrapper = wrapperIn(page.byClass("host"));
		expect(styleOf(wrapper)).toMatchObject({ "--tone": "green", "--size": "1px" });
		expect(wrapper.firstChild).toBe(page.byClass("child-root"));
		expect(page.errors).toEqual([]);
	});

	it("makes the holder a <view>, in an element and at the root of the page", async () => {
		const { page, styleOf, tagOf, wrapperIn } = await cssVariables();
		expect(tagOf(wrapperIn(page.byClass("host")))).toBe("view");
		const atRoot = page.engine
			.all()
			.find((element) => styleOf(element)["--root"] === "1") as LynxElement;
		expect(tagOf(atRoot)).toBe("view");
		const inside = page.engine.all(atRoot).map((element) => page.engine.state(element).classes);
		expect(inside).toContain("child-root");
	});

	it("gives the holder, which Lynx leaves layout-only, a UI for a UI method", async () => {
		const handles: Record<string, unknown> = {};
		const page = startSveltePage(CssWrapperCall, { props: () => ({ handles }) });
		await page.settle();
		const element = page.byClass("host").firstChild as LynxElement;
		const codes: number[] = [];
		page.engine.functions.__InvokeUIMethod(element, "boundingClientRect", {}, (result) =>
			codes.push(result.code),
		);
		await page.settle();
		expect(codes).toEqual([6]);
		const wrapper = (handles["host"] as ElementNode).last as ElementNode;
		const answer = page.asBackground(() => wrapper.invoke("boundingClientRect"));
		answer.catch(() => {});
		await page.settle();
		await expect(answer).resolves.toBeNull();
		expect(page.engine.state(element).attrs["flatten"]).toBe(false);
	});

	it("follows the values the properties are given", async () => {
		const { page, styleOf, wrapperIn } = await cssVariables();
		page.engine.dispatch(page.byClass("grow"), { type: "tap" });
		await page.settle();
		expect(styleOf(wrapperIn(page.byClass("host")))).toMatchObject({
			"--tone": "green",
			"--size": "2px",
		});
	});
});
