// Runs a generated page on both threads of a test page, and what happens to it: the state changed
// on the background, taps, Lynx asking for list cells and handing them back, the host's data and a
// reload.

import * as env from "@sohedra/lynx/env";
import fc from "fast-check";
import type { Component } from "svelte";

import renderer from "../../../src/background/renderer/entry.ts";
import * as internals from "../../../src/svelte/runtime/client-internals.ts";
import type { LynxElement } from "../../../src/testing/index.ts";
import drawGeneratedFrame from "../../fixtures/threads/GeneratedFrame.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";
import type { SveltePage } from "../svelte-page.ts";
import type { CompiledBoth } from "./compile.ts";
import { evaluatePage, INTERNALS, RENDERER } from "./evaluate.ts";
import { pageState, STATE_KEYS, stateValue } from "./grammar.ts";
import type { PageState } from "./grammar.ts";
import { listKeys } from "./trees.ts";

/** Something that happens to a running page. Numbers pick among what is there when it happens. */
export type Step =
	| { kind: "set"; key: keyof PageState; value: unknown }
	| { kind: "tap"; pick: number }
	| { kind: "show"; list: number; index: number }
	| { kind: "hide"; list: number; cell: number }
	| { kind: "update"; data: PageState }
	| { kind: "reload"; data: PageState };

const pick = fc.nat({ max: 50 });

/** A change of the state, from the background. */
const setStep: fc.Arbitrary<Step> = fc
	.constantFrom(...STATE_KEYS)
	.chain((key) => stateValue(key).map((value): Step => ({ kind: "set", key, value })));

/** Something that happens to a page on screen. */
export const step: fc.Arbitrary<Step> = fc.oneof(
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
	{ weight: 1, arbitrary: pageState.map((data): Step => ({ kind: "update", data })) },
	{ weight: 1, arbitrary: pageState.map((data): Step => ({ kind: "reload", data })) },
);

/** What happens before the background's first patch reaches the main thread: no state yet. */
export const earlyStep: fc.Arbitrary<Step> = step.filter((early) => early.kind !== "set");

/** A running generated page, and the state its root component shares with the test. */
export interface GeneratedPage {
	readonly page: SveltePage;
	/** The root component's state, on the background. */
	readonly handles: { st?: Record<string, unknown> };
}

/** How a generated page starts. */
export interface StartOptions {
	compiled: CompiledBoth;
	data: PageState;
	/** Draw the first frame from the data, as a built page whose script draws it. */
	firstFrame: boolean;
	/**
	 * What `background` from `@sohedra/lynx/env` is on the background: `false` renders there what
	 * the first frame renders, as a reference for it.
	 */
	background?: boolean;
}

const copy = <T>(value: T): T => structuredClone(value);

/** Starts the page; its first frame is drawn when this returns, its first patch is on its way. */
export function startGenerated(options: StartOptions): GeneratedPage {
	const { compiled, data, firstFrame } = options;
	const handles: { st?: Record<string, unknown> } = {};
	const backgroundEnv = options.background === false ? { ...env, background: false } : env;
	// Boundary: the generated root component takes `data` and `handles`.
	const App = evaluatePage(compiled.background, {
		[INTERNALS]: internals,
		[RENDERER]: { default: renderer },
		"@sohedra/lynx/env": backgroundEnv,
		"svelte/internal/disclose-version": {},
	}) as Component<Record<string, unknown>>;
	const page = startSveltePage(App, {
		initData: { page: copy(data) },
		props: (initData) => ({ data: copy(initData["page"]), handles }),
		...(firstFrame && {
			firstFrame: {
				draw: drawGeneratedFrame,
				props: { page: compiled.mainThread, props: { data: copy(data) } },
			},
		}),
	});
	return { page, handles };
}

/**
 * The cells of a list that show one of its items now. The engine fake keeps the cell of an item
 * that was taken out, which Lynx would hand back and never ask about again.
 */
function liveCells(page: SveltePage, list: LynxElement): LynxElement[] {
	const keys = new Set(listKeys(page.engine, list));
	// Boundary: a list's children in the engine are the cells Lynx holds.
	return ([...list.childNodes] as LynxElement[]).filter((cell) =>
		keys.has(String(page.engine.state(cell).attrs["item-key"])),
	);
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

/** Elements with a tap handler bound, in document order. */
function tappable(page: SveltePage): LynxElement[] {
	return page.engine
		.all()
		.filter((element) =>
			page.engine.state(element).handlers.some((handler) => handler.eventName === "tap"),
		);
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
		case "show": {
			const found = lists(page);
			if (found.length === 0) return;
			const list = page.engine.list(found[done.list % found.length]!);
			const count = page.engine.state(found[done.list % found.length]!).list!.items;
			if (count > 0) list.show(done.index % count);
			return;
		}
		case "hide": {
			const found = lists(page);
			if (found.length === 0) return;
			const element = found[done.list % found.length]!;
			const cells = liveCells(page, element);
			if (cells.length > 0) page.engine.list(element).hide(cells[done.cell % cells.length]!);
			return;
		}
		case "update":
			page.updateData({ page: copy(done.data) });
			return;
		case "reload":
			page.reload({ page: copy(done.data) });
			return;
	}
}

/** Whether a patch asked the main thread to make the page again. */
export function rewrote(page: SveltePage): boolean {
	return page.patches.some((patch) => patch.items.some((item) => item[0] === "rewrite"));
}
