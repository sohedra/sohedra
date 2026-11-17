// Styles set from code: a property set with `setStyleProperty` is not wiped by the next write of
// the element's `style`, which replaces every inline style in Lynx (`__SetInlineStyles`). The
// write's own properties win; code that sets a property to null or "" gives it back to `style`.

import { describe, expect, it } from "@rstest/core";

import type { ElementNode } from "../../src/background/renderer/element.ts";
import CodeStyles from "../fixtures/threads/CodeStyles.svelte";
import { startSveltePage } from "./svelte-page.ts";

async function codeStyles() {
	const handles: Record<string, unknown> = {};
	const page = startSveltePage(CodeStyles, { props: () => ({ handles }) });
	await page.settle();
	const tap = async (token: string) => {
		page.engine.dispatch(page.byClass(token), { type: "tap" });
		await page.settle();
	};
	const style = async (styles: Record<string, string | null>) => {
		page.asBackground(() => (handles["box"] as ElementNode).setStyleProperties(styles));
		await page.settle();
	};
	const inline = (token: string) =>
		Object.fromEntries(page.engine.state(page.byClass(token)).inlineStyles);
	return { page, tap, style, inline };
}

describe("a style set from code", () => {
	it("stays through the next writes of the element's style", async () => {
		const { tap, style, inline } = await codeStyles();
		await style({ transform: "translateX(40px)" });
		expect(inline("box")).toEqual({ color: "red", transform: "translateX(40px)" });
		await tap("recolor");
		expect(inline("box")).toEqual({ color: "blue", transform: "translateX(40px)" });
		await tap("recolor");
		expect(inline("box")).toEqual({ color: "red", transform: "translateX(40px)" });
	});

	it("gives way to a write that sets the same property, and does not come back", async () => {
		const { tap, style, inline } = await codeStyles();
		await style({ width: "50px", transform: "scale(2)" });
		await tap("widen");
		expect(inline("box")).toEqual({ color: "red", width: "10px", transform: "scale(2)" });
		await tap("widen");
		expect(inline("box")).toEqual({ color: "red", transform: "scale(2)" });
	});

	it("goes back to style when code sets it to null or an empty value", async () => {
		const { tap, style, inline } = await codeStyles();
		await style({ transform: "scale(2)", opacity: "0.5" });
		await style({ transform: null, opacity: "" });
		await tap("recolor");
		expect(inline("box")).toEqual({ color: "blue" });
	});
});

describe("an element code never styled", () => {
	it("costs no call to Lynx when its style is written", async () => {
		const { page, tap, style, inline } = await codeStyles();
		await style({ transform: "scale(2)" });
		const functions = page.engine.functions;
		const add = functions.__AddInlineStyle;
		const added: unknown[] = [];
		functions.__AddInlineStyle = (element, ...rest) => {
			added.push(element);
			add(element, ...rest);
		};
		await tap("recolor");
		functions.__AddInlineStyle = add;
		expect(added).toEqual([page.byClass("box")]);
		expect(inline("plain")).toEqual({ color: "blue" });
		expect(page.errors).toEqual([]);
	});
});
