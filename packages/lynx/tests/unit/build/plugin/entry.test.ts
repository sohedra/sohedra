// The main thread's copy of a page's entry resolves the entry from the app's root, whichever way
// the system separates the folders of its issuer's path.

import { describe, expect, it } from "@rstest/core";

import { issuedByFirstFrameCopy } from "../../../../src/build/plugin/entry.ts";
import { RUNTIME_FILES } from "../../../../src/build/plugin/layers.ts";

const QUERY = "?entry=.%2Fsrc%2Findex.ts";

describe("the module that issues an entry's first-frame copy", () => {
	it("is the first frame's runtime file, with the entry in its query", () => {
		expect(issuedByFirstFrameCopy(`${RUNTIME_FILES.firstFrame}${QUERY}`)).toBe(true);
		expect(issuedByFirstFrameCopy(RUNTIME_FILES.mainThread)).toBe(false);
	});

	it("is found by a path with Windows' separators, as the bundler gives it there", () => {
		const windows = RUNTIME_FILES.firstFrame.replaceAll("/", "\\");
		expect(issuedByFirstFrameCopy(`${windows}${QUERY}`)).toBe(true);
	});
});
