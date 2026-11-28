// isMouseWithinBounds, which Select and Combobox triggers use to tell a press released on the
// trigger from a drag off it: an element's bounds take in its pseudo-elements, plus a 5px drift.
// The element below is 20×10 at (100, 50) with a 40×30 `::before`, so its bounds are left 90,
// right 130, top 40, bottom 70; a mouseup is within them up to 5px past and outside 6px past.
import { describe, expect, it } from "vitest";

import { isMouseWithinBounds } from "#lib/foundation/popup/popup-pointer-bounds.js";

import { injectStyle } from "../../kit/kit-style.js";

describe("isMouseWithinBounds", () => {
	it("includes pseudo-element bounds in browsers", () => {
		injectStyle(`
			.pseudo-element-bounds-test {
				position: absolute;
				left: 100px;
				top: 50px;
				width: 20px;
				height: 10px;
			}

			.pseudo-element-bounds-test::before {
				content: "";
				display: block;
				width: 40px;
				height: 30px;
			}
		`);
		const element = document.body.appendChild(document.createElement("div"));
		element.className = "pseudo-element-bounds-test";

		try {
			const rect = element.getBoundingClientRect();
			// The element's own box, relative to which the expected bounds are given.
			const x = (offset: number) => rect.left - 100 + offset;
			const y = (offset: number) => rect.top - 50 + offset;
			const within = (clientX: number, clientY: number) =>
				isMouseWithinBounds(new MouseEvent("mouseup", { clientX, clientY }), element);

			// left: 90
			expect(within(x(90 - 5), y(55))).toBe(true);
			expect(within(x(90 - 6), y(55))).toBe(false);
			// right: 130
			expect(within(x(130 + 5), y(55))).toBe(true);
			expect(within(x(130 + 6), y(55))).toBe(false);
			// top: 40
			expect(within(x(110), y(40 - 5))).toBe(true);
			expect(within(x(110), y(40 - 6))).toBe(false);
			// bottom: 70
			expect(within(x(110), y(70 + 5))).toBe(true);
			expect(within(x(110), y(70 + 6))).toBe(false);
		} finally {
			element.remove();
		}
	});
});
