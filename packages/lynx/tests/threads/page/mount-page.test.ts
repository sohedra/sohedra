// `mountPage` on both threads: the root component's props, as an object or as a function of the
// page's data and the host's global props, and the context it is mounted with. The first frame
// draws from the same options as the background mounts with, so hydration finds what it drew.

import { describe, expect, it } from "@rstest/core";

import Titled from "../../fixtures/threads/page/Titled.svelte";
import drawTitled from "../../fixtures/threads/page/Titled.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";
import type { SveltePageOptions } from "../svelte-page.ts";

/** The page's title, route and theme, as Lynx shows them. */
const shown = (page: ReturnType<typeof startSveltePage>) => page.engine.texts();

/** Starts the page with `options` on both threads, its first frame drawn from the same. */
function titled(options: SveltePageOptions) {
	return startSveltePage(Titled, {
		...options,
		firstFrame: {
			draw: drawTitled,
			...(options.props && { props: options.props }),
			...(options.context && { context: options.context }),
		},
	});
}

describe("mountPage's props", () => {
	it("are an object, given to the root component on both threads", async () => {
		const page = titled({ props: { title: "Inbox", route: "/inbox" } });
		expect(shown(page)).toEqual(["Inbox", "/inbox", "none"]);
		await page.settle();
		expect(shown(page)).toEqual(["Inbox", "/inbox", "none"]);
		expect(page.patches.flatMap((patch) => patch.items.map((item) => item[0]))).not.toContain(
			"rewrite",
		);
		expect(page.errors).toEqual([]);
	});

	it("are a function of the page's data and the host's global props, on both threads", async () => {
		const page = titled({
			initData: { title: "Inbox" },
			globalProps: { route: "/inbox" },
			props: (data, globals) => ({ title: String(data["title"]), route: String(globals["route"]) }),
		});
		expect(shown(page)).toEqual(["Inbox", "/inbox", "none"]);
		await page.settle();
		expect(shown(page)).toEqual(["Inbox", "/inbox", "none"]);
		expect(page.errors).toEqual([]);
	});

	it("are made again from the merged data at a reload", async () => {
		const calls: unknown[] = [];
		const page = startSveltePage(Titled, {
			initData: { title: "Inbox" },
			props: (data) => {
				calls.push(data);
				return { title: String(data["title"]) };
			},
		});
		await page.settle();
		page.reload({ title: "Sent" });
		await page.settle();
		expect(shown(page)[0]).toBe("Sent");
		expect(calls).toEqual([{ title: "Inbox" }, { title: "Sent" }]);
	});

	it("given as an object, are the same at a reload", async () => {
		const page = startSveltePage(Titled, { props: { title: "Inbox" } });
		await page.settle();
		page.reload({ title: "Sent" });
		await page.settle();
		expect(shown(page)[0]).toBe("Inbox");
		expect(page.errors).toEqual([]);
	});

	it("left out, give the root component none", async () => {
		const page = startSveltePage(Titled);
		await page.settle();
		expect(shown(page)).toEqual(["", "", "none"]);
	});
});

describe("mountPage's context", () => {
	it("reaches the root component on both threads, and hydration keeps what the first frame drew", async () => {
		const page = titled({ props: { title: "Inbox" }, context: new Map([["theme", "dark"]]) });
		const drawn = page.engine.all();
		expect(shown(page)).toEqual(["Inbox", "", "dark"]);
		await page.settle();
		expect(shown(page)).toEqual(["Inbox", "", "dark"]);
		expect(page.engine.all()).toEqual(expect.arrayContaining(drawn));
		expect(page.errors).toEqual([]);
	});

	it("reaches the root component again at a reload", async () => {
		const page = startSveltePage(Titled, { context: new Map([["theme", "dark"]]) });
		await page.settle();
		page.reload();
		await page.settle();
		expect(shown(page)[2]).toBe("dark");
	});
});
