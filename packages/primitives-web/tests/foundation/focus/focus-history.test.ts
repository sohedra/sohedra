// The focus history's look back for a focus return: the newest remembered element that is in the
// document and can take focus. The history is module state shared by every case here, so each
// case adds its own elements and takes them out again; entries that left the document are dropped.
import { afterEach, describe, expect, it } from "vitest";

import {
	addPreviouslyFocusedElement,
	getFocusablePreviouslyFocusedElement,
} from "#lib/foundation/focus/focus-history.js";

const added: Element[] = [];

/** A button in the document, inside a wrapper with `attributes` when given. */
function button(attributes: Record<string, string> = {}): HTMLButtonElement {
	const wrapper = document.createElement("div");
	for (const [name, value] of Object.entries(attributes)) {
		wrapper.setAttribute(name, value);
	}
	const element = document.createElement("button");
	wrapper.append(element);
	document.body.append(wrapper);
	added.push(wrapper);
	return element;
}

afterEach(() => {
	added.splice(0).forEach((element) => element.remove());
});

describe("getFocusablePreviouslyFocusedElement", () => {
	it("gives the newest element that is shown", () => {
		const older = button();
		const newer = button();
		addPreviouslyFocusedElement(older);
		addPreviouslyFocusedElement(newer);

		expect(getFocusablePreviouslyFocusedElement()).toBe(newer);
	});

	it("passes over elements in a hidden subtree", () => {
		const shown = button();
		const hidden = button({ hidden: "" });
		const styled = button({ style: "display: none" });
		addPreviouslyFocusedElement(shown);
		addPreviouslyFocusedElement(hidden);
		addPreviouslyFocusedElement(styled);

		expect(getFocusablePreviouslyFocusedElement()).toBe(shown);
	});

	it("passes over elements in content that is inert or hidden from assistive technology", () => {
		const shown = button();
		const behindModal = button({ "aria-hidden": "true" });
		const inert = button({ inert: "" });
		addPreviouslyFocusedElement(shown);
		addPreviouslyFocusedElement(behindModal);
		addPreviouslyFocusedElement(inert);

		expect(getFocusablePreviouslyFocusedElement()).toBe(shown);
	});

	it("sees what another popup recorded before ours", () => {
		const fromOtherPopup = button();
		const ours = button({ hidden: "" });
		addPreviouslyFocusedElement(fromOtherPopup);
		addPreviouslyFocusedElement(ours);

		expect(getFocusablePreviouslyFocusedElement()).toBe(fromOtherPopup);
	});

	it("gives nothing when no remembered element can take focus", () => {
		const gone = button();
		const hidden = button({ hidden: "" });
		addPreviouslyFocusedElement(gone);
		addPreviouslyFocusedElement(hidden);
		gone.remove();

		expect(getFocusablePreviouslyFocusedElement()).toBe(undefined);
	});
});
