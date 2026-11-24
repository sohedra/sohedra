// A Svelte page on both threads of a test page: the main thread's runtime as its script, and the
// background's page with the component. What each thread sends the other is kept, as the other
// receives it.

/// <reference types="../../types/client.d.ts" />

import type { Component } from "svelte";

import { fillEngineGaps, mountPage } from "../../src/background/index.ts";
import type { MountPageOptions } from "../../src/background/index.ts";
import { startMainThread } from "../../src/main-thread/index.ts";
import type { MainThreadRuntime } from "../../src/main-thread/index.ts";
import { globalScope, installGlobals, readGlobal } from "../../src/testing/globals.ts";
import { startTestPage } from "../../src/testing/index.ts";
import type {
	BackgroundLynx,
	LynxElement,
	MainThreadLynx,
	TestBundle,
	TestPage,
} from "../../src/testing/index.ts";
import {
	decodePatch,
	decodeToBackground,
	FIRST_FRAME_GLOBAL,
	PATCH_METHOD,
} from "../../src/wire/index.ts";
import type { Patch, PatchParams, ReceivedByBackground } from "../../src/wire/index.ts";

/** A running Svelte page. */
export interface SveltePage extends TestPage {
	/** Every patch the background sent, in order. */
	readonly patches: Patch[];
	/** Every message the main thread sent the background, in order. */
	readonly messages: ReceivedByBackground[];
	/** The size of each of those messages as sent: the length of its text. */
	readonly messageSizes: number[];
	/** The first element with this class token, in document order. */
	byClass(token: string): LynxElement;
	/** The main thread's runtime: the page it shows. */
	readonly runtime: MainThreadRuntime;
}

/** What the page starts with. */
export interface SveltePageOptions {
	/** The data the host opens the page with. */
	initData?: Record<string, unknown>;
	/** The template's own data, under the host's. */
	templateData?: Record<string, unknown>;
	/** The host's global props. */
	globalProps?: Record<string, unknown>;
	/** What Lynx says about the device. */
	systemInfo?: Record<string, unknown>;
	/** The page's own URL. */
	url?: string;
	/** The lazy bundles the page can fetch, by URL. */
	bundles?: Record<string, TestBundle>;
	/** The root component's props on the background, as `mountPage` takes them. */
	props?: MountPageOptions<Record<string, unknown>>["props"];
	/** The context the background mounts the root component with. */
	context?: Map<unknown, unknown>;
	/** The page's `onError`, as `mountPage` takes it. */
	onError?: MountPageOptions<Record<string, unknown>>["onError"];
	/**
	 * Runs on the background before `mountPage`, with lynx-core's app: as a module the page's entry
	 * imports runs, such as another library that binds the page.
	 */
	beforeMount?: (app: Record<string, unknown>) => void;
	/**
	 * The first frame: the markup Svelte's server would write, from the page's data, or a
	 * component's first-frame copy (`./App.svelte?first-frame`) with the props and the context it
	 * draws with, as the main thread's `mountPage` takes them.
	 */
	firstFrame?:
		| ((initData: Record<string, unknown>) => string | null)
		| {
				draw: FirstFrameCopy;
				props?: MountPageOptions<Record<string, unknown>>["props"];
				context?: Map<unknown, unknown>;
		  };
}

/** A component's first-frame copy: it records how the main thread draws the component's frame. */
export type FirstFrameCopy = (
	props?: MountPageOptions<Record<string, unknown>>["props"],
	context?: Map<unknown, unknown>,
) => void;

/** Records how the main thread draws the first frame, as the page's own script does. */
function recordFirstFrame(firstFrame: SveltePageOptions["firstFrame"]): void {
	if (typeof firstFrame === "function") installGlobals({ [FIRST_FRAME_GLOBAL]: firstFrame });
	else firstFrame?.draw(firstFrame.props, firstFrame.context);
}

/**
 * What a built page's background script runs first: it fills what the background lacks, as on a
 * device. A test page's background script calls it before the page's own code.
 */
export function startUp(): void {
	const lynx = readGlobal("lynx") as BackgroundLynx;
	fillEngineGaps({ scope: globalScope(), readLynx: () => lynx });
}

/** Starts `App` as a page on both threads. */
export function startSveltePage(
	App: Component<Record<string, unknown>>,
	options: SveltePageOptions = {},
): SveltePage {
	const patches: Patch[] = [];
	const messages: ReceivedByBackground[] = [];
	const messageSizes: number[] = [];
	let runtime: MainThreadRuntime | undefined;
	const page = startTestPage({
		...(options.initData && { initData: options.initData }),
		...(options.templateData && { templateData: options.templateData }),
		...(options.globalProps && { globalProps: options.globalProps }),
		...(options.systemInfo && { systemInfo: options.systemInfo }),
		...(options.url !== undefined && { url: options.url }),
		...(options.bundles && { bundles: options.bundles }),
		mainThread: () => {
			const context = (readGlobal("lynx") as MainThreadLynx).getJSContext();
			const send = context.dispatchEvent.bind(context);
			context.dispatchEvent = (event) => {
				messages.push(decodeToBackground(event));
				messageSizes.push(String(event.data).length);
				send(event);
			};
			runtime = startMainThread();
			recordFirstFrame(options.firstFrame);
		},
		background: () => {
			const lynx = readGlobal("lynx") as BackgroundLynx;
			startUp();
			const native = lynx.getNativeApp();
			const send = native.callLepusMethod.bind(native);
			native.callLepusMethod = (name, params, callback) => {
				// Boundary: the patch method's params are a patch.
				if (name === PATCH_METHOD) patches.push(decodePatch(params as PatchParams));
				send(name, params, callback);
			};
			options.beforeMount?.(lynx.getApp() as Record<string, unknown>);
			mountPage(App, {
				...(options.props && { props: options.props }),
				...(options.context && { context: options.context }),
				...(options.onError && { onError: options.onError }),
			});
		},
	});
	return Object.assign(page, {
		patches,
		messages,
		messageSizes,
		runtime: runtime!,
		byClass(token: string): LynxElement {
			const found = page.engine
				.all()
				.find((element) => page.engine.state(element).classes.split(" ").includes(token));
			if (!found) throw new Error(`No element has the class ${token}.`);
			return found;
		},
	});
}
