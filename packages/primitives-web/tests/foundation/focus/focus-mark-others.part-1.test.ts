// A browser unit test of src/foundation/focus/focus-mark-others.ts.
// Notes:
// - The inert marker attribute is `data-sohedra-inert` (`INERT_MARKER`).
// - A single call is covered through Popover and Dialog.
// Split in two: this part holds the first five cases; focus-mark-others.part-2.test.ts the rest.

import { afterEach, expect, test } from "vitest";

import { markOthers } from "#lib/foundation/focus/focus-mark-others.js";
import { INERT_MARKER } from "#lib/foundation/focus/index.js";

afterEach(() => {
	document.body.innerHTML = "";
});

test("multiple calls", () => {
	const other = document.createElement("div");
	document.body.appendChild(other);
	const target = document.createElement("div");
	document.body.appendChild(target);

	const cleanup = markOthers([target], { ariaHidden: true });

	expect(other.getAttribute("aria-hidden")).toBe("true");

	const nextTarget = document.createElement("div");
	document.body.appendChild(nextTarget);

	const nextCleanup = markOthers([nextTarget], { ariaHidden: true });

	expect(target.getAttribute("aria-hidden")).toBe("true");
	expect(nextTarget.getAttribute("aria-hidden")).toBe(null);

	document.body.removeChild(nextTarget);

	nextCleanup();

	expect(target.getAttribute("aria-hidden")).toBe(null);
	expect(other.getAttribute("aria-hidden")).toBe("true");

	cleanup();

	expect(other.getAttribute("aria-hidden")).toBe(null);

	document.body.appendChild(nextTarget);
});

test("out of order cleanup", () => {
	const other = document.createElement("div");
	document.body.appendChild(other);
	const target = document.createElement("div");
	target.setAttribute("data-testid", "");
	document.body.appendChild(target);

	const cleanup = markOthers([target], { ariaHidden: true });

	expect(other.getAttribute("aria-hidden")).toBe("true");

	const nextTarget = document.createElement("div");
	document.body.appendChild(nextTarget);

	const nextCleanup = markOthers([nextTarget], { ariaHidden: true });

	expect(target.getAttribute("aria-hidden")).toBe("true");
	expect(nextTarget.getAttribute("aria-hidden")).toBe(null);

	cleanup();

	expect(nextTarget.getAttribute("aria-hidden")).toBe(null);
	expect(target.getAttribute("aria-hidden")).toBe("true");
	expect(other.getAttribute("aria-hidden")).toBe("true");

	nextCleanup();

	expect(nextTarget.getAttribute("aria-hidden")).toBe(null);
	expect(other.getAttribute("aria-hidden")).toBe(null);
	expect(target.getAttribute("aria-hidden")).toBe(null);
});

test("multiple cleanups with differing controlAttribute", () => {
	const other = document.createElement("div");
	document.body.appendChild(other);
	const target = document.createElement("div");
	target.setAttribute("data-testid", "1");
	document.body.appendChild(target);

	const cleanup = markOthers([target], { ariaHidden: true });

	expect(other.getAttribute("aria-hidden")).toBe("true");

	const target2 = document.createElement("div");
	target2.setAttribute("data-testid", "2");
	document.body.appendChild(target2);

	const cleanup2 = markOthers([target2]);

	expect(target.getAttribute("aria-hidden")).not.toBe("true");
	expect(target.getAttribute(INERT_MARKER)).toBe("");

	cleanup();

	expect(other.getAttribute("aria-hidden")).toBe(null);

	cleanup2();

	expect(target.getAttribute(INERT_MARKER)).toBe(null);
});

test("keeps aria-hidden until the last aria-hidden lock releases, alongside marker-only locks", () => {
	const other = document.createElement("div");
	document.body.appendChild(other);

	const A = document.createElement("div");
	document.body.appendChild(A);

	const B = document.createElement("div");
	document.body.appendChild(B);

	const C = document.createElement("div");
	document.body.appendChild(C);

	const cleanupA = markOthers([A], { ariaHidden: true });
	const cleanupB = markOthers([B], { ariaHidden: true });
	const cleanupC = markOthers([C]);

	expect(other.getAttribute("aria-hidden")).toBe("true");
	expect(other.getAttribute(INERT_MARKER)).toBe("");

	cleanupC();

	expect(other.getAttribute("aria-hidden")).toBe("true");
	expect(other.getAttribute(INERT_MARKER)).toBe("");

	cleanupB();

	expect(other.getAttribute("aria-hidden")).toBe("true");
	expect(other.getAttribute(INERT_MARKER)).toBe("");

	cleanupA();

	expect(other.hasAttribute("aria-hidden")).toBe(false);
	expect(other.hasAttribute(INERT_MARKER)).toBe(false);
});

test("preserves externally owned aria-hidden during overlapping aria-hidden locks", () => {
	const keep = document.createElement("div");
	const outside = document.createElement("div");
	outside.setAttribute("aria-hidden", "true");
	document.body.append(keep, outside);

	let cleanupFirst: (() => void) | undefined;
	let cleanupSecond: (() => void) | undefined;

	try {
		cleanupFirst = markOthers([keep], { ariaHidden: true, mark: false });
		cleanupSecond = markOthers([keep], { ariaHidden: true, mark: false });

		expect(outside).toHaveAttribute("aria-hidden", "true");

		cleanupFirst();
		cleanupFirst = undefined;

		expect(outside).toHaveAttribute("aria-hidden", "true");

		cleanupSecond();
		cleanupSecond = undefined;

		expect(outside).toHaveAttribute("aria-hidden", "true");
	} finally {
		cleanupSecond?.();
		cleanupFirst?.();
	}
});
