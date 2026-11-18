// What the main thread's engine lacks, filled in before the page loads.

import { describe, expect, it } from "@rstest/core";

import { fillEngineGaps } from "../../../src/main-thread/engine-gaps.ts";

describe("the main thread's SystemInfo", () => {
	it("is lynx's, put on the global object, where the background has its own", () => {
		const info = { platform: "iOS" };
		const scope: Record<string, unknown> = {};
		fillEngineGaps(scope, { SystemInfo: info });
		expect(scope["SystemInfo"]).toBe(info);
	});

	it("is the engine's own when it has one", () => {
		const own = { platform: "Android" };
		const scope: Record<string, unknown> = { SystemInfo: own };
		fillEngineGaps(scope, { SystemInfo: { platform: "iOS" } });
		expect(scope["SystemInfo"]).toBe(own);
	});

	it("is not made up when lynx has none either", () => {
		const scope: Record<string, unknown> = {};
		fillEngineGaps(scope, {});
		expect("SystemInfo" in scope).toBe(false);
	});
});
