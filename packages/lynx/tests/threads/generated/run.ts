// Runs a generated page on both threads of a test page, and what happens to it: the state changed
// on the background, taps, Lynx asking for list cells and handing them back, a scroll through a
// list, a layer mounted above the page and taken away, the host's data and a reload.

import * as env from "@sohedra/lynx/env";
import * as experimental from "@sohedra/lynx/experimental";
import * as gesture from "@sohedra/lynx/gesture";
import fc from "fast-check";
import type { Component } from "svelte";

import * as functions from "../../../src/background/functions-entry.ts";
import renderer, { deferredRow } from "../../../src/background/renderer/entry.ts";
import * as root from "../../../src/background/root-entry.ts";
import * as internals from "../../../src/svelte/runtime/client-internals.ts";
import { readGlobal, removeGlobals } from "../../../src/testing/globals.ts";
import type { LynxElement } from "../../../src/testing/index.ts";
import { FIRST_FRAME_GLOBAL } from "../../../src/wire/index.ts";
import drawGeneratedFrame from "../../fixtures/threads/GeneratedFrame.svelte?first-frame";
import GeneratedLayer from "../../fixtures/threads/GeneratedLayer.svelte";
import { recyclable, SCREEN } from "../scroll.ts";
import { startSveltePage } from "../svelte-page.ts";
import type { SveltePage } from "../svelte-page.ts";
import type { CompiledBoth } from "./compile.ts";
import { evaluatePage, IDS, INTERNALS, RENDERER } from "./evaluate.ts";
import { pageState, STATE_KEYS, stateValue } from "./state.ts";
import type { PageState } from "./state.ts";
import { listKeys } from "./trees.ts";

/** Something that happens to a running page. Numbers pick among what is there when it happens. */
export type Step =
	| { kind: "set"; key: keyof PageState; value: unknown }
	| { kind: "tap"; pick: number }
	| { kind: "show"; list: number; index: number }
	| { kind: "hide"; list: number; cell: number }
	/** Lynx scrolls a list to show a screen of items from `to` on, handing back what leaves it. */
	| { kind: "scroll"; list: number; to: number }
	/** A scroll, then a change of the state once the threads settle, with no list read between. */
	| { kind: "scroll-then-set"; list: number; to: number; key: keyof PageState; value: unknown }
	/**
	 * Lynx asks for a cell, and the state changes before the threads settle: a deferred row changes
	 * while the request for it is on its way.
	 */
	| { kind: "show-then-set"; list: number; index: number; key: keyof PageState; value: unknown }
	/** A layer is mounted above the page, or the one mounted is taken away. */
	| { kind: "layer" }
	| { kind: "update"; data: PageState }
	| { kind: "reload"; data: PageState };

const pick = fc.nat({ max: 50 });

/** A change of the state, from the background. */
const setStep: fc.Arbitrary<Extract<Step, { kind: "set" }>> = fc
	.constantFrom(...STATE_KEYS)
	.chain((key) => stateValue(key).map((value) => ({ kind: "set" as const, key, value })));

/** Something that happens to a page on screen. */
export const step: fc.Arbitrary<Step> = fc.oneof(
	{
		weight: 2,
		arbitrary: fc
			.record({ list: pick, to: pick, set: setStep })
			.map(({ list, to, set }): Step => ({ ...set, kind: "scroll-then-set", list, to })),
	},
	{
		weight: 2,
		arbitrary: fc
			.record({ list: pick, index: pick, set: setStep })
			.map(({ list, index, set }): Step => ({ ...set, kind: "show-then-set", list, index })),
	},
	{ weight: 4, arbitrary: setStep },
	{ weight: 3, arbitrary: pick.map((n): Step => ({ kind: "tap", pick: n })) },
	{
		weight: 2,
		arbitrary: fc
			.record({ list: pick, index: pick })
			.map(({ list, index }): Step => ({ kind: "show", list, index })),
	},
	{
		weight: 1,
		arbitrary: fc
			.record({ list: pick, cell: pick })
			.map(({ list, cell }): Step => ({ kind: "hide", list, cell })),
	},
	{
		weight: 2,
		arbitrary: fc
			.record({ list: pick, to: pick })
			.map(({ list, to }): Step => ({ kind: "scroll", list, to })),
	},
	{ weight: 1, arbitrary: fc.constant<Step>({ kind: "layer" }) },
	{ weight: 1, arbitrary: pageState.map((data): Step => ({ kind: "update", data })) },
	{ weight: 1, arbitrary: pageState.map((data): Step => ({ kind: "reload", data })) },
);

