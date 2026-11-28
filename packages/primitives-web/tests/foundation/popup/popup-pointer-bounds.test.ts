// Pseudo-element bounds count in browsers: a browser unit test of
// src/foundation/popup/popup-pointer-bounds.ts, which Select and Combobox triggers use to tell a
// press released on the trigger from a drag off it.
// `getPseudoElementBounds` is private to `isMouseWithinBounds`, so the expected bounds (left 90,
// right 130, top 40, bottom 70) are read through it: a mouseup is within them up to the 5px drift
// (pinned through the Select trigger's tests) and outside one pixel further. Every project here is
// a real browser.

import { describe, expect, it } from "vitest";

import { isMouseWithinBounds } from "#lib/foundation/popup/popup-pointer-bounds.js";

describe("getPseudoElementBounds", () => {
	it("includes pseudo-element bounds in browsers", () => {
		const style = document.createElement("style");
		style.textContent = `
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
    `;

		const element = document.createElement("div");
		element.className = "pseudo-element-bounds-test";

		document.head.appendChild(style);
		document.body.appendChild(element);

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
			style.remove();
		}
	});
});
