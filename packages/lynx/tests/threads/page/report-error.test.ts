// `reportError` on both threads: what the app gives it reaches Lynx once, as it was given, and it
// never throws, even when Lynx's own report does.

import { describe, expect, it } from "@rstest/core";

import { reportError } from "../../../src/background/root-entry.ts";
import ReportsError from "../../fixtures/threads/page/ReportsError.svelte";
import ReportsOnMainThread from "../../fixtures/threads/page/ReportsOnMainThread.svelte";
import drawReportsOnMainThread from "../../fixtures/threads/page/ReportsOnMainThread.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";

describe("reportError", () => {
	it("reports what the app gives it into Lynx, once each, as it was given", async () => {
		const failure = new Error("the save failed");
		const reported: unknown[] = [failure, "a text"];
		const page = startSveltePage(ReportsError, { props: { reported } });
		await page.settle();
		page.engine.dispatch(page.byClass("report"), { type: "tap" });
		await page.settle();
		expect(page.errors).toEqual([failure, "a text"]);
		expect(page.warnings).toEqual([]);
	});

	it("throws nothing when Lynx's report throws", async () => {
		const page = startSveltePage(ReportsError, { props: { reported: [] } });
		await page.settle();
		const lynx = page.lynx.background as { reportError(error: unknown): void };
		lynx.reportError = () => {
			throw new Error("the report failed");
		};
		expect(() => page.asBackground(() => reportError(new Error("lost")))).not.toThrow();
	});
});

describe("reportError in a main-thread function", () => {
	async function reporting() {
		// The first-frame copy registers the main-thread function; no frame is drawn.
		void drawReportsOnMainThread;
		const page = startSveltePage(ReportsOnMainThread);
		await page.settle();
		const tap = async () => {
			page.engine.dispatch(page.byClass("report"), { type: "tap" });
			await page.settle();
		};
		const reported = () => page.engine.state(page.byClass("report")).attrs["reported"];
		return { page, tap, reported };
	}

	it("reports into Lynx on the main thread", async () => {
		const { page, tap, reported } = await reporting();
		await tap();
		expect(page.errors.map(String)).toEqual(["Error: reported on the main thread"]);
		expect(reported()).toBe("yes");
	});

	it("throws nothing when Lynx's report throws, and the function goes on", async () => {
		const { page, tap, reported } = await reporting();
		const lynx = page.lynx.mainThread as { reportError(error: unknown): void };
		lynx.reportError = () => {
			throw new Error("the report failed");
		};
		await tap();
		expect(reported()).toBe("yes");
	});
});
