// What the host gives the page as values: `initData` and `globalProps` follow the host's updates,
// and `systemInfo` is what Lynx says about the device.

import { describe, expect, it } from "@rstest/core";

import { globalProps, initData, systemInfo } from "../../../src/background/host-entry.ts";
import HostData from "../../fixtures/threads/host/HostData.svelte";
import { watchTitle } from "../../fixtures/threads/host/watch.svelte.ts";
import { startSveltePage } from "../svelte-page.ts";

const flagged = (options: unknown): boolean =>
	(options as { triggerDataUpdated?: unknown } | undefined)?.triggerDataUpdated === true;

function hostData(options: Parameters<typeof startSveltePage>[1] = {}) {
	return startSveltePage(HostData, {
		initData: { title: "Inbox" },
		globalProps: { theme: "light" },
		...options,
	});
}

describe("initData", () => {
	it("is the data the page was opened with", async () => {
		const page = hostData({ templateData: { title: "Template", lang: "en" } });
		await page.settle();
		expect(page.engine.text(page.byClass("title"))).toBe("Inbox");
		expect(page.asBackground(() => initData.current)).toEqual({ title: "Inbox", lang: "en" });
	});

	it("follows a data update, in the patch that says the data was updated", async () => {
		const page = hostData();
		await page.settle();
		const patches = page.patches.length;
		const flushes = page.engine.flushes.length;
		page.updateData({ title: "Archive" });
		await page.settle();
		expect(page.engine.text(page.byClass("title"))).toBe("Archive");
		expect(page.patches.slice(patches)).toHaveLength(1);
		expect(page.patches.at(-1)!.dataUpdated).toBe(true);
		expect(page.engine.flushes.slice(flushes).filter(flagged)).toHaveLength(1);
		expect(page.errors).toEqual([]);
	});

	it("sends what changed with the data before the host's update returns, in one patch", async () => {
		const page = hostData();
		await page.settle();
		const patches = page.patches.length;
		// The engine's call of the app's hook, as the background runs it.
		page.asBackground(() =>
			(page.app["updateCardData"] as (data: unknown, update: unknown) => void)(
				{ title: "Archive" },
				{ type: 0 },
			),
		);
		expect(page.patches.slice(patches)).toEqual([
			expect.objectContaining({ dataUpdated: true, items: [expect.anything()] }),
		]);
		await page.settle();
		expect(page.engine.text(page.byClass("title"))).toBe("Archive");
	});

	it("runs a reader outside the page's components again at a reload", async () => {
		const page = hostData();
		await page.settle();
		const log: unknown[] = [];
		const stop = page.asBackground(() => watchTitle(log));
		page.reload({ title: "Reloaded" });
		await page.settle();
		expect(log).toEqual(["Inbox", "Reloaded"]);
		stop();
	});

	it("starts from none at an update that resets the data", async () => {
		const page = hostData();
		await page.settle();
		page.updateData({ lang: "tr" }, { type: 1 });
		await page.settle();
		expect(page.engine.text(page.byClass("title"))).toBe("undefined");
		expect(page.asBackground(() => initData.current)).toEqual({ lang: "tr" });
	});

	it("is the merged data after a reload", async () => {
		const page = hostData();
		await page.settle();
		page.reload({ title: "Reloaded" });
		await page.settle();
		expect(page.engine.text(page.byClass("title"))).toBe("Reloaded");
		expect(page.errors).toEqual([]);
	});
});

describe("globalProps", () => {
	it("follows the host's update on the background", async () => {
		const page = hostData();
		await page.settle();
		expect(page.engine.text(page.byClass("theme"))).toBe("light");
		page.updateGlobalProps({ theme: "dark" });
		await page.settle();
		expect(page.engine.text(page.byClass("theme"))).toBe("dark");
		expect(page.asBackground(() => globalProps.current)).toEqual({ theme: "dark" });
		expect(page.errors).toEqual([]);
	});

	it("keeps the props the update did not name", async () => {
		const page = hostData({ globalProps: { theme: "light", locale: "en" } });
		await page.settle();
		page.updateGlobalProps({ theme: "dark" });
		await page.settle();
		expect(page.asBackground(() => globalProps.current)).toEqual({ theme: "dark", locale: "en" });
	});
});

describe("systemInfo", () => {
	it("is what Lynx says about the device, read when it is used", async () => {
		const info = { platform: "Android", pixelRatio: 2.75 };
		const page = hostData({ systemInfo: info });
		await page.settle();
		expect(page.engine.text(page.byClass("platform"))).toBe("Android");
		expect(page.asBackground(() => systemInfo.current)).toBe(info);
	});
});
