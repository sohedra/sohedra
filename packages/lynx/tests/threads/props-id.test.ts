// `$props.id()` gives the same ids in the first frame and on the background, from the first frame
// on: a component that `{#if background}` (or its kin) renders on one thread only takes ids of its
// branch's own (`lynx-b1`… on the background, `lynx-m1`… in the first frame), and every other id
// agrees, so hydration writes none of them.

import { describe, expect, it } from "@rstest/core";

import type { LynxElement } from "../../src/testing/index.ts";
import FrameIdBound from "../fixtures/threads/FrameIdBound.svelte";
import drawFrameIdBound from "../fixtures/threads/FrameIdBound.svelte?first-frame";
import FrameIdBranches from "../fixtures/threads/FrameIdBranches.svelte";
import drawFrameIdBranches from "../fixtures/threads/FrameIdBranches.svelte?first-frame";
import FrameIdDeferred from "../fixtures/threads/FrameIdDeferred.svelte";
import drawFrameIdDeferred from "../fixtures/threads/FrameIdDeferred.svelte?first-frame";
import FrameIdJoined from "../fixtures/threads/FrameIdJoined.svelte";
import drawFrameIdJoined from "../fixtures/threads/FrameIdJoined.svelte?first-frame";
import FrameIdPlain from "../fixtures/threads/FrameIdPlain.svelte";
import drawFrameIdPlain from "../fixtures/threads/FrameIdPlain.svelte?first-frame";
import FrameIdRuns from "../fixtures/threads/FrameIdRuns.svelte";
import drawFrameIdRuns from "../fixtures/threads/FrameIdRuns.svelte?first-frame";
import FrameIdShift from "../fixtures/threads/FrameIdShift.svelte";
import drawFrameIdShift from "../fixtures/threads/FrameIdShift.svelte?first-frame";
import FrameIdUnrecognized from "../fixtures/threads/FrameIdUnrecognized.svelte";
import drawFrameIdUnrecognized from "../fixtures/threads/FrameIdUnrecognized.svelte?first-frame";
import SharedPanel from "../fixtures/threads/shared/SharedPanel.svelte";
import drawSharedPanel from "../fixtures/threads/shared/SharedPanel.svelte?first-frame";
import { startSveltePage } from "./svelte-page.ts";
import type { SveltePage } from "./svelte-page.ts";

/** The elements `FrameLabeled` renders, in document order. */
const labeled = (page: SveltePage): LynxElement[] =>
	page.engine.all().filter((element) => page.engine.state(element).classes === "labeled");

/** Their ids. */
const ids = (page: SveltePage): string[] =>
	labeled(page).map((element) => page.engine.state(element).id ?? "");

/** The elements of the first frame with an id of the page's own, and the id each has. */
const pageIds = (page: SveltePage): [LynxElement, string][] =>
	labeled(page)
		.map((element): [LynxElement, string] => [element, page.engine.state(element).id ?? ""])
		.filter(([, id]) => id.startsWith("lynx-s"));

/** Whether the main thread told the background of ids it wrote over the first frame's. */
const wroteIds = (page: SveltePage): boolean =>
	page.messages.some((message) => message.t === "props-ids");

describe("$props.id() in a branch only one thread renders", () => {
	it("takes the branch's own ids, and every other id is the first frame's", async () => {
		const handles: { open?: (value: boolean) => void } = {};
		const page = startSveltePage(FrameIdBranches, {
			props: () => ({ handles }),
			firstFrame: { draw: drawFrameIdBranches },
		});
		expect(ids(page)).toEqual([
			"lynx-m1",
			"lynx-s1",
			"lynx-s2",
			"lynx-m2",
			"lynx-s3",
			"lynx-m3",
			"lynx-s4",
			"lynx-s5",
		]);
		const drawn = pageIds(page);
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(page.warnings).toEqual([]);
		expect(wroteIds(page)).toBe(false);
		expect(ids(page)).toEqual([
			"lynx-b1",
			"lynx-s1",
			"lynx-b2",
			"lynx-b3",
			"lynx-s2",
			"lynx-s3",
			"lynx-b4",
			"lynx-s4",
			"lynx-b5",
			"lynx-s5",
		]);
		// The first frame's own elements are the page's, with the ids they were drawn with.
		for (const [element, id] of drawn) {
			expect(page.engine.all()).toContain(element);
			expect(page.engine.state(element).id).toBe(id);
		}
	});

	it("gives a component the branch renders later an id no other has", async () => {
		const handles: { open?: (value: boolean) => void } = {};
		const page = startSveltePage(FrameIdBranches, {
			props: () => ({ handles }),
			firstFrame: { draw: drawFrameIdBranches },
		});
		await page.settle();
		page.asBackground(() => handles.open!(true));
		await page.settle();
		const all = ids(page);
		expect(all).toHaveLength(11);
		expect(new Set(all).size).toBe(11);
		expect(page.errors).toEqual([]);
	});
});

