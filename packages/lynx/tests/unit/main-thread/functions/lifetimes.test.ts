// The contexts a page of the main thread holds: counted as it takes them, told to the background as
// they go, and nothing more once the page ends.

import { describe, expect, it } from "@rstest/core";

import { createLifetimes } from "../../../../src/main-thread/functions/lifetimes.ts";

function lifetimes() {
	const released: number[][] = [];
	const soon: (() => void)[] = [];
	const held = createLifetimes({
		release: (ids) => void released.push(ids),
		soon: (callback) => void soon.push(callback),
	});
	const runSoon = () => {
		for (const callback of soon.splice(0)) callback();
	};
	return { held, released, runSoon };
}

describe("a page's contexts", () => {
	it("are counted once for each object the page takes", () => {
		const { held } = lifetimes();
		const object = {};
		held.hold(4, object);
		held.hold(4, object);
		held.hold(4, {});
		expect(held.held()).toEqual([4]);
		expect(held.has(4)).toBe(true);
		expect(held.has(5)).toBe(false);
	});

	it("tell the background at the end of the task of a text let go of unread, in one message", () => {
		const { held, released, runSoon } = lifetimes();
		held.hold(1, {});
		held.dropUnread([1, 2]);
		held.dropUnread([3]);
		expect(released).toEqual([]);
		runSoon();
		// A context the page holds still is not let go of.
		expect(released).toEqual([[2, 3]]);
	});

	it("tell nothing once the page ended", () => {
		const { held, released, runSoon } = lifetimes();
		held.dropUnread([1]);
		held.end();
		runSoon();
		held.hold(2, {});
		expect(released).toEqual([]);
		expect(held.held()).toEqual([]);
	});
});
