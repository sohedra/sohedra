// The page on the background thread: the app's root component, mounted with the renderer, and
// the hooks the engine calls on the app (`lynx.getApp()`), as ReactLynx installs them:
//
//   updateCardData(data, { type })  new data for the page (type 1: start from none)
//   onAppReload(data)               the host reloads the page, with data to add
//   callDestroyLifetimeFun()        the page is going away
//
// A reload and a destroy tear the old app down synchronously: Svelte's `unmount` takes the
// component's nodes out before it returns. So a reload is one patch, the new app, and the
// destroy is over when the engine's call returns.

import { flushSync, mount, unmount } from "svelte";
import type { Component } from "svelte";

import { listenThrough, pushRenderer, startPropsIds } from "../svelte/runtime/index.ts";
import { ROOT_ID } from "../wire/index.ts";
import type { RewriteMessage, SentEvent, SentTarget } from "../wire/index.ts";
import { openChannel } from "./channel.ts";
import { background } from "./globals.ts";
import { mismatchError } from "./hydration.ts";
import { bumpPage, clearPageState, runAll, startGeneration } from "./page-state.ts";
import type { Handler } from "./renderer/handlers.ts";
import { pageHandlers, pageQueue, pageRenderer } from "./renderer/page-renderer.ts";
import type { ElementNode } from "./renderer/renderer.ts";
import { reportError } from "./report.ts";

/** How the page starts. */
export interface StartPageOptions<Props extends Record<string, unknown>> {
	/** The root component's props, from the page's data; called at each start and reload. */
	props?: (initData: Record<string, unknown>) => Props;
}

/** What the engine gives the app when it opens the page (lynx-core's app `_params`). */
interface AppParams {
	initData?: Record<string, unknown>;
	updateData?: Record<string, unknown>;
}

/** lynx-core's `type` of `updateCardData` that starts the data from none. */
const RESET_DATA = 1;

/** The hooks lynx-core calls that a Svelte page has nothing to do in (ReactLynx sets them too). */
const QUIET_HOOKS = [
	"OnLifecycleEvent",
	"publishEvent",
	"publicComponentEvent",
	"processCardConfig",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

/** An event's targets as the element nodes themselves; a target with no node stays as it came. */
function withNodes(event: SentEvent): Record<string, unknown> {
	const node = (sent: SentTarget | undefined): unknown => {
		if (!sent) return sent;
		const found = sent.node === 0 ? undefined : pageRenderer.nodeById(sent.node);
		return found ? pageRenderer.eventTarget(found, sent) : sent;
	};
	return { ...event, target: node(event.target), currentTarget: node(event.currentTarget) };
}

/**
 * Starts the page: mounts `App` as the root of this Lynx view's page, on the background thread,
 * and installs the engine's hooks. An error while the page starts is reported into Lynx, not
 * thrown.
 */
export function startPage<Props extends Record<string, unknown>>(
	App: Component<Props>,
	options: StartPageOptions<Props> = {},
): void {
	const { lynx } = background;
	const app = lynx.getApp();
	startGeneration();
	// `on()` listens through the page's renderer wherever it is called.
	listenThrough(pageRenderer);
	let instance: Record<string, unknown> | undefined;
	let root: ElementNode | undefined;
	let anchor: ReturnType<typeof pageRenderer.createComment> | undefined;

	/** Runs handlers as Svelte runs effects, then sends their updates at once. */
	function handle(run: () => void): void {
		try {
			// With the renderer current, as Svelte runs effects: `on()` called in a handler listens
			// through the renderer.
			const pop = pushRenderer(pageRenderer);
			try {
				run();
			} finally {
				pop();
			}
			flushSync();
		} catch (error) {
			reportError(error);
		}
		channel.flush();
	}

	function dispatch(handler: number, event: SentEvent): void {
		handle(() => {
			const received = withNodes(event);
			if (received["type"] === "layoutchange")
				pageRenderer.sawLayout(received["currentTarget"], received["detail"]);
			pageHandlers.dispatch(handler, received);
		});
	}

	/** The main thread asks for the page again: its first frame could not be hydrated. */
	function rewrite({ nodes, mismatch }: RewriteMessage): void {
		if (mismatch) reportError(mismatchError(mismatch, pageRenderer.nodeById(mismatch.node)));
		// The page's root is the one subtree asked for yet.
		if (nodes.includes(ROOT_ID)) channel.rewritePage(() => pageRenderer.writePage());
	}

	const channel = openChannel({
		queue: pageQueue,
		onEvent: dispatch,
		onRewrite: rewrite,
		tagOf: (id) => pageRenderer.tagOf(id),
	});

	/**
	 * Mounts the app. At the page's start, what it rendered before its effects ran is marked: the main
	 * thread hydrates its first frame from it.
	 */
	function render(starting: boolean): void {
		// Boundary: an app without `props` has a root component that takes none.
		const props = options.props?.(lynx.__initData) ?? ({} as Props);
		// The ids of `$props.id()` are the first frame's: a reload draws no frame, and starts them too.
		startPropsIds();
		instance = mount(App, { target: root!, anchor: anchor!, renderer: pageRenderer, props });
		if (starting) channel.markRendered();
		flushSync();
	}

	/** Unmounts the app: synchronous under a renderer; a teardown's error is reported. */
	function teardown(): void {
		const mounted = instance;
		instance = undefined;
		if (mounted) unmount(mounted).catch(reportError);
	}

	function mergeData(data: unknown): void {
		if (isRecord(data)) lynx.__initData = { ...lynx.__initData, ...data };
	}

	function reload(data: unknown): void {
		bumpPage();
		mergeData(data);
		runAll([teardown, () => channel.abandon()]);
		try {
			render(false);
		} finally {
			// A patch of the new page even when it shows nothing yet, or failed to: the main thread
			// keeps the old page on screen until one comes.
			channel.flush(true);
		}
	}

	function destroy(): void {
		bumpPage();
		runAll([
			teardown,
			() => channel.close(),
			() => pageRenderer.retire(),
			() => listenThrough(null),
			clearPageState,
		]);
	}

	function updateData(data: unknown, update?: { type?: unknown }): void {
		if (update?.type === RESET_DATA) lynx.__initData = {};
		mergeData(data);
		channel.markDataUpdated();
	}

	const guard =
		<Args extends unknown[]>(hook: (...args: Args) => void) =>
		(...args: Args): void => {
			try {
				hook(...args);
			} catch (error) {
				reportError(error);
			}
		};

	app["updateCardData"] = guard(updateData);
	app["onAppReload"] = guard(reload);
	app["callDestroyLifetimeFun"] = guard(destroy);
	for (const name of QUIET_HOOKS) if (typeof app[name] !== "function") app[name] = () => {};

	try {
		// Boundary: lynx-core's app keeps the data the page was opened with here.
		const params = (app["_params"] ?? {}) as AppParams;
		// The template's data and the host's over it (core/runtime/js/bindings/js_app.cc), as the
		// engine rendered the page with them: the data the first frame was drawn from.
		lynx.__initData = { ...params.initData, ...params.updateData };
		pageRenderer.setHost({
			call: channel.call,
			run: (handler: Handler, event: unknown) => handle(() => handler(event)),
		});
		root = pageRenderer.createRoot();
		anchor = pageRenderer.createComment("");
		pageRenderer.insert(root, anchor, null);
		render(true);
		// Even when the page shows nothing: the main thread keeps a first frame until this patch.
		channel.flush(true);
	} catch (error) {
		reportError(error);
	}
}
