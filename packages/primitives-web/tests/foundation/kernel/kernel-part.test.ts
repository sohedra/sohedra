// The element a part renders, with its tag defaults: fixtures/render-element.svelte renders `Part`
// with a `tag`, `props` and `state`, the props handed over as the user's.
import { describe, expect, it } from "vitest";

import { createRenderer } from "../../shim/index.js";
import RenderElement from "./fixtures/kernel-render-element.svelte";

describe("RenderElement", () => {
	const { render } = createRenderer();

	async function renderElement(tag: string, props: Record<string, unknown> = {}) {
		const { container } = await render(RenderElement, { tag, props, state: {} });
		return container.querySelector(tag)!;
	}

	it('adds type="button" to a button unless provided', async () => {
		expect((await renderElement("button")).getAttribute("type")).toBe("button");
		expect((await renderElement("button", { type: "submit" })).getAttribute("type")).toBe("submit");
	});

	it('adds alt="" to an img unless provided', async () => {
		expect((await renderElement("img")).getAttribute("alt")).toBe("");
		expect((await renderElement("img", { alt: "Avatar" })).getAttribute("alt")).toBe("Avatar");
	});

	it("adds no default attributes to other elements", async () => {
		expect((await renderElement("div", { id: "plain" })).getAttributeNames()).toEqual(["id"]);
	});

	it("drops DOM-property-only keys and a meaningless value from the spread", async () => {
		const div = await renderElement("div", {
			defaultValue: "a",
			defaultChecked: true,
			indeterminate: true,
			selected: true,
			value: "x",
		});
		expect(div.getAttributeNames()).toEqual([]);
	});

	describe("style", () => {
		it("updates only the properties it sets, leaving inline styles set by others", async () => {
			const { container, setProps } = await render(RenderElement, {
				tag: "div",
				props: { style: "color: red; --size: 10px" },
				state: {},
			});
			const div = container.querySelector("div")!;
			div.style.setProperty("--accent", "blue");

			await setProps({ props: { style: "color: green; --size: 20px" } });

			expect(div.style.getPropertyValue("color")).toBe("green");
			expect(div.style.getPropertyValue("--size")).toBe("20px");
			expect(div.style.getPropertyValue("--accent")).toBe("blue");
		});

		it("removes a property it set once the style drops it, and keeps priorities", async () => {
			const { container, setProps } = await render(RenderElement, {
				tag: "div",
				props: { style: "color: red; width: 10px !important" },
				state: {},
			});
			const div = container.querySelector("div")!;
			expect(div.style.getPropertyPriority("width")).toBe("important");

			await setProps({ props: { style: "width: 20px" } });

			expect(div.style.getPropertyValue("color")).toBe("");
			expect(div.style.getPropertyValue("width")).toBe("20px");
			expect(div.style.getPropertyPriority("width")).toBe("");
		});

		it("lets a later declaration of a property win, as a style attribute does", async () => {
			const { container } = await render(RenderElement, {
				tag: "div",
				props: { style: "color: red; background: url(data:image/png;base64,AAAA); color: blue" },
				state: {},
			});
			const div = container.querySelector("div")!;
			expect(div.style.getPropertyValue("color")).toBe("blue");
			expect(div.style.getPropertyValue("background-image")).toContain(
				"data:image/png;base64,AAAA",
			);
		});
	});
});
