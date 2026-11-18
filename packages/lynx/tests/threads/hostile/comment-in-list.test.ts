// A comment in a list's markup, which Svelte's server writes as it is when an app keeps comments
// (`preserveComments`): its text is never read as tags. A comment that holds `</list-item>` in a
// row leaves the row whole, and a row commented out between rows is no row. A `</list-item>` with
// no row open is markup the server never writes: the first frame is refused, and the background's
// first patch makes the page.

import { describe, expect, it } from "@rstest/core";

import TwoRows from "../../fixtures/threads/TwoRows.svelte";
import { startSveltePage } from "../svelte-page.ts";

const row = (i: number, inside = "") =>
	`<list-item item-key="${i}">${inside}<text>${i}</text></list-item>`;
const list = (rows: string) => `<list class="list"><!--[-->${rows}<!--]--></list>`;

function drawn(markup: string) {
	const page = startSveltePage(TwoRows, { firstFrame: () => markup });
	const native = () => page.engine.list(page.byClass("list"));
	return { page, native };
}

describe("a comment in a list's first frame", () => {
	it("that holds a row's end leaves the row whole, and hydrated", async () => {
		const comment = "<!-- ends with </list-item> -->";
		const { page, native } = drawn(list(row(1, comment) + row(2, comment)));
		expect(page.errors).toEqual([]);
		const first = native().show(0);
		expect(page.engine.text(first)).toBe("1");
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(native().show(0)).toBe(first);
		expect(page.engine.text(native().show(1))).toBe("2");
	});

	it("that holds a row's start leaves the row whole", async () => {
		const { page, native } = drawn(list(row(1, "<!-- a <list-item> and <list> -->") + row(2)));
		expect(page.engine.text(native().show(0))).toBe("1");
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.engine.text(native().show(1))).toBe("2");
	});

	it("that comments a row out between rows draws no row for it", async () => {
		const old = `<!-- <list-item item-key="old"><text>old</text></list-item> -->`;
		const { page, native } = drawn(list(row(1) + old + row(2)));
		expect(
			native()
				.updates.at(-1)!
				.insertAction.map((item) => item["item-key"]),
		).toEqual(["1", "2"]);
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.engine.text(native().show(1))).toBe("2");
	});
});

describe("a row's end with no row open", () => {
	it.each([
		["between rows", list(`${row(1)}</list-item>${row(2)}`)],
		["after a row that closes itself", list(`<list-item item-key="1"/></list-item>${row(2)}`)],
	])("%s refuses the first frame, and the background makes the page", async (_, markup) => {
		const { page, native } = drawn(markup);
		await page.settle();
		expect(page.errors.map((error) => (error as { code?: string }).code)).toEqual([
			"first_frame_markup_unreadable",
		]);
		expect(page.engine.text(native().show(0))).toBe("1");
		expect(page.engine.text(native().show(1))).toBe("2");
	});
});
