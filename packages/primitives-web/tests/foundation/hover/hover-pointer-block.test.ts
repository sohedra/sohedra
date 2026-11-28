// The pointer block a hover-opened popup sets while the pointer travels to it: re-applying it on
// the same scope (the pointer moving again over a trigger, or a switch between a menu's
// triggers) keeps the scope blocked; clearing it lifts every style it set.
import { HoverInteraction } from "@sohedra/primitives-core/foundation/hover/index.js";
import { afterEach, describe, expect, it } from "vitest";

import {
	blockPointerEventsOutside,
	blockPointerEventsOverTrigger as blockOverTrigger,
} from "#lib/foundation/hover/hover-pointer-block.svelte.js";
import type { HoverPopupView } from "#lib/foundation/hover/index.js";
import { webScheduler, type WebTypes } from "#lib/foundation/kernel/index.js";

const elements: HTMLElement[] = [];

function element(tag = "div") {
	const created = document.body.appendChild(document.createElement(tag));
	elements.push(created);
	return created;
}

/** A hover-opened popup's store, as far as the pointer block reads it. */
function hoverStore(floating: HTMLElement) {
	const hover = new HoverInteraction<WebTypes>(webScheduler);
	hover.setBlockPointerEvents(true);
	return { hover, open: true, floatingElement: floating } as unknown as HoverPopupView;
}

/** A two-argument call: the block applies whatever the pointer type. */
function blockPointerEventsOverTrigger(popup: HoverPopupView, trigger: HTMLElement) {
	blockOverTrigger(popup, trigger, false);
}

afterEach(() => {
	elements.splice(0).forEach((created) => created.remove());
	document.body.style.removeProperty("pointer-events");
});

describe("pointer block", () => {
	it("keeps the scope blocked when the same popup blocks it again", () => {
		const scope = element("ul");
		const trigger = element("button");
		const floating = element();
		const store = hoverStore(floating);

		blockPointerEventsOutside(store, scope, trigger, floating);
		blockPointerEventsOutside(store, scope, trigger, floating);

		expect(scope.style.pointerEvents).toBe("none");
		expect(trigger.style.pointerEvents).toBe("auto");
		expect(floating.style.pointerEvents).toBe("auto");

		store.hover.clearPointerBlock();
		expect(scope.style.pointerEvents).toBe("");
		expect(trigger.style.pointerEvents).toBe("");
		expect(floating.style.pointerEvents).toBe("");
	});

	it("keeps the page blocked when the pointer moves over another trigger twice", () => {
		const first = element("button");
		const second = element("button");
		const floating = element();
		const store = hoverStore(floating);

		blockPointerEventsOverTrigger(store, first);
		blockPointerEventsOverTrigger(store, second);
		blockPointerEventsOverTrigger(store, second);

		expect(document.body.style.pointerEvents).toBe("none");
		expect(second.style.pointerEvents).toBe("auto");

		store.hover.clearPointerBlock();
		expect(document.body.style.pointerEvents).toBe("");
	});
});
