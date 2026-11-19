// What the first frame draws, through a component's own first-frame copy: attributes as the
// background sets them (camelCase names, typed values, an object), events only for functions, a
// Lynx input's first value, siblings after a void `<input>`, a component's `--x` props, and
// `$props.id()`. The background then adopts every element, with nothing that differs.

import { describe, expect, it } from "@rstest/core";

import CssVariables from "../fixtures/threads/CssVariables.svelte";
import drawCssVariables from "../fixtures/threads/CssVariables.svelte?first-frame";
import FrameAttributes from "../fixtures/threads/FrameAttributes.svelte";
import drawFrameAttributes from "../fixtures/threads/FrameAttributes.svelte?first-frame";
import FrameIds from "../fixtures/threads/FrameIds.svelte";
import drawFrameIds from "../fixtures/threads/FrameIds.svelte?first-frame";
import { startSveltePage } from "./svelte-page.ts";

describe("the first frame's attributes", () => {
	function drawn() {
		const page = startSveltePage(FrameAttributes, {
			firstFrame: { draw: drawFrameAttributes },
		});
		return { page, drawn: page.engine.all() };
	}

	it("keeps camelCase names and typed values, in markup and in a spread", () => {
		const { page } = drawn();
		const camel = page.engine.state(page.byClass("camel"));
		expect(camel.attrs["maxLength"]).toBe(4);
		expect(camel.attrs["autoPlay"]).toBe(true);
		expect(camel.attrs["customName"]).toBe("x");
		expect(camel.attrs["catchphrase"]).toBe("y");
		expect(camel.attrs["spreadName"]).toBe("z");
		expect(camel.dataset).toEqual({ info: { a: 1 } });
		const typed = page.engine.state(page.byClass("typed"));
		expect(typed.attrs["span-count"]).toBe(2);
		expect(typed.attrs["sticky-top"]).toBe(false);
		expect(typed.attrs["accessibility-actions"]).toEqual(["a", "b"]);
		expect(typed.dataset).toEqual({ quote: "it's <5>" });
	});

	it("listens for a function's event, and for no attribute that only looks like one", () => {
		const { page } = drawn();
		const listeners = page.engine.state(page.byClass("camel")).listeners;
		expect(listeners.map((listener) => listener.name)).toEqual(["tap"]);
	});

	it("gives an input its value as its first value, and keeps what follows it outside it", () => {
		const { page } = drawn();
		const field = page.engine.state(page.byClass("field"));
		expect(field.attrs["default-value"]).toBe("typed");
		expect(page.byClass("field").childNodes).toHaveLength(0);
		expect(page.engine.state(page.byClass("area")).attrs["default-value"]).toBe("area text");
		expect(page.byClass("after-input").parentNode).toBe(page.byClass("field").parentNode);
	});

	it("is adopted whole by the background", async () => {
		const { page, drawn: elements } = drawn();
		await page.settle();
		expect(page.engine.all()).toEqual(elements);
		expect(page.errors).toEqual([]);
	});
});

describe("the first frame of a component given --x props", () => {
	it("wraps it in a <view> with the props, as the background does, and is adopted", async () => {
		const page = startSveltePage(CssVariables, { firstFrame: { draw: drawCssVariables } });
		const elements = page.engine.all();
		const wrapper = page.byClass("child-root").parentNode as never;
		expect(page.engine.state(wrapper).tag).toBe("view");
		expect(page.engine.state(wrapper).inlineStyles.get("--tone")).toBe("green");
		await page.settle();
		expect(page.engine.all()).toEqual(elements);
		expect(page.errors).toEqual([]);
	});
});

describe("$props.id() in the first frame", () => {
	it("is the id the background gives, so the frame is adopted with it", async () => {
		const page = startSveltePage(FrameIds, { firstFrame: { draw: drawFrameIds } });
		const elements = page.engine.all();
		const drawnId = page.engine.state(page.byClass("labelled")).id;
		expect(drawnId).toMatch(/^lynx-s\d+$/);
		await page.settle();
		expect(page.engine.all()).toEqual(elements);
		expect(page.engine.state(page.byClass("labelled")).id).toBe(drawnId);
		expect(page.engine.texts()).toEqual([drawnId]);
		expect(page.errors).toEqual([]);
	});
});
