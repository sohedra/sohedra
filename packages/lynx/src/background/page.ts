// The page on the background thread (`mountPage`): the app's root component, mounted with the
// renderer, and the hooks the engine calls on the app (`lynx.getApp()`), as ReactLynx installs them:
//
//   updateCardData(data, { type })  new data for the page (type 1: start from none)
//   updateGlobalProps(props)        the host's new global props, all of them
//   onAppReload(data)               the host reloads the page, with data to add
//   callDestroyLifetimeFun()        the page is going away
//
// A reload and a destroy tear the old app and its layers down synchronously: Svelte's `unmount`
// takes the component's nodes out before it returns. So a reload is one patch, the new app, and the
// destroy is over when the engine's call returns.

import { flushSync, mount, unmount } from "svelte";
import type { Component } from "svelte";

import {
	endFirstScreens,
	listenThrough,
	pushRenderer,
	SCROLL_INDEX_CAP,
	startFirstScreens,
	startPropsIds,
} from "../svelte/runtime/index.ts";
import { encodeError, ROOT_ID } from "../wire/index.ts";
import type {
	CallMessage,
	HideMessage,
	Result,
	RewriteMessage,
	SentEvent,
	SentTarget,
	ShowMessage,
} from "../wire/index.ts";
import { backgroundError } from "./catalogue.ts";
import { openChannel } from "./channel.ts";
import { callThrough } from "./functions/calls.ts";
import { background } from "./globals.ts";
import { globalPropsChanged, initDataChanged } from "./host/data.ts";
import { closeHostEvents, openHostEvents } from "./host/events.ts";
import { resetKeyboard } from "./host/keyboard.ts";
import { mismatchError, warnPropsIds } from "./hydration.ts";
import { closeLayers, openLayers, unmountLayers } from "./layers.ts";
import { installLazyBundles } from "./lazy-bundle.ts";
import { bumpPage, clearPageState, currentPage, runAll, startGeneration } from "./page-state.ts";
import type { Handler } from "./renderer/handlers.ts";
import { numberInput } from "./renderer/input.ts";
import { pageHandlers, pageQueue, pageRenderer } from "./renderer/page-renderer.ts";
import type { ElementNode } from "./renderer/renderer.ts";
import { rowOf, waitsToBeAsked } from "./renderer/rows.ts";
import { reportError, warnOnce } from "./report.ts";

// oxlint-disable-next-line typescript/no-explicit-any -- Svelte's own bound on props
type Bag = Record<string, any>;

