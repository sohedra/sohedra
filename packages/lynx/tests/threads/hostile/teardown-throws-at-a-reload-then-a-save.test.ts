// A page whose teardown throws, reloaded, then a save. Svelte hands the teardown's error to the
// promise `unmount` returns, so it is reported a microtask after the reload, when the new page has
// started: it used to mark the new page as crashed, and the save loaded it again for nothing.

import { describe, expect, it } from "@rstest/core";

import TeardownThrows from "../../fixtures/threads/page/TeardownThrows.svelte";
import { devLoop } from "../errors/dev-loop.ts";
import { startSveltePage } from "../svelte-page.ts";

describe("a teardown that throws at a reload, then a save", () => {
	it("is reported, and the save leaves the new page as it is", async () => {
		const page = startSveltePage(TeardownThrows, { onError: () => {} });
		await page.settle();
		const { save } = devLoop(page);
		page.reload();
		await page.settle();
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(page.errors.map((error) => (error as Error).message.split("\n")[0])).toEqual([
			"teardown failed",
		]);
		expect(save()).toBe(0);
	});
});
