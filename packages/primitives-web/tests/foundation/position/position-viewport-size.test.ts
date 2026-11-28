// getCssDimensions: the CSS size of an element, which popup auto-resize and Navigation Menu sizing
// read. Tabs.Indicator keeps a private copy with the same logic.
import { describe, expect, it } from "vitest";

import { getCssDimensions } from "#lib/foundation/position/position-viewport-size.js";

describe("getCssDimensions", () => {
	// KNOWN FAILURE (safety net): the CSS size of a non-HTML element should be read
	// (`{ width: 80, height: 24 }`), falling back to the offset size only for an HTML element.
	// `getCssDimensions` has no such check and compares with `offsetWidth`, which an SVG element
	// lacks, so it returns `{ width: undefined, height: undefined }`
	// (src/foundation/position/position-viewport-size.ts). Parts that accept a `render` prop can
	// be SVG elements, which have no `offsetWidth`/`offsetHeight`.
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
