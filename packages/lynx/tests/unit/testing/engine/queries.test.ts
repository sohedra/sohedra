// Testing Library's queries on the engine's tree: the DOM shows what the engine would show.

import { describe, expect, it } from "@rstest/core";
import { getByText, queryByText, screen, within } from "@testing-library/dom";

import { engineForEach } from "./engine-fixture.ts";

const engine = engineForEach();

/** page > text > raw-text, with the text `label`. */
function labelled(label: string) {
	const f = engine().functions;
	const page = f.__CreatePage("0", 0);
	const text = f.__CreateText(0);
	const raw = f.__CreateElement("raw-text", 0);
	f.__SetAttribute(raw, "text", label);
	f.__AppendElement(page, text);
	f.__AppendElement(text, raw);
	return { page, text, raw };
}

describe("queries by text", () => {
	it("find the element that holds a raw text, from the screen", () => {
		const { text } = labelled("Save");
		expect(screen.getByText("Save")).toBe(text);
	});

	it("follow the text as it changes, and do not find what was removed", () => {
		const { page, text, raw } = labelled("Save");
		engine().functions.__SetAttribute(raw, "text", "Saved");
		expect(screen.queryByText("Save")).toBeNull();
		expect(screen.getByText("Saved")).toBe(text);
		engine().functions.__RemoveElement(page, text);
		expect(screen.queryByText("Saved")).toBeNull();
	});

	it("can be bound to the page's element", () => {
		const { page, text } = labelled("Open");
		expect(getByText(page as HTMLElement, "Open")).toBe(text);
		expect(within(page as HTMLElement).getByText("Open")).toBe(text);
		expect(queryByText(document.createElement("div"), "Open")).toBeNull();
	});
});

describe("queries by data attribute", () => {
	it("find an element by the data attribute its dataset shows", () => {
		const { text } = labelled("Row");
		engine().functions.__SetDataset(text, { row: 7, "drag-handle": true });
		expect(document.querySelector("[data-row='7']")).toBe(text);
		expect(screen.getByText("Row").closest("[data-drag-handle]")).toBe(text);
		expect(within(engine().page() as HTMLElement).getByText("Row").dataset["row"]).toBe("7");
	});
});
