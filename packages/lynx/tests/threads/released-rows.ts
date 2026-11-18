// A page of 40 released rows (../fixtures/threads/ReleasedRows.svelte) on both threads, and what
// the release tests do to it: scroll it as Lynx does, change its rows on the background, and hold
// what the main thread sends or schedules, to run it later.

import type { LynxElement } from "../../src/testing/index.ts";
import { decodeToBackground } from "../../src/wire/index.ts";
import type { CellItem, ThreadEvent } from "../../src/wire/index.ts";
import ReleasedRows from "../fixtures/threads/ReleasedRows.svelte";
import { backgroundTree, engineTree, expectSameTree } from "./generated/trees.ts";
import { scroller, scrollThrough } from "./scroll.ts";
import { startSveltePage } from "./svelte-page.ts";
import type { SveltePage } from "./svelte-page.ts";

export interface Feed {
	rows: { id: number; label: string }[];
	show: boolean;
	fixed: number;
}

/** The ids `from` to `to`, both included. */
export const range = (from: number, to: number): number[] =>
	Array.from({ length: to - from + 1 }, (_, index) => from + index);

/** Holds the main thread's requests to write rows again, until `deliver`. */
export function holdRequests(page: SveltePage) {
	const context = page.lynx.mainThread.getJSContext();
	const send = context.dispatchEvent.bind(context);
	const held: ThreadEvent[] = [];
	context.dispatchEvent = (event) => {
		if (decodeToBackground(event).t === "rewrite") held.push(event as ThreadEvent);
		else send(event);
	};
	return {
		held,
		/** Sends the request held at `index`, and goes on holding the others. */
		deliverOne(index: number) {
			send(held.splice(index, 1)[0]!);
		},
		deliver() {
			context.dispatchEvent = send;
			for (const event of held.splice(0)) send(event);
		},
	};
}

/** Holds what the main thread schedules on a later task, until `run`. */
export function holdTimers(page: SveltePage) {
	const lynx = page.lynx.mainThread;
	const schedule = lynx.setTimeout.bind(lynx);
	const held: (() => void)[] = [];
	lynx.setTimeout = (callback) => void held.push(callback);
	return {
		held,
		/** Runs what is held now, as the main thread; what that schedules is held in turn. */
		run() {
			for (const callback of held.splice(0)) page.asMainThread(callback);
		},
		release() {
			lynx.setTimeout = schedule;
		},
	};
}

/** Lynx shows what the background rendered, every row asked for. */
export function expectInSync(what: string, page: SveltePage): void {
	expectSameTree(engineTree(page.engine), backgroundTree(), what);
}

/** The cell items that write a row again. */
export const rewrittenCells = (page: SveltePage): CellItem[] =>
	page.patches
		.flatMap((patch) => patch.items)
		.filter((item): item is CellItem => item[0] === "cell" && item[3] === true);

/** The ids the main thread asked the background to write again. */
export const askedFor = (page: SveltePage): number[] =>
	page.messages.flatMap((message) => (message.t === "rewrite" ? message.nodes : []));

/** Starts the page, and Lynx shows its first screen of rows. */
export async function releasedRows(
	options: { count?: number; preload?: number; screen?: number; fixed?: number } = {},
) {
	const handles: Record<string, unknown> = {};
	const { screen, fixed, ...props } = options;
	const page = startSveltePage(ReleasedRows, { props: () => ({ handles, ...props }) });
	await page.settle();
	const feed = handles["feed"] as Feed;
	if (fixed !== undefined) {
		page.asBackground(() => (feed.fixed = fixed));
		await page.settle();
	}
	const scroll = scroller(page.engine, page.byClass("list"), {
		...(screen !== undefined && { screen }),
		...(props.preload !== undefined && { preload: props.preload }),
	});
	scroll.to(0);
	await page.settle();
	const through = (from: number, to: number) =>
		scrollThrough({ scroll, from, to, settle: page.settle });
	const change = async (update: (feed: Feed) => void) => {
		page.asBackground(() => update(feed));
		await page.settle();
	};
	/** The ids of the rows whose elements are on the page, in order. */
	const rowsOnPage = () =>
		page.engine
			.all()
			.map((element) => /\brow-(\d+)\b/.exec(page.engine.state(element).classes)?.[1])
			.filter((id) => id !== undefined)
			.map(Number)
			.sort((a, b) => a - b);
	const row = (id: number) => page.byClass(`row-${id}`);
	const within = (element: LynxElement, token: string) =>
		page.engine
			.all(element)
			.find((found) => page.engine.state(found).classes.split(" ").includes(token))!;
	const tap = async (id: number) => {
		page.engine.dispatch(row(id), { type: "tap" });
		await page.settle();
	};
	return { page, handles, feed, scroll, through, change, rowsOnPage, row, within, tap };
}
