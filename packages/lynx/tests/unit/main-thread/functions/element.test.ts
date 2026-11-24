// The element main-thread functions see: one wrapper for one engine element, the tree questions in
// the background node's names, and styles that a write of `style` keeps.

import { describe, expect, it } from "@rstest/core";

import { createCodeStyles } from "../../../../src/main-thread/code-styles.ts";
import { createFlattening } from "../../../../src/main-thread/flatten.ts";
import {
	createElements,
	MainThreadElement,
} from "../../../../src/main-thread/functions/element.ts";
import { installGlobals } from "../../../../src/testing/globals.ts";
import { engineForEach, smallPage } from "../../testing/engine/engine-fixture.ts";

const engine = engineForEach();

function wrappers(options: { later?: (run: () => void) => void } = {}) {
	const restore = installGlobals({ ...engine().functions });
	const styles = createCodeStyles();
	const changes: string[] = [];
	const reports: unknown[] = [];
	const small = smallPage(engine());
	const elements = createElements({
		styles,
		flattening: createFlattening(),
		changed: (what, detail) => void changes.push(`${what} ${String(detail)}`),
		invoke: options.later ?? ((run) => run()),
		idOf: (element) => (element === small.inner ? 7 : undefined),
		report: (error) => void reports.push(error),
	});
	return { elements, styles, changes, reports, restore, ...small };
}

describe("an element as main-thread functions see it", () => {
	it("is one object for one engine element, until the page forgets it", () => {
		const { elements, inner, restore } = wrappers();
		const wrapper = elements.wrap(inner);
		expect(elements.wrap(inner)).toBe(wrapper);
		expect(elements.size).toBe(1);
		elements.forget(inner);
		expect(elements.size).toBe(0);
		expect(elements.wrap(inner)).not.toBe(wrapper);
		restore();
	});

	it("answers parentElement, contains and dataset as the background's node does", () => {
		const { elements, page, outer, inner, restore } = wrappers();
		engine().functions.__SetDataset(inner, { role: "handle", n: 3 });
		const wrapped = elements.wrap(inner);
		expect(wrapped.parentElement).toBe(elements.wrap(outer));
		expect(elements.wrap(page).parentElement).toBeNull();
		expect(elements.wrap(outer).contains(wrapped)).toBe(true);
		expect(wrapped.contains(wrapped)).toBe(true);
		expect(wrapped.contains(elements.wrap(outer))).toBe(false);
		expect(wrapped.contains({})).toBe(false);
		expect(wrapped.dataset).toEqual({ role: "handle", n: 3 });
		expect(JSON.parse(JSON.stringify(wrapped))).toEqual({
			element: 7,
			id: "inner",
			uid: engine().state(inner).uid,
			dataset: { role: "handle", n: 3 },
		});
		expect(Object.keys(wrapped)).toEqual([]);
		restore();
	});

	it("sets styles that a later write of style keeps, and says what it changed", () => {
		const { elements, styles, inner, changes, restore } = wrappers();
		elements.wrap(inner).setStyleProperty("transform", "translateX(4px)");
		styles.write(inner, "width: 10px");
		const inline = engine().state(inner).inlineStyles;
		expect(inline.get("transform")).toBe("translateX(4px)");
		expect(inline.get("width")).toBe("10px");
		expect(changes).toEqual(["setStyleProperty transform"]);
		restore();
	});

	it("is gone once the page forgets its element: it answers nothing, and its changes are refused", async () => {
		const { elements, outer, inner, reports, restore } = wrappers();
		const kept = elements.wrap(inner);
		elements.forget(inner);
		expect(kept.parentElement).toBeNull();
		expect(elements.size).toBe(0);
		expect(elements.wrap(outer).contains(kept)).toBe(false);
		expect([kept.dataset, kept.getAttribute("id"), kept.getAttributeNames()]).toEqual([
			{},
			null,
			[],
		]);
		expect([
			kept.querySelector("*"),
			kept.querySelectorAll("*"),
			kept.getComputedStyleProperty("width"),
		]).toEqual([null, [], ""]);
		expect(JSON.parse(JSON.stringify(kept))).toEqual({ element: 0 });
		kept.setAttribute("late", "yes");
		kept.setStyleProperty("width", "1px");
		kept.setStyleProperties({ height: "1px" });
		expect(engine().state(inner).attrs["late"]).toBeUndefined();
		expect(reports).toHaveLength(3);
		expect(() => kept.animate([{ opacity: 0 }])).toThrow(
			expect.objectContaining({ code: "element_released" }),
		);
		await expect(kept.invoke("boundingClientRect")).rejects.toMatchObject({
			code: "element_released",
		});
		restore();
	});

	it("sets and reads its attributes and styles through the engine", () => {
		const { elements, inner, changes, restore } = wrappers();
		const wrapped = elements.wrap(inner);
		wrapped.setAttribute("aria-label", "Close");
		wrapped.setStyleProperties({ width: "4px", height: "6px" });
		expect(wrapped.getAttribute("aria-label")).toBe("Close");
		expect(wrapped.getAttributeNames()).toContain("aria-label");
		expect(wrapped.getComputedStyleProperty("width")).toBe(
			engine().functions.__GetComputedStyleByKey(inner, "width"),
		);
		expect(changes).toEqual(["setAttribute aria-label", "setStyleProperties width, height"]);
		restore();
	});

	it("finds elements under it, as wrappers", () => {
		const { elements, outer, inner, restore } = wrappers();
		const found = elements.wrap(outer).querySelector("#inner");
		expect(found).toBe(elements.wrap(inner));
		expect(elements.wrap(outer).querySelectorAll("#inner")).toEqual([found]);
		expect(elements.wrap(inner).querySelector("#none")).toBeNull();
		expect(found).toBeInstanceOf(MainThreadElement);
		restore();
	});

	it("runs a UI method where the page says, and rejects with the catalogue's message", async () => {
		const later: (() => void)[] = [];
		const { elements, inner, restore } = wrappers({ later: (run) => void later.push(run) });
		engine().functions.__FlushElementTree();
		const answer = elements.wrap(inner).invoke("boundingClientRect");
		expect(later).toHaveLength(1);
		engine().respondWith(() => ({ code: 4 }));
		later[0]!();
		await expect(answer).rejects.toMatchObject({ code: "ui_method_failed" });
		expect(engine().state(inner).attrs["flatten"]).toBe(false);
		restore();
	});

	it("animates through the engine, and gets a view of its own", () => {
		const { elements, inner, restore } = wrappers();
		const animation = elements.wrap(inner).animate([{ opacity: 0 }, { opacity: 1 }], 200);
		animation.pause();
		animation.play();
		animation.cancel();
		expect(engine().animations.map((call) => call.args[0])).toEqual([0, 2, 1, 3]);
		expect(engine().state(inner).attrs["flatten"]).toBe(false);
		restore();
	});
});
