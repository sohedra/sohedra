// A browser unit test of src/foundation/focus/focus-mark-others.ts.
// Notes:
// - The inert marker attribute is `data-sohedra-inert` (`INERT_MARKER`).
// - A single call is covered through Popover and Dialog.
// Split in two: this part holds the sixth case on; focus-mark-others.part-1.test.ts the first five.

import { afterEach, expect, test } from "vitest";

import { markOthers } from "#lib/foundation/focus/focus-mark-others.js";
import { INERT_MARKER } from "#lib/foundation/focus/index.js";

afterEach(() => {
	document.body.innerHTML = "";
});

test("does not let mark-only overlap disturb control cleanup bookkeeping", () => {
	const keep = document.createElement("div");
	const outside = document.createElement("div");
	document.body.append(keep, outside);

	let cleanupMarkOnly: (() => void) | undefined;
	let cleanupControlOnly: (() => void) | undefined;

	try {
		cleanupMarkOnly = markOthers([keep], { mark: true });
		cleanupControlOnly = markOthers([keep], { ariaHidden: true, mark: false });

		expect(outside).toHaveAttribute(INERT_MARKER);
		expect(outside).toHaveAttribute("aria-hidden", "true");

		cleanupMarkOnly();
		cleanupMarkOnly = undefined;

		expect(outside).not.toHaveAttribute(INERT_MARKER);
		expect(outside).toHaveAttribute("aria-hidden", "true");

		cleanupControlOnly();
		cleanupControlOnly = undefined;

		expect(outside).not.toHaveAttribute(INERT_MARKER);
		expect(outside).not.toHaveAttribute("aria-hidden");
	} finally {
		cleanupControlOnly?.();
		cleanupMarkOnly?.();
	}
});

test("re-reads externally owned aria-hidden once every lock has released", () => {
	const keep = document.createElement("div");
	const outside = document.createElement("div");
	document.body.append(keep, outside);

	const cleanupFirst = markOthers([keep], { ariaHidden: true });
	expect(outside).toHaveAttribute("aria-hidden", "true");
	cleanupFirst();
	expect(outside).not.toHaveAttribute("aria-hidden");

	outside.setAttribute("aria-hidden", "true");
	const cleanupSecond = markOthers([keep], { ariaHidden: true });
	cleanupSecond();
	expect(outside).toHaveAttribute("aria-hidden", "true");

	outside.removeAttribute("aria-hidden");
	const cleanupThird = markOthers([keep], { ariaHidden: true });
	expect(outside).toHaveAttribute("aria-hidden", "true");
	cleanupThird();
	expect(outside).not.toHaveAttribute("aria-hidden");
});

test("re-reads externally owned aria-hidden while an unrelated lock stays held", () => {
	const keep = document.createElement("div");
	const outside = document.createElement("div");
	outside.setAttribute("aria-hidden", "true");
	document.body.append(keep, outside);

	// Keeps the lock count above zero so the bookkeeping is never reset wholesale.
	const cleanupHeld = markOthers([keep, outside], { ariaHidden: true });

	try {
		const cleanupFirst = markOthers([keep], { ariaHidden: true });
		cleanupFirst();
		expect(outside).toHaveAttribute("aria-hidden", "true");

		outside.removeAttribute("aria-hidden");
		const cleanupSecond = markOthers([keep], { ariaHidden: true });
		expect(outside).toHaveAttribute("aria-hidden", "true");
		cleanupSecond();
		expect(outside).not.toHaveAttribute("aria-hidden");
	} finally {
		cleanupHeld();
	}
});

test("leaves live regions, their ancestors, and scripts exposed", () => {
	const keep = document.createElement("div");
	const liveRegion = document.createElement("div");
	liveRegion.setAttribute("aria-live", "polite");
	const liveWrapper = document.createElement("div");
	const nestedLiveRegion = document.createElement("div");
	nestedLiveRegion.setAttribute("aria-live", "assertive");
	const liveSibling = document.createElement("div");
	liveWrapper.append(nestedLiveRegion, liveSibling);
	const script = document.createElement("script");
	document.body.append(keep, liveRegion, liveWrapper, script);

	const cleanup = markOthers([keep], { ariaHidden: true, mark: false });

	expect(liveRegion).not.toHaveAttribute("aria-hidden");
	expect(liveWrapper).not.toHaveAttribute("aria-hidden");
	expect(nestedLiveRegion).not.toHaveAttribute("aria-hidden");
	expect(liveSibling).toHaveAttribute("aria-hidden", "true");
	expect(script).not.toHaveAttribute("aria-hidden");

	cleanup();

	expect(liveSibling).not.toHaveAttribute("aria-hidden");
});

test("does not recurse infinitely with target inside anchor in shadow root", () => {
	const host = document.createElement("div");
	document.body.appendChild(host);

	const shadowRoot = host.attachShadow({ mode: "open" });
	const anchor = document.createElement("a");
	anchor.href = "https://floating-ui.com";

	const target = document.createElement("button");
	anchor.appendChild(target);
	shadowRoot.appendChild(anchor);

	// Infinite recursion would throw a RangeError here instead of returning.
	const cleanup = markOthers([target], { ariaHidden: true });

	// The host contains the target, so it must not have been hidden.
	expect(host).not.toHaveAttribute("aria-hidden");

	cleanup();
});

test("uses shadow root host as avoid element when parent chain includes anchor", () => {
	const outside = document.createElement("div");
	document.body.appendChild(outside);

	const host = document.createElement("div");
	document.body.appendChild(host);

	const shadowRoot = host.attachShadow({ mode: "open" });
	const anchor = document.createElement("a");
	anchor.href = "https://floating-ui.com";

	const target = document.createElement("button");
	anchor.appendChild(target);
	shadowRoot.appendChild(anchor);

	const cleanup = markOthers([target], { ariaHidden: true });

	expect(outside.getAttribute("aria-hidden")).toBe("true");
	expect(host.getAttribute("aria-hidden")).toBe(null);

	cleanup();

	expect(outside.getAttribute("aria-hidden")).toBe(null);
});
