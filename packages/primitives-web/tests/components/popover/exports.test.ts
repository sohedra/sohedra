// The popover entry: the Popover namespace (parts, `createHandle`,
// `Handle`) and the data-attribute / CSS-variable groups.

import { describe, expect, it } from "vitest";

import * as entry from "#lib/components/popover/index.js";
import * as library from "#lib/index.js";

describe("exports", () => {
	it("gives the same Popover from the library and the popover entry", () => {
		expect(library.Popover).toBe(entry.Popover);
		expect(Object.keys(entry.Popover).sort()).toEqual([
			"Arrow",
			"Backdrop",
			"Close",
			"Description",
			"Handle",
			"Popup",
			"Portal",
			"Positioner",
			"Root",
			"Title",
			"Trigger",
			"Viewport",
			"createHandle",
		]);
		expect(Object.keys(entry).sort()).toEqual([
			"Popover",
			"PopoverArrowDataAttributes",
			"PopoverBackdropDataAttributes",
			"PopoverPopupCssVariables",
			"PopoverPopupDataAttributes",
			"PopoverPositionerCssVariables",
			"PopoverPositionerDataAttributes",
			"PopoverTriggerDataAttributes",
			"PopoverViewportCssVariables",
			"PopoverViewportDataAttributes",
		]);
	});

	it("creates handles", () => {
		const handle = entry.Popover.createHandle();
		expect(handle).toBeInstanceOf(entry.Popover.Handle);
		expect(handle.isOpen).toBe(false);
	});
});
