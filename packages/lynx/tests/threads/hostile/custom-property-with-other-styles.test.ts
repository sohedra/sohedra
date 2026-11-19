// A custom property with another style in one update, on an element the first frame drew: from code
// with another code style, or in a `style` write while code holds another style. Lynx tells the
// children of a custom property's change in the style text only when the flush reads it, so the
// child would keep the old value. Hydration shares the frame's code styles with the page, so the
// drawn element's custom properties reach its children as on a page drawn with no first frame.

import { describe, expect, it } from "@rstest/core";

import type { ElementNode } from "../../../src/background/renderer/element.ts";
import FrameTone from "../../fixtures/threads/FrameTone.svelte";
import drawFrameTone from "../../fixtures/threads/FrameTone.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";

const FRAMES = [
	["with no first frame", false],
	["drawn by the first frame", true],
] as const;

describe.each(FRAMES)("a custom property on a page %s", (_, drawn) => {
	async function toned(atMount?: Record<string, string>) {
		const handles: Record<string, unknown> = {};
		const props = { handles, ...(atMount && { atMount }) };
		const page = startSveltePage(FrameTone, {
			props: () => props,
			...(drawn && { firstFrame: { draw: drawFrameTone, props: { handles: {} } } }),
		});
		await page.settle();
		expect(page.errors).toEqual([]);
		const node = handles["toned"] as ElementNode;
		const tone = () =>
			page.engine.functions.__GetComputedStyleByKey(page.byClass("toned-child"), "--tone");
		const update = async (change: () => void) => {
			page.asBackground(change);
			await page.settle();
		};
		const retone = handles["retone"] as (next: string | null) => void;
		return { page, node, tone, update, retone };
	}

	it("reaches the child with another code style in the first patch", async () => {
		const { page, tone } = await toned({ "--tone": "green", transform: "scale(2)" });
		expect(tone()).toBe("green");
		expect(page.engine.state(page.byClass("toned")).inlineStyles.get("transform")).toBe("scale(2)");
	});

	it("reaches the child with another code style in one update", async () => {
		const { node, tone, update } = await toned();
		expect(tone()).toBe("red");
		await update(() => node.setStyleProperties({ "--tone": "green", transform: "scale(2)" }));
		expect(tone()).toBe("green");
	});

	it("reaches the child in a style write while code holds another style", async () => {
		const { node, tone, update, retone } = await toned();
		await update(() => {
			node.setStyleProperty("transform", "scale(2)");
			retone("blue");
		});
		expect(tone()).toBe("blue");
	});

	it("goes from the child when the element's style is emptied", async () => {
		const { tone, update, retone } = await toned();
		await update(() => retone(null));
		expect(tone()).toBe("");
	});
});