/** How `mountPage` mounts the page's root component. */
export interface MountPageOptions<Props extends Bag> {
	/**
	 * The root component's props: an object, or a function of the page's data and the host's global
	 * props, called at the page's start and at each reload. The first frame is drawn with the same,
	 * so both threads draw the same page.
	 */
	props?:
		| Props
		| ((initData: Record<string, unknown>, globalProps: Record<string, unknown>) => Props);
	/**
	 * The contexts the root component gets, as Svelte's `mount` takes them: on the first frame and
	 * on the background alike.
	 */
	// oxlint-disable-next-line typescript/no-explicit-any -- Svelte's own type of a context
	context?: Map<any, any>;
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

/** Whether `value` is a thenable, to be awaited. */
const isThenable = (value: unknown): value is PromiseLike<unknown> =>
	(typeof value === "object" || typeof value === "function") &&
	value !== null &&
	typeof Reflect.get(value, "then") === "function";

/** What a call that threw answers. */
const failure = (error: unknown): Result => ({ ok: false, error: encodeError(error) });

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
 * Mounts `App` as the page of this Lynx view: the page's entry calls it once, on both threads. On
 * the main thread it draws the first frame from the page's data; on the background it mounts the
 * component over that frame, then answers the page's events, and mounts it again when the host
 * reloads the page. An error while the page starts is reported into Lynx, not thrown.
 *
 * ```ts
 * import { mountPage } from "@sohedra/lynx";
 * import App from "./App.svelte";
 *
 * mountPage(App, { props: (initData) => ({ route: String(initData.route ?? "/") }) });
 * ```
 */
export function mountPage<Props extends Bag>(
	App: Component<Props>,
	options: MountPageOptions<NoInfer<Props>> = {},
): void {
	const { lynx } = background;
	const app = lynx.getApp();
	startGeneration();
	openLayers();
	openHostEvents();
	resetKeyboard();
	installLazyBundles();
	// `on()` listens through the page's renderer wherever it is called.
	listenThrough(pageRenderer);
	let instance: Record<string, unknown> | undefined;
	let root: ElementNode | undefined;
	let anchor: ReturnType<typeof pageRenderer.createComment> | undefined;

	/**
	 * Runs handlers as Svelte runs effects, then sends their updates at once; `after` runs once
	 * Svelte's updates are queued, before the send.
	 */
	function handle(run: () => void, after?: () => void): void {
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
		after?.();
		channel.flush();
	}

	/**
	 * A main-thread function calls a background function: it runs as an event's handlers do, and
	 * its answer follows the updates it made, in the same patch. A thenable is awaited, and answered
	 * in a later patch of the same page. What it throws is reported here, and answered.
	 */
	function callBackground({ id, fn, context, params }: CallMessage): void {
		const page = currentPage();
		const answer = (result: Result): void => {
			if (currentPage() === page) channel.reply(id, result);
		};
		const target = channel.backgroundFunction(context, fn);
		if (!target) {
			const error = backgroundError({ code: "background_function_missing", details: {} });
			reportError(error);
			answer(failure(error));
			channel.flush();
			return;
		}
		let returned: unknown;
		let thrown: { error: unknown } | undefined;
		handle(
			() => {
				try {
					returned = target(...params);
				} catch (error) {
					thrown = { error };
				}
			},
			() => {
				if (thrown) {
					reportError(thrown.error);
					answer(failure(thrown.error));
				} else if (!isThenable(returned)) {
					answer({ ok: true, value: returned });
				} else {
					Promise.resolve(returned).then(
						(value) => answer({ ok: true, value }),
						(error: unknown) => {
							reportError(error);
							answer(failure(error));
						},
					);
				}
			},
		);
	}

	function dispatch(handler: number, event: SentEvent, input: number | undefined): void {
		handle(() => {
			const received = withNodes(event);
			if (input !== undefined) numberInput(received, input);
			if (received["type"] === "layoutchange")
				pageRenderer.sawLayout(received["currentTarget"], received["detail"]);
			pageHandlers.dispatch(handler, received);
		});
	}

	/**
	 * The main thread asks for the page again, when its first frame could not be hydrated, or for
	 * list cells, to let go of their elements or of their piled-up text.
	 */
	function rewrite({ nodes, mismatch }: RewriteMessage): void {
		if (mismatch) reportError(mismatchError(mismatch, pageRenderer.nodeById(mismatch.node)));
		if (nodes.includes(ROOT_ID)) {
			channel.rewritePage(() => pageRenderer.writePage());
			return;
		}
		// A row held back has no text on the main thread to replace: it is written when asked for.
		const cells = nodes.filter((id) => !channel.holds(id));
		channel.rewriteCells(cells, (id) => {
			if (!pageRenderer.writeCell(id)) return false;
			return rowOf(pageRenderer.nodeById(id))?.unmountsRecycled ? "unmount" : true;
		});
	}

	/** Deferred rows Lynx asked for: their contents render, and each is written whole. */
	function show({ nodes }: ShowMessage): void {
		const rows = nodes.filter((id) => channel.holds(id));
		if (rows.length === 0) return;
		handle(() => {
			for (const id of rows) rowOf(pageRenderer.nodeById(id))?.show();
		});
		channel.rewriteCells(rows, (id) => pageRenderer.writeCell(id));
	}

	/** Deferred rows the main thread let go of, text and all: their contents unmount. */
	function hide({ nodes }: HideMessage): void {
		const rows = nodes.filter((id) => !channel.holds(id) && rowOf(pageRenderer.nodeById(id)));
		if (rows.length === 0) return;
		channel.holdCells(rows);
		handle(() => {
			for (const id of rows) rowOf(pageRenderer.nodeById(id))?.hide();
		});
	}

	const channel = openChannel({
		queue: pageQueue,
		onEvent: dispatch,
		onRewrite: rewrite,
		onPropsIds: ({ differences }) => warnPropsIds(differences, (id) => pageRenderer.nodeById(id)),
		onShow: show,
		onHide: hide,
		onCall: callBackground,
		waits: (id) => {
			const node = pageRenderer.nodeById(id);
			return node !== undefined && waitsToBeAsked(node);
		},
		tagOf: (id) => pageRenderer.tagOf(id),
	});

	/**
	 * Mounts the app. At the page's start, its lists render their first screens, as the first frame
	 * drew them, and what it rendered before its effects ran is marked: the main thread hydrates its
	 * first frame from it.
	 */
	function render(starting: boolean): void {
		const given = options.props;
		// Boundary: an app without `props` has a root component that takes none.
		const props =
			(typeof given === "function" ? given(lynx.__initData, lynx.__globalProps ?? {}) : given) ??
			({} as Props);
		// The ids of `$props.id()` are the first frame's: a reload draws no frame, and starts them too.
		startPropsIds();
		if (starting) startFirstScreens();
		try {
			instance = mount(App, {
				target: root!,
				anchor: anchor!,
				renderer: pageRenderer,
				props,
				...(options.context && { context: options.context }),
			});
		} finally {
			for (const note of endFirstScreens())
				warnOnce(`${note.code}:${note.where ?? ""}`, () =>
					note.code === "initial_scroll_index_past_first_screen"
						? backgroundError({ code: note.code, details: { ...note, cap: SCROLL_INDEX_CAP } })
						: backgroundError({ code: note.code, details: note }),
				);
		}
		if (starting) channel.markRendered();
		flushSync();
	}

	/**
	 * Unmounts the app, then the layers still mounted: synchronous under a renderer. Svelte ends a
	 * teardown's error in the promise `unmount` returns, where it is reported. A layer the app's own
	 * teardown unmounts is gone by then.
	 */
	function teardown(): void {
		const mounted = instance;
		instance = undefined;
		if (mounted) unmount(mounted).catch(reportError);
		unmountLayers();
	}

	function mergeData(data: unknown): void {
		if (isRecord(data)) lynx.__initData = { ...lynx.__initData, ...data };
	}

	function reload(data: unknown): void {
		bumpPage();
		mergeData(data);
		// Before the old app goes: what reads the data outside the app runs again as the new app
		// renders, and the new app reads it as it starts.
		initDataChanged();
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
			() => callThrough(null),
			() => channel.close(),
			() => pageRenderer.retire(),
			() => listenThrough(null),
			closeLayers,
			closeHostEvents,
			resetKeyboard,
			clearPageState,
		]);
	}

	/** What read the data runs again, and the patch that shows it says the data was updated. */
	function updateData(data: unknown, update?: { type?: unknown }): void {
		if (update?.type === RESET_DATA) lynx.__initData = {};
		mergeData(data);
		handle(initDataChanged, () => channel.markDataUpdated());
	}

	/**
	 * The host's global props, all of them (the platform merges an update into them before the
	 * engine sends them). lynx-core sets `lynx.__globalProps` only as the page starts.
	 */
	function updateGlobalProps(props: unknown): void {
		if (isRecord(props)) lynx.__globalProps = { ...lynx.__globalProps, ...props };
		handle(globalPropsChanged);
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
	app["updateGlobalProps"] = guard(updateGlobalProps);
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
		callThrough({ call: (request) => channel.call(0, request), contexts: channel.contexts });
		root = pageRenderer.attachRoot();
		anchor = pageRenderer.createComment("");
		pageRenderer.insert(root, anchor, null);
		render(true);
		// Even when the page shows nothing: the main thread keeps a first frame until this patch.
		channel.flush(true);
	} catch (error) {
		reportError(error);
	}
}
