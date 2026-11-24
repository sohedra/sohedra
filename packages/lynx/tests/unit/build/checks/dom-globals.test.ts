// The DOM's globals are their own list: none is a global the wire's table names, so a read gets one
// message, the table's.

import { describe, expect, it } from "@rstest/core";

import { DOM_GLOBAL_NAMES } from "../../../../src/build/checks/dom-globals.ts";
import { globalGap } from "../../../../src/wire/index.ts";

describe("the DOM's globals", () => {
	it("leave the globals of the wire's table to it", () => {
		const both = DOM_GLOBAL_NAMES.filter(
			(name) =>
				globalGap(name, "background") !== undefined || globalGap(name, "main-thread") !== undefined,
		);
		expect(both).toEqual([]);
	});
});
