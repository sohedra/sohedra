// The conformance suite renders the description beside the trigger in an open Popover.Root
// instead of inside the popup, so its server render holds it (the popup's Portal renders after
// mount only).

import { describe, expect, it } from "vitest";

import { describeConformance } from "../../conformance/describe-conformance.js";
import { createRenderer, screen } from "../../shim/index.js";
import { popoverDescriptionConformance } from "./fixtures/popover-description-conformance.js";
import PartLabelledPopup from "./fixtures/popover-labelled-popup.svelte";

describe("<Popover.Description />", () => {
	const { render } = createRenderer();

	describeConformance("Popover.Description", () => popoverDescriptionConformance);

	it("describes the popup element with its id", async () => {
		await render(PartLabelledPopup, { part: "description" });

		const id = document.querySelector("p")?.id;
		expect(screen.getByRole("dialog")).toHaveAttribute("aria-describedby", id);
	});
});
