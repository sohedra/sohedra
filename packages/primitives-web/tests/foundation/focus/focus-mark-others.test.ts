// markOthers: hiding everything outside the given elements from assistive technology, or marking
// it inert, and undoing that per call, whatever order the calls clean up in.
import { afterEach, describe, expect, it } from "vitest";

import { markOthers } from "#lib/foundation/focus/focus-mark-others.js";
import { INERT_MARKER } from "#lib/foundation/focus/index.js";

afterEach(() => {
	document.body.innerHTML = "";
});

describe("markOthers", () => {
	it("hides an earlier target while a later call marks around another one", () => {
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

	it("restores every element when the calls clean up out of order", () => {
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

	it("keeps a marker-only call's marker after an aria-hidden call cleans up", () => {
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

	it("keeps aria-hidden until the last aria-hidden lock releases, alongside marker-only locks", () => {
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

	it("preserves externally owned aria-hidden during overlapping aria-hidden locks", () => {
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

	it("does not let mark-only overlap disturb control cleanup bookkeeping", () => {
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

	it("re-reads externally owned aria-hidden once every lock has released", () => {
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

	it("re-reads externally owned aria-hidden while an unrelated lock stays held", () => {
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

	it("leaves live regions, their ancestors, and scripts exposed", () => {
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

	it("does not recurse forever for a target inside an anchor in a shadow root", () => {
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

	it("spares the shadow host of a target inside an anchor and hides the rest", () => {
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
});
