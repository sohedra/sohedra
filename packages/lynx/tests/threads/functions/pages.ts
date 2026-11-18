// A page whose components have main-thread functions, on both threads. Their bodies come with the
// component's first-frame copy, which registers them on the main thread as the page's own script
// does: each test passes it, drawn as the first frame or not.

import type { Component } from "svelte";

import { startSveltePage } from "../svelte-page.ts";
import type { SveltePage, SveltePageOptions } from "../svelte-page.ts";

/** A component's first-frame copy (`./App.svelte?first-frame`). */
export type Draw = (props?: Record<string, unknown>) => void;

/** What a page with main-thread functions starts with. */
export interface FunctionsPageOptions extends Omit<SveltePageOptions, "firstFrame" | "props"> {
	/** The first-frame copy: it registers the bodies, and draws the first frame with `firstFrame`. */
	draw: Draw;
	/** The root component's props, on both threads. */
	props?: Record<string, unknown>;
	/** Draw the first frame. */
	firstFrame?: boolean;
}

/** Starts `App` on both threads, with its main-thread functions' bodies registered. */
export function startFunctionsPage(
	App: Component<Record<string, unknown>>,
	options: FunctionsPageOptions,
): SveltePage {
	const { draw, props = {}, firstFrame = false, ...rest } = options;
	// Not drawn, the copy's module still loads, and registers the bodies.
	return startSveltePage(App, {
		...rest,
		props: () => props,
		...(firstFrame && { firstFrame: { draw, props } }),
	});
}

/** Taps an element as Lynx does, and waits for both threads. */
export async function tap(page: SveltePage, token: string): Promise<void> {
	page.engine.dispatch(page.byClass(token), { type: "tap" });
	await page.settle();
}
