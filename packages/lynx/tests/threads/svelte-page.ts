// A Svelte page on both threads of a test page: the main thread's runtime as its script, and the
// background's page with the component. What the background sends is kept, as the main thread
// receives it.

/// <reference types="../../types/client.d.ts" />

import type { Component } from "svelte";

import { startPage } from "../../src/background/index.ts";
import { startMainThread } from "../../src/main-thread/index.ts";
import { installGlobals, readGlobal } from "../../src/testing/globals.ts";
import { startTestPage } from "../../src/testing/index.ts";
import type { BackgroundLynx, LynxElement, TestPage } from "../../src/testing/index.ts";
import { decodePatch, FIRST_FRAME_GLOBAL } from "../../src/wire/index.ts";
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
	/** The data the host opens the page with. */
	initData?: Record<string, unknown>;
	/** The template's own data, under the host's. */
	templateData?: Record<string, unknown>;
	props?: (initData: Record<string, unknown>) => Record<string, unknown>;
	/**
	 * The first frame: the markup Svelte's server would write, from the page's data, or a
	 * component's first-frame copy (`./App.svelte?first-frame`) with the props it draws with.
	 */
	firstFrame?:
		| ((initData: Record<string, unknown>) => string | null)
		| { draw: (props?: Record<string, unknown>) => void; props?: Record<string, unknown> };
}

/** Records how the main thread draws the first frame, as the page's own script does. */
function recordFirstFrame(firstFrame: SveltePageOptions["firstFrame"]): void {
	if (typeof firstFrame === "function") installGlobals({ [FIRST_FRAME_GLOBAL]: firstFrame });
	else firstFrame?.draw(firstFrame.props);
}

/** Starts `App` as a page on both threads. */
export function startSveltePage(
	App: Component<Record<string, unknown>>,
	options: SveltePageOptions = {},
): SveltePage {
	const patches: Patch[] = [];
	const page = startTestPage({
		...(options.initData && { initData: options.initData }),
		...(options.templateData && { templateData: options.templateData }),
		mainThread: () => {
			startMainThread();
			recordFirstFrame(options.firstFrame);
		},
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
