// A reload after the host updated its global props: the page's `props` function gets the global
// props as the host left them, not as the page opened with them.

import { describe, expect, it } from "@rstest/core";

import Titled from "../../fixtures/threads/page/Titled.svelte";
import { startSveltePage } from "../svelte-page.ts";

describe("a reload after the host updated its global props", () => {
	it("gives the props function the updated global props", async () => {
		const given: unknown[] = [];
		const page = startSveltePage(Titled, {
			globalProps: { theme: "light", route: "/inbox" },
			props: (_data, globals) => {
				given.push(globals);
				return { title: String(globals["theme"]), route: String(globals["route"]) };
			},
		});
		await page.settle();
		page.updateGlobalProps({ theme: "dark" });
		await page.settle();
		page.reload();
		await page.settle();
		expect(given).toEqual([
			{ theme: "light", route: "/inbox" },
			{ theme: "dark", route: "/inbox" },
		]);
		expect(page.engine.texts()).toEqual(["dark", "/inbox", "none"]);
		expect(page.errors).toEqual([]);
	});
});
