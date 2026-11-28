// The conformance suite renders the title beside the trigger in an open Popover.Root instead of
// inside the popup, so its server render holds it (the popup's Portal renders after mount only).

import { describe, expect, it } from "vitest";

import { describeConformance } from "../../conformance/conformance-part.js";
import { createRenderer, screen } from "../../shim/index.js";
import PartLabelledPopup from "./fixtures/popover-labelled-popup.svelte";
import { popoverTitleConformance } from "./fixtures/popover-title-conformance.js";

describe("<Popover.Title />", () => {
	const { render } = createRenderer();

	describeConformance("Popover.Title", () => popoverTitleConformance);

	it("labels the popup element with its id", async () => {
		await render(PartLabelledPopup, { part: "title" });

		const id = document.querySelector("h2")?.id;
		expect(screen.getByRole("dialog")).toHaveAttribute("aria-labelledby", id);
	});
});
