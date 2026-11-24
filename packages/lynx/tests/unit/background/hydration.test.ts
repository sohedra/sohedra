// What a refused hydration says, in the developer's names, and the warnings about ids of
// `$props.id()` that hydration wrote over.

import { describe, expect, it } from "@rstest/core";

import {
	describeMismatch,
	mismatchError,
	warnPropsIds,
} from "../../../src/background/hydration.ts";
import { startTestPage } from "../../../src/testing/index.ts";

describe("a refused hydration", () => {
	it.each([
		[
			{ kind: "attribute", element: 2, name: "class", expected: "a", got: "b" },
			`the <view>'s class is "a" on the background and "b" in the first frame`,
		],
		[
			{ kind: "attribute", element: 2, name: "hidden", got: "yes" },
			`the <view> has hidden "yes" in the first frame, and not on the background`,
		],
		[
			{ kind: "attribute", element: 2, name: "title", expected: "t" },
			`the <view> has title "t" on the background, and not in the first frame`,
		],
		[
			{ kind: "tag", element: 2, expected: "view", got: "text" },
			"the background rendered a <view> where the first frame has a <text>",
		],
		[{ kind: "tag", element: 2 }, "an element in the <view> differs"],
		[
			{ kind: "missing", element: 2, expected: "view" },
			"the background rendered a <view> that the first frame does not have",
		],
		[
			{ kind: "extra", element: 1, got: "text" },
			"the first frame has a <text> at the page's root that the background did not render",
		],
		[
			{ kind: "list-keys", element: 2, expected: ["a"], got: [] },
			"the items of the <view> differ: the background has the keys a, and the first frame none",
		],
	] as const)("says %j", (mismatch, phrase) => {
		const tag = mismatch.element === 1 ? "page" : "view";
		expect(describeMismatch(mismatch, tag)).toBe(phrase);
	});

	it("says only that it was refused when the element is gone", () => {
		const error = mismatchError({ kind: "missing", element: 9 }, undefined);
		expect(error.code).toBe("hydration_mismatch");
		expect(error.message.split("\n")[0]).toBe(
			"The first frame did not match the page the background rendered, so the page was made again.",
		);
	});
});

describe("ids of $props.id() written over the first frame's", () => {
	it("warn once for each attribute of each place, and name an element that is gone by its kind", () => {
		const page = startTestPage();
		const difference = { element: 9, name: "id", expected: "lynx-s2", got: "lynx-s1" };
		page.asBackground(() => {
			warnPropsIds([difference, { ...difference, element: 10 }], () => undefined);
			warnPropsIds([{ ...difference, name: "aria-labelledby" }], () => ({ tag: "input" }));
		});
		const first = (warning: unknown): string => (warning as Error).message.split("\n")[0]!;
		expect(page.warnings.map(first)).toEqual([
			`The <element>'s id is "lynx-s1" in the first frame and "lynx-s2" on the background: $props.id() gave another id on each thread, and the first frame showed its own until the background's replaced it.`,
			`The <input>'s aria-labelledby is "lynx-s1" in the first frame and "lynx-s2" on the background: $props.id() gave another id on each thread, and the first frame showed its own until the background's replaced it.`,
		]);
		expect(page.warnings.map((warning) => (warning as { code?: string }).code)).toEqual([
			"props_id_mismatch",
			"props_id_mismatch",
		]);
	});
});