/** What happens before the background's first patch reaches the main thread: no state yet. */
export const earlyStep: fc.Arbitrary<Step> = step.filter(
	(early) =>
		early.kind !== "set" && early.kind !== "scroll-then-set" && early.kind !== "show-then-set",
);

/** A running generated page, and the state its root component shares with the test. */
export interface GeneratedPage {
	readonly page: SveltePage;
	/** The root component's state, on the background. */
	readonly handles: { st?: Record<string, unknown> };
	/**
	 * The `$props.id()` of each component, in the order each thread made them, as `Name id`, and
	 * `Name id one-thread` for one the grammar put where only one thread renders.
	 */
	readonly ids: { readonly frame: string[]; readonly background: string[] };
	/** The layer a step mounted, until a step takes it away or the page reloads. */
	layer: Record<string, unknown> | undefined;
}

/** The test module a generated component records its id with. */
type Recorder = { recordId: (component: string, id: string, oneThread: boolean) => void };

/** A module that records each id of `$props.id()` in `into`. */
const recorder = (into: string[]): Recorder => ({
	recordId: (component, id, oneThread) =>
		void into.push(`${component} ${id}${oneThread ? " one-thread" : ""}`),
});

/** How a generated page starts. */
export interface StartOptions {
	compiled: CompiledBoth;
	data: PageState;
	/** Draw the first frame from the data, as a built page whose script draws it. */
	firstFrame: boolean;
	/**
	 * What `background` from `@sohedra/lynx/env` is on the background: `false` (and `mainThread`
	 * `true`) renders there what the first frame renders, as a reference for it.
	 */
	background?: boolean;
	/** The keys of the data that come from the template; the host gives the rest. */
	fromTemplate?: readonly (keyof PageState)[];
}

const copy = <T>(value: T): T => structuredClone(value);

/** What the template's data holds under the host's: shown only when the host's is not merged over it. */
const UNDER_THE_HOST: Partial<PageState> = { s0: "the template's", b0: true, n0: 2 };

/**
 * The page's data, as the template's and the host's: the engine renders the page with the host's
 * over the template's, and gives the background each on its own (`_params`).
 */
function splitData(data: PageState, fromTemplate: readonly (keyof PageState)[]) {
	const template: Record<string, unknown> = {};
	const host: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(copy(data)))
		(fromTemplate.includes(key as keyof PageState) ? template : host)[key] = value;
	return { templateData: { template, host: UNDER_THE_HOST }, initData: { host } };
}

/** The root's props from the page's data: the host's keys over the template's. */
const rootData = (initData: Record<string, unknown>): Record<string, unknown> =>
	copy({
		...(initData["template"] as Record<string, unknown> | undefined),
		...(initData["host"] as Record<string, unknown> | undefined),
	});

/**
 * Loads a page's main-thread copy, which registers its main-thread functions, and keeps none of
 * what it renders: no first frame is drawn.
 */
function registerBodies(compiled: CompiledBoth, data: PageState): void {
	drawGeneratedFrame({
		page: compiled.mainThread,
		props: { data: copy(data), handles: {} },
		ids: recorder([]),
	});
	// Boundary: the copy records a function of the page's data, which loads the copy.
	(readGlobal(FIRST_FRAME_GLOBAL) as (data: object) => unknown)({});
	removeGlobals([FIRST_FRAME_GLOBAL]);
}

