// A `<scroll-view>` draws every row in the first frame, so a development build warns once for one
// that holds more than about 200 elements directly, pointing to `<list>`.

import { describe, expect, it } from "@rstest/core";

import ManyScrollRows from "../fixtures/threads/ManyScrollRows.svelte";
import { startSveltePage } from "./svelte-page.ts";
import type { SveltePage } from "./svelte-page.ts";

/** The scroll-view warnings a page gave. */
const rowWarnings = (page: SveltePage): Error[] =>
	// Boundary: the page keeps what was reported as it was given; the binding reports errors.
	(page.warnings as (Error & { code?: unknown })[]).filter(
		(warning) => warning.code === "scroll_view_many_children",
	);

describe("a <scroll-view> with many rows", () => {
	it("warns past 200 elements, filled by an {#each}, naming where it is", async () => {
		const page = startSveltePage(ManyScrollRows, { props: { count: 201 } });
		await page.settle();
		const [warning, ...rest] = rowWarnings(page);
		expect(rest).toEqual([]);
		expect(warning!.message).toMatch(
			/^A <scroll-view> holds more than 200 elements directly, and it draws every one of them in the first frame.*\n.*ManyScrollRows\.svelte:20:\d+/,
		);
		expect(warning!.message).toContain("<list>");
	});

	it("is quiet at 200", async () => {
		const page = startSveltePage(ManyScrollRows, { props: { count: 200 } });
		await page.settle();
		expect(rowWarnings(page)).toEqual([]);
	});

	it("warns when rows added later pass the limit, once however many more come", async () => {
		const page = startSveltePage(ManyScrollRows, { props: { count: 150, later: true } });
		await page.settle();
		expect(rowWarnings(page)).toEqual([]);
		page.engine.dispatch(page.byClass("more"), { type: "tap" });
		await page.settle();
		page.engine.dispatch(page.byClass("more"), { type: "tap" });
		await page.settle();
		expect(rowWarnings(page)).toHaveLength(1);
	});
});
