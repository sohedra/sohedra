// Part's element: the attributes it adds for a tag, the props it leaves out, and a style it writes
// property by property.
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";

import PartDemo from "./fixtures/kernel-part-demo.svelte";

/** `Part` rendering `tag` with `props`, and its element (it has no role or name to find it by). */
async function setup(tag: string, props: Record<string, unknown> = {}) {
	const screen = await render(PartDemo, { tag, user: props, state: {} });
	return { screen, element: screen.container.querySelector<HTMLElement>(tag)! };
}

describe("Part", () => {
	it('adds type="button" to a button unless provided', async () => {
		expect((await setup("button")).element.getAttribute("type")).toBe("button");
		expect((await setup("button", { type: "submit" })).element.getAttribute("type")).toBe("submit");
	});

	it('adds alt="" to an img unless provided', async () => {
		expect((await setup("img")).element.getAttribute("alt")).toBe("");
		expect((await setup("img", { alt: "Avatar" })).element.getAttribute("alt")).toBe("Avatar");
	});

	it("adds no default attributes to other elements", async () => {
		expect((await setup("div", { id: "plain" })).element.getAttributeNames()).toEqual(["id"]);
	});

	it("drops DOM-property-only keys and a meaningless value from the spread", async () => {
		const { element } = await setup("div", {
			defaultValue: "a",
			defaultChecked: true,
			indeterminate: true,
			selected: true,
			value: "x",
		});
		expect(element.getAttributeNames()).toEqual([]);
	});

	describe("style", () => {
		it("updates only the properties it sets, leaving inline styles set by others", async () => {
			const { screen, element } = await setup("div", { style: "color: red; --size: 10px" });
			// Another script's inline style, which the part must leave alone.
			element.style.setProperty("--accent", "blue");

			await screen.rerender({ user: { style: "color: green; --size: 20px" } });

			expect(element.style.getPropertyValue("color")).toBe("green");
			expect(element.style.getPropertyValue("--size")).toBe("20px");
			expect(element.style.getPropertyValue("--accent")).toBe("blue");
		});

		it("removes a property it set once the style drops it, and keeps priorities", async () => {
			const { screen, element } = await setup("div", {
				style: "color: red; width: 10px !important",
			});
			expect(element.style.getPropertyPriority("width")).toBe("important");

			await screen.rerender({ user: { style: "width: 20px" } });

			expect(element.style.getPropertyValue("color")).toBe("");
			expect(element.style.getPropertyValue("width")).toBe("20px");
			expect(element.style.getPropertyPriority("width")).toBe("");
		});

		it("lets a later declaration of a property win, as a style attribute does", async () => {
			const { element } = await setup("div", {
				style: "color: red; background: url(data:image/png;base64,AAAA); color: blue",
			});
			expect(element.style.getPropertyValue("color")).toBe("blue");
			expect(element.style.getPropertyValue("background-image")).toContain(
				"data:image/png;base64,AAAA",
			);
		});
	});
});
