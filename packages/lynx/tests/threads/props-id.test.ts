// `$props.id()` gives the same ids in the first frame and on the background, from the first frame
// on: a component that `{#if background}` (or its kin) renders on one thread only takes ids of its
// branch's own (`lynx-b1`… on the background, `lynx-m1`… in the first frame), and every other id
// agrees, so hydration writes none of them.

import { describe, expect, it } from "@rstest/core";

import type { LynxElement } from "../../src/testing/index.ts";
import FrameIdBranches from "../fixtures/threads/FrameIdBranches.svelte";
import drawFrameIdBranches from "../fixtures/threads/FrameIdBranches.svelte?first-frame";
import FrameIdPlain from "../fixtures/threads/FrameIdPlain.svelte";
import drawFrameIdPlain from "../fixtures/threads/FrameIdPlain.svelte?first-frame";
import FrameIdShift from "../fixtures/threads/FrameIdShift.svelte";
import drawFrameIdShift from "../fixtures/threads/FrameIdShift.svelte?first-frame";
import FrameIdUnrecognized from "../fixtures/threads/FrameIdUnrecognized.svelte";
import drawFrameIdUnrecognized from "../fixtures/threads/FrameIdUnrecognized.svelte?first-frame";
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
		expect(all).toHaveLength(9);
		expect(new Set(all).size).toBe(9);
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