/** Starts the page; its first frame is drawn when this returns, its first patch is on its way. */
export function startGenerated(options: StartOptions): GeneratedPage {
	const { compiled, data, firstFrame } = options;
	const handles: { st?: Record<string, unknown> } = {};
	const ids = { frame: [] as string[], background: [] as string[] };
	const backgroundEnv =
		options.background === false ? { ...env, background: false, mainThread: true } : env;
	// Boundary: the generated root component takes `data` and `handles`.
	const App = evaluatePage(compiled.background, {
		[INTERNALS]: internals,
		[RENDERER]: { default: renderer, deferredRow },
		"@sohedra/lynx": root,
		"@sohedra/lynx/env": backgroundEnv,
		"@sohedra/lynx/gesture": gesture,
		"@sohedra/lynx/experimental": experimental,
		"@sohedra/lynx/internal/main-thread-functions": functions,
		"svelte/internal/disclose-version": {},
		"svelte/internal/flags/custom-renderer": {},
		[IDS]: recorder(ids.background),
	}) as Component<Record<string, unknown>>;
	// The page's main-thread functions register as its main-thread copy loads, as a built page's
	// script does: drawn as the first frame, or loaded alone.
	if (!firstFrame) registerBodies(compiled, data);
	const page = startSveltePage(App, {
		...splitData(data, options.fromTemplate ?? []),
		props: (initData) => ({ data: rootData(initData), handles }),
		...(firstFrame && {
			firstFrame: {
				draw: drawGeneratedFrame,
				props: {
					page: compiled.mainThread,
					props: { data: copy(data) },
					ids: recorder(ids.frame),
				},
			},
		}),
	});
	return { page, handles, ids, layer: undefined };
}

/** The key of a cell's item. */
const keyOf = (page: SveltePage, cell: LynxElement): string =>
	String(page.engine.state(cell).attrs["item-key"]);

/**
 * The cells of a list that show one of its items now. The engine fake keeps the cell of an item
 * that was taken out, which Lynx would hand back and never ask about again.
 */
function liveCells(page: SveltePage, list: LynxElement): LynxElement[] {
	const keys = new Set(listKeys(page.engine, list));
	// Boundary: a list's children in the engine are the cells Lynx holds.
	return ([...list.childNodes] as LynxElement[]).filter((cell) => keys.has(keyOf(page, cell)));
}

/** The live cells Lynx may hand back: those of recyclable items. */
function recyclableCells(page: SveltePage, list: LynxElement): LynxElement[] {
	return liveCells(page, list).filter((cell) => recyclable(page.engine, list, keyOf(page, cell)));
}

/**
 * The rows the main thread keeps past those Lynx holds: a list that has more than both lets go of
 * some when it scrolls.
 */
const KEPT = 10;

/**
 * The cells Lynx handed back and has not shown again: off the screen, so no finger taps inside
 * them, though the engine fake keeps them in the list.
 */
const handedBack = new WeakSet<LynxElement>();

/** Lynx hands `cell` back. */
function handBack(page: SveltePage, list: LynxElement, cell: LynxElement): void {
	page.engine.list(list).hide(cell);
	handedBack.add(cell);
}

/** Lynx asks for the cell at `index`: one it shows is no longer handed back. */
function ask(page: SveltePage, list: LynxElement, index: number): LynxElement | undefined {
	const cell = page.engine.list(list).ask(index);
	if (cell) handedBack.delete(cell);
	return cell;
}

/** The list a scroll picks: one long enough to let rows go, when the page has one. */
function scrolled(page: SveltePage, pick: number): LynxElement | undefined {
	const found = lists(page);
	const long = found.filter((list) => page.engine.state(list).list!.items > SCREEN + KEPT);
	const among = long.length > 0 ? long : found;
	return among[pick % among.length];
}

/**
 * Lynx scrolls the list from its top to `first`: at each step it shows a screen of items and hands
 * back the cells outside it, as on a device.
 */
function scrollTo(page: SveltePage, list: LynxElement, first: number): void {
	const count = page.engine.state(list).list!.items;
	for (let top = 0; top <= first; top++) {
		const shown = new Set<LynxElement>();
		for (let index = top; index < Math.min(count, top + SCREEN); index++) {
			// A deferred row comes later; Lynx holds it once it comes.
			const cell = ask(page, list, index);
			if (cell) shown.add(cell);
		}
		for (const cell of recyclableCells(page, list))
			if (!shown.has(cell)) handBack(page, list, cell);
	}
}

/** The page's lists, in document order, those in the cells Lynx holds included. */
function lists(page: SveltePage, under = page.engine.page()): LynxElement[] {
	if (!under) return [];
	const found: LynxElement[] = [];
	// Boundary: the engine's tree holds its elements and raw texts only.
	for (const child of [...under.childNodes] as LynxElement[]) {
		if (child.nodeType !== 1) continue;
		if (page.engine.state(child).tag !== "list") {
			found.push(...lists(page, child));
			continue;
		}
		found.push(child);
		for (const cell of liveCells(page, child)) found.push(...lists(page, cell));
	}
	return found;
}

