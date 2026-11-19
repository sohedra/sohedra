// A portal built on `mount`, opened and closed from an {#if}, from keyed {#each} rows and from a
// list row: the layer comes and goes, and the page's own elements stay as they were.

import { describe, expect, it } from "@rstest/core";

import type { LynxElement } from "../../../src/testing/index.ts";
import PortalHost from "../../fixtures/threads/page/PortalHost.svelte";
import PortalList from "../../fixtures/threads/page/PortalList.svelte";
import { startSveltePage } from "../svelte-page.ts";
import type { SveltePage } from "../svelte-page.ts";

/** What the fixtures fill in: how the test opens and closes their portals. */
interface Handles {
	open(value: boolean | string | null): void;
	setOpened(row: string, value: boolean): void;
	setRows(rows: string[]): void;
}

function portals(App: typeof PortalHost) {
	const log: unknown[] = [];
	// Boundary: the fixture fills the handles in as it starts.
	const handles = {} as Handles;
	const page = startSveltePage(App, { props: () => ({ handles, log }) });
	const classesOf = (element: LynxElement) =>
		[...(element as Element).children].map(
			(child) => page.engine.state(child as LynxElement).classes,
		);
	const rootChildren = () => classesOf(page.engine.page()!);
	/** The page's own elements, by identity: one built again would be another object. */
	const pageElements = () =>
		[...(page.engine.page() as Element).children]
			.filter((child) => !page.engine.state(child as LynxElement).classes.startsWith("layer"))
			.flatMap((child) => page.engine.all(child as LynxElement));
	const act = async (change: () => void) => {
		page.asBackground(change);
		await page.settle();
	};
	return { page, log, handles, classesOf, rootChildren, pageElements, act };
}

const themeIn = (page: SveltePage, label: string) =>
	page.engine.text((page.byClass(label) as Element).firstElementChild as LynxElement);

describe("a portal", () => {
	it("opens and closes in an {#if}, with the context it was opened with, and the siblings left alone", async () => {
		const { page, log, handles, rootChildren, pageElements, act } = portals(PortalHost);
		await page.settle();
		expect(rootChildren()).toEqual(["page", "tail"]);
		const before = pageElements();
		await act(() => handles.open(true));
		expect(rootChildren()).toEqual(["page", "tail", "layer if"]);
		expect(pageElements()).toEqual(before);
		expect(themeIn(page, "if")).toBe("dark");
		await act(() => handles.open(false));
		expect(rootChildren()).toEqual(["page", "tail"]);
		expect(pageElements()).toEqual(before);
		expect(log).toContain("destroyed if");
		expect(page.errors).toEqual([]);
	});

	it("opens in a keyed {#each} row, stays through a reorder, and goes with its row", async () => {
		const { page, log, handles, classesOf, rootChildren, pageElements, act } = portals(PortalHost);
		await page.settle();
		const rows = () => classesOf(page.byClass("page"));
		const before = pageElements();
		await act(() => handles.setOpened("b", true));
		expect(rootChildren()).toEqual(["page", "tail", "layer b"]);
		expect(pageElements()).toEqual(before);
		await act(() => handles.setRows(["c", "b", "a"]));
		expect(rows()).toEqual(["before", "after", "row c", "row b", "row a"]);
		expect(rootChildren()).toEqual(["page", "tail", "layer b"]);
		await act(() => handles.setRows(["c", "a"]));
		expect(rootChildren()).toEqual(["page", "tail"]);
		expect(log).toContain("destroyed b");
		expect(page.errors).toEqual([]);
	});

	it("goes with the page", async () => {
		const { page, handles, act } = portals(PortalHost);
		await page.settle();
		await act(() => handles.open(true));
		page.destroy();
		await page.settle();
		expect(page.engine.listenerCount()).toBe(0);
		expect(page.errors).toEqual([]);
	});

	it("opens and closes from a list row, with the list and its rows left alone", async () => {
		const { page, handles, rootChildren, pageElements, act } = portals(PortalList);
		await page.settle();
		const list = page.byClass("feed");
		const cells = [0, 1, 2].map((index) => page.engine.list(list).ask(index)!);
		await page.settle();
		const updates = page.engine.list(list).updates.length;
		const before = pageElements();
		await act(() => handles.open("b"));
		expect(rootChildren()).toEqual(["feed", "tail", "layer b"]);
		expect(pageElements()).toEqual(before);
		expect(cells.map((cell) => page.engine.text(cell))).toEqual(["a", "b", "c"]);
		await act(() => handles.open(null));
		expect(rootChildren()).toEqual(["feed", "tail"]);
		expect(pageElements()).toEqual(before);
		expect(page.engine.list(list).updates).toHaveLength(updates);
		expect(page.errors).toEqual([]);
	});
});
