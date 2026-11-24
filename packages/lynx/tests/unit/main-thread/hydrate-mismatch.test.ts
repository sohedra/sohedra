// What the main thread tells the background of a refused hydration: in a production build, which
// kind of difference and where, and none of the values that differ.

import { describe, expect, it } from "@rstest/core";

import { sentMismatch } from "../../../src/main-thread/hydrate/hydrate.ts";

const MISMATCH = { kind: "attribute", element: 2, name: "class", expected: "a", got: "b" } as const;

describe("a refused hydration's mismatch", () => {
	it("crosses whole in a development build", () => {
		expect(sentMismatch(MISMATCH, true)).toEqual(MISMATCH);
	});

	it("crosses without its values in a production build", () => {
		expect(sentMismatch(MISMATCH, false)).toEqual({ kind: "attribute", element: 2 });
	});
});
