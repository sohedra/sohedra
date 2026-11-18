// A page of 40 released rows (../fixtures/threads/ReleasedRows.svelte) on both threads, and what
// the release tests do to it: scroll it as Lynx does, change its rows on the background, and hold
// what the main thread sends or schedules, to run it later.

import type { LynxElement } from "../../src/testing/index.ts";
import { decodeToBackground } from "../../src/wire/index.ts";
import type { CellItem, ThreadEvent } from "../../src/wire/index.ts";
import ReleasedRows from "../fixtures/threads/ReleasedRows.svelte";
import { backgroundTree, engineTree, expectSameTree } from "./generated/trees.ts";
import { scroller, scrollThrough } from "./scroll.ts";
import type { Scroller } from "./scroll.ts";
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

/** Requests to write rows again, held on their way to the background. */
export interface HeldRequests {
	held: ThreadEvent[];
	/** Sends the request held at `index`, and goes on holding the others. */
	deliverOne(index: number): void;
	/** Sends every request held, and holds no more. */
	deliver(): void;
}

/** Holds the main thread's messages of a kind, its requests to write rows again by default, until `deliver`. */
export function holdRequests(page: SveltePage, kind = "rewrite"): HeldRequests {
	const context = page.lynx.mainThread.getJSContext();
	const send = context.dispatchEvent.bind(context);
	const held: ThreadEvent[] = [];
	context.dispatchEvent = (event) => {
		if (decodeToBackground(event).t === kind) held.push(event as ThreadEvent);
		else send(event);
	};
	return {
		held,
		deliverOne(index) {
			send(held.splice(index, 1)[0]!);
		},
		deliver() {
			context.dispatchEvent = send;
			for (const event of held.splice(0)) send(event);
		},
	};
}

/** What the main thread scheduled on a later task, held. */
export interface HeldTimers {
	held: (() => void)[];
	/** Runs what is held now, as the main thread; what that schedules is held in turn. */
	run(): void;
	/** Schedules as before, from now on. */
	release(): void;
}

/** Holds what the main thread schedules on a later task, until `run`. */
export function holdTimers(page: SveltePage): HeldTimers {
	const lynx = page.lynx.mainThread;
	const schedule = lynx.setTimeout.bind(lynx);
	const held: (() => void)[] = [];
	lynx.setTimeout = (callback) => {
		held.push(callback);
		return { canceled: false };
	};
	return {
		held,
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

/**
 * Lynx asks for every row of every list, the threads settle, and then Lynx shows what the
 * background rendered: a deferred row comes once it is asked for.
 */
export async function expectInSyncOnceAsked(what: string, page: SveltePage): Promise<void> {
	// A list inside a row is there once its row came: ask again until every row came.
	for (let round = 0; round < 4; round++) {
		let waiting = 0;
		for (const element of page.engine.all()) {
			const list = page.engine.state(element).list;
			if (!list) continue;
			for (let index = 0; index < list.items; index++)
				if (!page.engine.list(element).ask(index)) waiting++;
		}
		await page.settle();
		if (waiting === 0) break;
	}
	expectInSync(what, page);
}

/** The cell items that write a row again. */
export const rewrittenCells = (page: SveltePage): CellItem[] =>
	page.patches
		.flatMap((patch) => patch.items)
		.filter((item): item is CellItem => item[0] === "cell" && item[3] === true);

/** The ids the main thread asked the background to write again. */
export const askedFor = (page: SveltePage): number[] =>
	page.messages.flatMap((message) => (message.t === "rewrite" ? message.nodes : []));

/** The page of released rows, and what a test does to it. */
export interface RowsPage {
	page: SveltePage;
	handles: Record<string, unknown>;
	feed: Feed;
	scroll: Scroller;
	/** Scrolls one row at a time, letting the threads settle on the way. */
	through(from: number, to: number): Promise<void>;
	/** Changes the rows on the background, and lets the threads settle. */
	change(update: (feed: Feed) => void): Promise<void>;
	/** The ids of the rows whose elements are on the page, in order. */
	rowsOnPage(): number[];
	/** The element of a row. */
	row(id: number): LynxElement;
	/** The element with this class token under `element`. */
	within(element: LynxElement, token: string): LynxElement;
	/** Taps a row, and lets the threads settle. */
	tap(id: number): Promise<void>;
}

/** Starts the page, and Lynx shows its first screen of rows. */
export async function releasedRows(
	options: { count?: number; preload?: number; screen?: number; fixed?: number } = {},
): Promise<RowsPage> {
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
