// A Svelte page on both threads of a test page: the main thread's runtime as its script, and the
// background's page with the component. What the background sends is kept, as the main thread
// receives it.

/// <reference types="../../types/client.d.ts" />

import type { Component } from "svelte";

import { startPage } from "../../src/background/index.ts";
import { startMainThread } from "../../src/main-thread/index.ts";
import { readGlobal } from "../../src/testing/globals.ts";
import { startTestPage } from "../../src/testing/index.ts";
import type { BackgroundLynx, LynxElement, TestPage } from "../../src/testing/index.ts";
import { decodePatch } from "../../src/wire/index.ts";
import type { Patch, PatchParams } from "../../src/wire/index.ts";

/** A running Svelte page. */
export interface SveltePage extends TestPage {
	/** Every patch the background sent, in order. */
	readonly patches: Patch[];
	/** The first element with this class token, in document order. */
	byClass(token: string): LynxElement;
}

/** What the page starts with. */
export interface SveltePageOptions {
	initData?: Record<string, unknown>;
	props?: (initData: Record<string, unknown>) => Record<string, unknown>;
}

/** Starts `App` as a page on both threads. */
export function startSveltePage(
	App: Component<Record<string, unknown>>,
	options: SveltePageOptions = {},
): SveltePage {
	const patches: Patch[] = [];
	const page = startTestPage({
		...(options.initData && { initData: options.initData }),
		mainThread: () => startMainThread(),
		background: () => {
			const native = (readGlobal("lynx") as BackgroundLynx).getNativeApp();
			const send = native.callLepusMethod.bind(native);
			native.callLepusMethod = (name, params, callback) => {
				// Boundary: the page's patches are the one method it calls here.
				patches.push(decodePatch(params as PatchParams));
				send(name, params, callback);
			};
			startPage(App, options.props ? { props: options.props } : {});
		},
	});
	return Object.assign(page, {
		patches,
		byClass(token: string): LynxElement {
			const found = page.engine
				.all()
				.find((element) => page.engine.state(element).classes.split(" ").includes(token));
			if (!found) throw new Error(`No element has the class ${token}.`);
			return found;
		},
	});
}
