// What a refused hydration says, in the developer's names.

import { describe, expect, it } from "@rstest/core";

import { describeMismatch, mismatchError } from "../../../src/background/hydration.ts";

describe("a refused hydration", () => {
	it.each([
		[
			{ kind: "attribute", node: 2, name: "class", expected: "a", got: "b" },
			`the <view>'s class is "a" on the background and "b" in the first frame`,
		],
		[
			{ kind: "attribute", node: 2, name: "hidden", got: "yes" },
			`the <view> has hidden "yes" in the first frame, and not on the background`,
		],
		[
			{ kind: "attribute", node: 2, name: "title", expected: "t" },
			`the <view> has title "t" on the background, and not in the first frame`,
		],
		[
			{ kind: "tag", node: 2, expected: "view", got: "text" },
			"the background rendered a <view> where the first frame has a <text>",
		],
		[{ kind: "tag", node: 2 }, "an element in the <view> differs"],
		[
			{ kind: "missing", node: 2, expected: "view" },
			"the background rendered a <view> that the first frame does not have",
		],
		[
			{ kind: "extra", node: 1, got: "text" },
			"the first frame has a <text> at the page's root that the background did not render",
		],
		[
			{ kind: "list-keys", node: 2, expected: ["a"], got: [] },
			"the items of the <view> differ: the background has the keys a, and the first frame none",
		],
	] as const)("says %j", (mismatch, phrase) => {
		const tag = mismatch.node === 1 ? "page" : "view";
		expect(describeMismatch(mismatch, tag)).toBe(phrase);
	});

	it("says only that it was refused when the element is gone", () => {
		const error = mismatchError({ kind: "missing", node: 9 }, undefined);
		expect(error.code).toBe("hydration_mismatch");
		expect(error.message.split("\n")[0]).toBe(
			"The first frame did not match the page the background rendered, so the page was made again.",
		);
	});
});
