// The gestures' development warning, read from the gesture classes as a page's background builds
// them: it reaches Lynx by the `lynx` name at the warning level, once for each experimental relation
// option, and reporting it never throws.

import { describe, expect, it } from "@rstest/core";

import { reportWarning } from "../../../src/gesture/globals.ts";
import { PanGesture, TapGesture } from "../../../src/gesture/index.ts";
import { installGlobals, removeGlobals } from "../../../src/testing/globals.ts";

describe("the experimental relation options' warning", () => {
	it("reaches Lynx at the warning level once for each option, and never throws", () => {
		const reported: [unknown, unknown][] = [];
		const restore = installGlobals({
			lynx: { reportError: (error: unknown, options: unknown) => reported.push([error, options]) },
		});
		try {
			const pan = new PanGesture();
			new TapGesture({ waitFor: [pan] });
			new TapGesture({ waitFor: [pan], continueWith: [pan] });
			new PanGesture({ continueWith: [pan] });
			expect(reported).toEqual([
				[expect.objectContaining({ code: "gesture_relation_experimental" }), { level: "warning" }],
				[expect.objectContaining({ code: "gesture_relation_experimental" }), { level: "warning" }],
			]);
			expect(reported.map(([error]) => (error as Error).message.split(":")[0])).toEqual([
				"The waitFor of a TapGesture is experimental",
				"The continueWith of a TapGesture is experimental",
			]);
		} finally {
			restore();
		}
	});

	it("is lost, not thrown, where Lynx refuses it or there is no lynx", () => {
		const restore = installGlobals({
			lynx: {
				reportError: () => {
					throw new Error("refused");
				},
			},
		});
		try {
			expect(() => reportWarning(new Error("a warning"))).not.toThrow();
			removeGlobals(["lynx"]);
			expect(() => reportWarning(new Error("a warning"))).not.toThrow();
		} finally {
			restore();
		}
	});
});