/** Whether `element` is in a cell Lynx handed back. */
function inHandedBack(element: LynxElement): boolean {
	for (let at: Node | null = element; at; at = at.parentNode)
		if (handedBack.has(at as LynxElement)) return true;
	return false;
}

/**
 * Elements with a tap handler bound, on the background or the main thread, in document order, but
 * those in cells Lynx handed back.
 */
function tappable(page: SveltePage): LynxElement[] {
	return page.engine.all().filter((element) => {
		if (inHandedBack(element)) return false;
		const state = page.engine.state(element);
		return (
			state.handlers.some((handler) => handler.eventName === "tap") ||
			state.mainThreadEvents.some((bound) => bound.eventName === "tap")
		);
	});
}

/** Does `step` to the page. Nothing happens when what it picks is not there. */
export function apply(running: GeneratedPage, done: Step): void {
	const { page, handles } = running;
	switch (done.kind) {
		case "set":
			page.asBackground(() => {
				if (handles.st) handles.st[done.key] = copy(done.value);
			});
			return;
		case "tap": {
			const found = tappable(page);
			if (found.length > 0) page.engine.dispatch(found[done.pick % found.length]!, { type: "tap" });
			return;
		}
		case "show":
		case "show-then-set": {
			const found = lists(page);
			if (found.length === 0) return;
			const element = found[done.list % found.length]!;
			const count = page.engine.state(element).list!.items;
			if (count > 0) ask(page, element, done.index % count);
			if (done.kind === "show-then-set")
				apply(running, { kind: "set", key: done.key, value: done.value });
			return;
		}
		case "hide": {
			const found = lists(page);
			if (found.length === 0) return;
			const element = found[done.list % found.length]!;
			const cells = recyclableCells(page, element);
			if (cells.length > 0) handBack(page, element, cells[done.cell % cells.length]!);
			return;
		}
		case "scroll":
		case "scroll-then-set": {
			const element = scrolled(page, done.list);
			const count = element ? page.engine.state(element).list!.items : 0;
			if (count > 0) scrollTo(page, element!, done.to % count);
			return;
		}
		case "layer":
			page.asBackground(() => {
				if (running.layer) root.unmount(running.layer);
				running.layer = running.layer ? undefined : root.mount(GeneratedLayer);
			});
			return;
		case "update":
			page.updateData({ host: copy(done.data) });
			return;
		case "reload":
			// The reload takes the layer away.
			running.layer = undefined;
			page.reload({ host: copy(done.data) });
			return;
	}
}

/**
 * Does `step` to the page, and for a scroll then a change, the change once the threads settled: the
 * rows the scroll let go of are released by then, and change while they have no elements.
 */
export async function run(running: GeneratedPage, done: Step): Promise<void> {
	apply(running, done);
	if (done.kind !== "scroll-then-set") return;
	await running.page.settle();
	apply(running, { kind: "set", key: done.key, value: done.value });
}

/**
 * Lynx asks for every row of every list until none waits for the background, and the threads
 * settle: each deferred row has come. A page with no deferred row only settles.
 */
export async function askEveryRow(page: SveltePage): Promise<void> {
	for (let round = 0; round < 4; round++) {
		let waiting = 0;
		for (const list of lists(page)) {
			const count = page.engine.state(list).list!.items;
			for (let index = 0; index < count; index++) if (!ask(page, list, index)) waiting++;
		}
		await page.settle();
		if (waiting === 0) return;
	}
}

/** The line a step's layer starts with in a tree: the page's last child. */
const LAYER_LINE = '  view class="layer" @bindEvent:tap';

/**
 * A tree without the layer a step mounted, which is no part of the page's state: what a page
 * started from that state renders.
 */
export function withoutLayer(tree: readonly string[]): string[] {
	const at = tree.indexOf(LAYER_LINE);
	if (at === -1) return [...tree];
	let end = at + 1;
	while (end < tree.length && tree[end]!.startsWith("    ")) end++;
	return [...tree.slice(0, at), ...tree.slice(end)];
}

/** Whether a patch asked the main thread to make the page again. */
export function rewrote(page: SveltePage): boolean {
	return page.patches.some((patch) => patch.items.some((item) => item[0] === "rewrite"));
}

/** Whether the main thread wrote ids of `$props.id()` over the first frame's, and said so. */
export function wroteIds(page: SveltePage): boolean {
	return page.messages.some((message) => message.t === "props-ids");
}
