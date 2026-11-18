// `$props.id()` on the background: ids from Svelte's own count on the global object, which every
// runtime in the realm shares, counted from a base taken when each page renders, and never set back.

import { afterEach, describe, expect, it } from "@rstest/core";

import { props_id, startPropsIds } from "../../../../src/svelte/runtime/client-internals.ts";

// Boundary: Svelte's slot on the global object, as its client runtime keeps it.
const scope = globalThis as unknown as { __svelte?: { uid?: number } };
const before = scope.__svelte;

afterEach(() => {
	scope.__svelte = before;
});

describe("$props.id() on the background", () => {
	it("starts each page's ids at lynx-s1, from the count others have taken", () => {
		scope.__svelte = { uid: 41 };
		startPropsIds();
		expect([props_id(), props_id()]).toEqual(["lynx-s1", "lynx-s2"]);
		expect(scope.__svelte.uid).toBe(43);
	});

	it("never sets the shared count back, so a page that started earlier keeps unique ids", () => {
		scope.__svelte = { uid: 1 };
		startPropsIds();
		const first = props_id();
		startPropsIds();
		expect(props_id()).toBe("lynx-s1");
		expect(scope.__svelte.uid).toBe(3);
		expect(first).toBe("lynx-s1");
	});

	it("makes Svelte's slot when no runtime has", () => {
		scope.__svelte = undefined;
		startPropsIds();
		expect(props_id()).toBe("lynx-s1");
		expect(scope.__svelte).toEqual({ uid: 2 });
	});
});
