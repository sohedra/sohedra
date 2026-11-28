// getCssDimensions: the CSS size of an element, which popup auto-resize and Navigation Menu sizing
// read. Tabs.Indicator keeps a private copy with the same logic.
import { describe, expect, it } from "vitest";

import { getCssDimensions } from "#lib/foundation/position/position-viewport-size.js";

describe("getCssDimensions", () => {
	// KNOWN FAILURE (safety net): an SVG element's CSS size should be read, but `getCssDimensions`
	// compares with `offsetWidth`, which SVG lacks, and returns undefined sizes. A part rendered
	// through `render` can be an SVG element.
	// oxlint-disable-next-line vitest/no-disabled-tests -- a known failure, kept until it is fixed
	it.skip("reads the CSS size of an SVG element", () => {
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("width", "80");
		svg.setAttribute("height", "24");
		document.body.appendChild(svg);

		try {
			expect(getCssDimensions(svg as unknown as HTMLElement)).toEqual({ width: 80, height: 24 });
		} finally {
			svg.remove();
		}
	});
});
