// The state-mapping case no other test checks. The open, trigger and pressed attributes are checked
// by the popup and trigger component tests.

import { describe, expect, it } from "vitest";

import { popupStateMapping } from "#lib/foundation/popup/index.js";

describe("popupStateMapping", () => {
	it("emits the anchor-hidden data attribute only when the anchor is hidden", () => {
		expect(popupStateMapping.anchorHidden(true)).toEqual({ "data-anchor-hidden": "" });
		expect(popupStateMapping.anchorHidden(false)).toBe(null);
	});
});
