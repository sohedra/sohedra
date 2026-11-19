// The background's report in a production build: every error reaches Lynx, a repeat too, as the
// host's monitoring counts its own; a development build folds repeats (tests/threads/errors).

import { afterEach, describe, expect, it, rs } from "@rstest/core";

import * as globals from "../../../src/background/globals.ts" with { rstest: "importActual" };
import { installGlobals } from "../../../src/testing/globals.ts";

rs.mock("../../../src/background/globals.ts", () => ({ ...globals, DEV: false }));

const { reportError } = await import("../../../src/background/report.ts");

let restore = (): void => {};
afterEach(() => restore());

describe("a production build's report", () => {
	it("reports every repeat of an error into Lynx, uncounted", () => {
		const reported: unknown[] = [];
		restore = installGlobals({ lynx: { reportError: (error: unknown) => reported.push(error) } });
		const error = new Error("the tap failed");
		for (let time = 0; time < 10; time++) reportError(error);
		expect(reported).toHaveLength(10);
		expect(reported.every((each) => each === error)).toBe(true);
	});
});