describe("$props.id() after a branch only the background renders", () => {
	it("is the first frame's id, before hydration and after, with nothing written", async () => {
		const page = startSveltePage(FrameIdShift, { firstFrame: { draw: drawFrameIdShift } });
		expect(ids(page)).toEqual(["lynx-s1"]);
		const [drawn] = labeled(page);
		await page.settle();
		expect(ids(page)).toEqual(["lynx-b1", "lynx-s1"]);
		expect(labeled(page)[1]).toBe(drawn);
		expect(page.engine.state(drawn!).attrs["accessibility-label"]).toBe("label-lynx-s1");
		expect(wroteIds(page)).toBe(false);
		expect(page.errors).toEqual([]);
	});

	it("is the first frame's id between and after several such branches of one parent", async () => {
		const page = startSveltePage(FrameIdRuns, { firstFrame: { draw: drawFrameIdRuns } });
		expect(ids(page)).toEqual(["lynx-s1", "lynx-s2"]);
		const last = labeled(page)[1];
		await page.settle();
		expect(ids(page)).toEqual(["lynx-b1", "lynx-s1", "lynx-b2", "lynx-s2"]);
		expect(labeled(page)[3]).toBe(last);
		expect(wroteIds(page)).toBe(false);
		expect(page.errors).toEqual([]);
	});

	it("starts again from the first after a reload, with no id twice", async () => {
		const page = startSveltePage(FrameIdShift, { firstFrame: { draw: drawFrameIdShift } });
		await page.settle();
		page.reload();
		await page.settle();
		expect(ids(page)).toEqual(["lynx-b1", "lynx-s1"]);
		expect(page.errors).toEqual([]);
	});

	it("starts again from the first on a second page in the same realm", async () => {
		const first = startSveltePage(FrameIdShift, { firstFrame: { draw: drawFrameIdShift } });
		await first.settle();
		expect(ids(first)).toEqual(["lynx-b1", "lynx-s1"]);
		const second = startSveltePage(FrameIdShift, { firstFrame: { draw: drawFrameIdShift } });
		expect(ids(second)).toEqual(["lynx-s1"]);
		await second.settle();
		expect(ids(second)).toEqual(["lynx-b1", "lynx-s1"]);
		expect(wroteIds(second)).toBe(false);
		expect(second.errors).toEqual([]);
	});
});

describe("$props.id() in a deferred list row", () => {
	it("takes the page's next ids when Lynx asks for the row, after every id of the first frame", async () => {
		const page = startSveltePage(FrameIdDeferred, { firstFrame: { draw: drawFrameIdDeferred } });
		expect(ids(page)).toEqual(["lynx-s1", "lynx-s2"]);
		const drawn = pageIds(page);
		await page.settle();
		expect(ids(page)).toEqual(["lynx-s1", "lynx-s2"]);
		expect(wroteIds(page)).toBe(false);
		const list = page.engine.list(page.byClass("list"));
		list.ask(0);
		await page.settle();
		expect(ids(page)).toEqual(["lynx-s1", "lynx-b1", "lynx-s3", "lynx-s2"]);
		// The row after it rendered with it, as a row ahead.
		list.show(1);
		expect(ids(page)).toEqual(["lynx-s1", "lynx-b1", "lynx-s3", "lynx-b2", "lynx-s4", "lynx-s2"]);
		for (const [element, id] of drawn) expect(page.engine.state(element).id).toBe(id);
		expect(page.errors).toEqual([]);
		expect(page.warnings).toEqual([]);
	});

	it("among its list's initial rows, takes the first frame's ids, where the first frame drew it", async () => {
		const props = { initial: 2 };
		const page = startSveltePage(FrameIdDeferred, {
			props: () => props,
			firstFrame: { draw: drawFrameIdDeferred, props },
		});
		// Lynx makes a row's elements when it asks for the row: the first frame drew both whole.
		const list = page.engine.list(page.byClass("list"));
		list.show(0);
		list.show(1);
		expect(ids(page)).toEqual(["lynx-s1", "lynx-s2", "lynx-s3", "lynx-s4"]);
		const drawn = pageIds(page);
		await page.settle();
		expect(wroteIds(page)).toBe(false);
		expect(ids(page)).toEqual(["lynx-s1", "lynx-b1", "lynx-s2", "lynx-b2", "lynx-s3", "lynx-s4"]);
		for (const [element, id] of drawn) expect(page.engine.state(element).id).toBe(id);
		expect(page.errors).toEqual([]);
		expect(page.warnings).toEqual([]);
	});

	it("takes the page's next ids on a list that is not Lynx's async list", async () => {
		const page = startSveltePage(FrameIdDeferred, {
			props: () => ({ async: false }),
			firstFrame: { draw: drawFrameIdDeferred, props: { async: false } },
		});
		expect(ids(page)).toEqual(["lynx-s1", "lynx-s2"]);
		await page.settle();
		page.engine.list(page.byClass("list")).show(1);
		expect(ids(page)).toEqual(["lynx-s1", "lynx-b2", "lynx-s4", "lynx-s2"]);
		expect(wroteIds(page)).toBe(false);
		expect(page.errors.map((error) => (error as { code?: string }).code)).toEqual([
			"list_item_defer_needs_async_list",
		]);
	});
});

