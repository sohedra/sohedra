// `$props.id()` on the background: ids from Svelte's own count on the global object, which every
// runtime in the realm shares, counted from a base taken when each page renders, and never set back.
// A branch only one thread renders counts its own, from the first on each page.

import { afterEach, describe, expect, it } from "@rstest/core";

import {
	props_id,
	startPropsIds,
	ThreadBranch,
} from "../../../../src/svelte/runtime/client-internals.ts";

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

describe("$props.id() in a branch only one thread renders, on the background", () => {
	/** The ids `ids` gives while `thread`'s branch is drawn. */
	const inBranch = (thread: "background" | "main-thread", ids: () => string[]): string[] => {
		let given: string[] = [];
		ThreadBranch(null, { thread, render: () => (given = ids()) });
		return given;
	};

	it("counts the branch's own ids, and leaves the page's count alone", () => {
		scope.__svelte = { uid: 7 };
		startPropsIds();
		expect(props_id()).toBe("lynx-s1");
		expect(inBranch("background", () => [props_id(), props_id()])).toEqual(["lynx-b1", "lynx-b2"]);
		expect(props_id()).toBe("lynx-s2");
		expect(inBranch("main-thread", () => [props_id()])).toEqual(["lynx-m1"]);
		expect(inBranch("background", () => [props_id()])).toEqual(["lynx-b3"]);
		expect(scope.__svelte.uid).toBe(9);
	});

	it("takes the innermost branch's sequence", () => {
		scope.__svelte = { uid: 1 };
		startPropsIds();
		const ids = inBranch("background", () => [
			props_id(),
			...inBranch("main-thread", () => [props_id()]),
			props_id(),
		]);
		expect(ids).toEqual(["lynx-b1", "lynx-m1", "lynx-b2"]);
	});

	it("starts each page's branch ids from the first", () => {
		scope.__svelte = { uid: 1 };
		startPropsIds();
		inBranch("background", () => [props_id()]);
		startPropsIds();
		expect(inBranch("background", () => [props_id()])).toEqual(["lynx-b1"]);
	});

	it("ends the branch when what it draws throws", () => {
		scope.__svelte = { uid: 1 };
		startPropsIds();
		expect(() =>
			ThreadBranch(null, {
				thread: "background",
				render: () => {
					throw new Error("A component failed.");
				},
			}),
		).toThrow("A component failed.");
		expect(props_id()).toBe("lynx-s1");
	});

	it("draws the branch at the target it is given", () => {
		const targets: unknown[] = [];
		const anchor = {};
		ThreadBranch(anchor, { thread: "background", render: (target) => targets.push(target) });
		expect(targets).toEqual([anchor]);
	});
});