describe("$props.id() after other tests only one thread passes", () => {
	it("is the first frame's id after {#if BROWSER} from esm-env, in a shared package's component", async () => {
		const page = startSveltePage(SharedPanel, { firstFrame: { draw: drawSharedPanel } });
		const fields = (): string[] =>
			page.engine
				.all()
				.filter((element) => page.engine.state(element).classes === "shared-field")
				.map((element) => page.engine.state(element).id ?? "");
		expect(fields()).toEqual(["lynx-m1", "lynx-s1"]);
		await page.settle();
		expect(fields()).toEqual(["lynx-b1", "lynx-s1"]);
		expect(wroteIds(page)).toBe(false);
		expect(page.errors).toEqual([]);
	});

	it("is the first frame's id after {#if background && ready}", async () => {
		const page = startSveltePage(FrameIdJoined, { firstFrame: { draw: drawFrameIdJoined } });
		expect(ids(page)).toEqual(["lynx-s1"]);
		await page.settle();
		expect(ids(page)).toEqual(["lynx-b1", "lynx-s1"]);
		expect(wroteIds(page)).toBe(false);
		expect(page.errors).toEqual([]);
	});
});

describe("$props.id() on a page with no branch only one thread renders", () => {
	it("is as it was: lynx-s1, lynx-s2… on both threads", async () => {
		const page = startSveltePage(FrameIdPlain, { firstFrame: { draw: drawFrameIdPlain } });
		expect(ids(page)).toEqual(["lynx-s1", "lynx-s2"]);
		await page.settle();
		expect(ids(page)).toEqual(["lynx-s1", "lynx-s2"]);
		expect(wroteIds(page)).toBe(false);
	});
});

describe("ids that differ between the threads", () => {
	it("follow a component binding whose child sets the value as it starts: a known gap", async () => {
		// Svelte's server renders the page again until such a binding settles, and the second pass
		// counts its ids on from the first. The background renders once, so the frame's are written
		// over. This pins it until the first frame counts each pass from the same start.
		const page = startSveltePage(FrameIdBound, { firstFrame: { draw: drawFrameIdBound } });
		const labelled = (): string[] =>
			page.engine
				.all()
				.filter((element) => page.engine.state(element).classes === "labelled")
				.map((element) => page.engine.state(element).id ?? "");
		expect(labelled()).toEqual(["lynx-s3", "lynx-s4"]);
		await page.settle();
		expect(labelled()).toEqual(["lynx-s1", "lynx-s2"]);
		expect(page.errors).toEqual([]);
		expect(wroteIds(page)).toBe(true);
		expect(page.warnings.map((warning) => (warning as Error).message)).toEqual([
			expect.stringContaining("a component binding whose child changes the bound value"),
			expect.stringContaining("a component binding whose child changes the bound value"),
		]);
	});

	const messages = (reports: unknown[]): string[] =>
		reports.map((report) => (report instanceof Error ? report.message : String(report)));

	it("are written over the first frame's, and a development build warns once per place", async () => {
		const page = startSveltePage(FrameIdUnrecognized, {
			firstFrame: { draw: drawFrameIdUnrecognized },
		});
		expect(ids(page)).toEqual(["lynx-s1", "lynx-s2"]);
		await page.settle();
		expect(page.errors).toEqual([]);
		expect(ids(page)).toEqual(["lynx-s1", "lynx-s2", "lynx-s3"]);
		expect(wroteIds(page)).toBe(true);
		// Two elements of one place, each with two attributes that hold an id: one warning each.
		expect(messages(page.warnings)).toMatchSnapshot();
	});
});
