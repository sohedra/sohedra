// `render`: a Svelte component as a Lynx page, on both threads in this process, as a device runs it.
// The main thread starts the binding's runtime and draws the first frame from the component's
// first-frame copy; then the background fills what it lacks and mounts the component, and its
// first update hydrates the frame. `render` resolves once both threads are idle.

import { getQueriesForElement, prettyDOM } from "@testing-library/dom";
import type { BoundFunctions, queries } from "@testing-library/dom";
import type { Component } from "svelte";

import { fillEngineGaps, mountPage, pageExports } from "../../background/index.ts";
import type { BackgroundGlobals } from "../../background/index.ts";
import { startMainThread } from "../../main-thread/index.ts";
import type { MainThreadRuntime } from "../../main-thread/index.ts";
import { FIRST_FRAME_COPY_KEY } from "../../wire/index.ts";
import { testingError } from "../catalogue.ts";
import { globalScope, readGlobal } from "../globals.ts";
import type { BackgroundLynx } from "../page/lynx.ts";
import { IPHONE, startTestPage } from "../page/page.ts";
import { testProps } from "./props.ts";
import { presetName, rendered, setRendered, settle } from "./session.ts";
import type { Rendered } from "./session.ts";
import { createTestLynx } from "./test-lynx.ts";
import type { LynxTestElement, TestLynx } from "./test-lynx.ts";

/** What the page's Lynx starts with. */
export interface LynxRenderOptions {
	/** The data the host opens the page with: `initData` of `@sohedra/lynx/host`. */
	initData?: Record<string, unknown>;
	/** The host's global props: `globalProps` of `@sohedra/lynx/host`. */
	globalProps?: Record<string, unknown>;
	/** What Lynx says about the device, over an iPhone's: `systemInfo` of `@sohedra/lynx/host`. */
	systemInfo?: Record<string, unknown>;
	/**
	 * Draw the first frame from the component's first-frame copy, which the background then
	 * hydrates, as a device does.
	 * @defaultValue whether the component has a copy: the test preset gives each one, unless its
	 * options say `firstFrame: false`
	 */
	firstFrame?: boolean;
	/**
	 * Start the background. With `false` the page is the first frame alone, for a test of what the
	 * first frame draws: what needs the background says so instead of waiting.
	 * @defaultValue true
	 */
	background?: boolean;
}

/** The options of `render`. */
export interface RenderOptions<Props extends Record<string, unknown>> {
	/** The component's props; `rerender` changes them. */
	props?: Props;
	/** The contexts the component gets, as Svelte's `mount` takes them. */
	// oxlint-disable-next-line typescript/no-explicit-any -- Svelte's own type of a context
	context?: Map<any, any>;
	/** What the page's Lynx starts with. */
	lynx?: LynxRenderOptions;
}

/** What `render` resolves with: the page, the component's exports, the bound queries and Lynx. */
export type RenderResult<
	Exports extends Record<string, unknown>,
	Props extends Record<string, unknown>,
> = {
	/** The page: Lynx's `<page>` element, with the component's elements under it. */
	container: LynxTestElement;
	/** `document.body`, which holds the page, and which `screen` queries. */
	baseElement: HTMLElement;
	/** The component's exports, on the background. */
	component: Exports;
	/** Changes the props, as a parent would; resolves once the change is on the page. */
	rerender(props: Partial<Props>): Promise<void>;
	/** Ends the page, as Lynx destroys it; `cleanup` does it too. */
	unmount(): Promise<void>;
	/** Prints the page, or `element`. */
	debug(element?: Element): void;
	/** The Lynx around the page. */
	lynx: TestLynx;
} & BoundFunctions<typeof queries>;

/** A component's first-frame copy, which the test preset hangs on it. */
type FirstFrameCopy = (props: Record<string, unknown>, context?: Map<unknown, unknown>) => void;

/**
 * Renders `Component` as a Lynx page, on both threads. One page at a time, as in a Lynx view:
 * `cleanup()`, which the test presets run after each test, ends it.
 */
export async function render<
	Props extends Record<string, unknown>,
	Exports extends Record<string, unknown> = Record<string, never>,
>(
	Component: Component<Props, Exports, string>,
	options: RenderOptions<Props> = {},
): Promise<RenderResult<Exports, Props>> {
	if (rendered()) throw testingError({ code: "page_already_rendered", details: {} });
	const knobs = options.lynx ?? {};
	const background = knobs.background !== false;
	if (!background && knobs.firstFrame === false)
		throw testingError({ code: "first_frame_needed_alone", details: {} });
	const copy: unknown = Reflect.get(Component, Symbol.for(FIRST_FRAME_COPY_KEY));
	const firstFrame = !background || (knobs.firstFrame ?? typeof copy === "function");
	if (firstFrame && typeof copy !== "function")
		throw testingError({
			code: "first_frame_copy_missing",
			details: { component: Component.name || "The component", preset: presetName() },
		});
	if (readGlobal("document") === undefined)
		throw testingError({ code: "render_needs_dom", details: { preset: presetName() } });

	const given = { ...options.props } as Props;
	const props = testProps(given);
	const context = options.context;
	let runtime: MainThreadRuntime | undefined;
	const page = startTestPage({
		...(knobs.initData && { initData: knobs.initData }),
		...(knobs.globalProps && { globalProps: knobs.globalProps }),
		...(knobs.systemInfo && { systemInfo: { ...IPHONE, ...knobs.systemInfo } }),
		mainThread: () => {
			runtime = startMainThread();
			// Boundary: the copy is the function the test preset's loader hangs on the component.
			if (firstFrame) (copy as FirstFrameCopy)({ ...given }, context);
		},
		...(background && {
			background: () => {
				// The background's start-up: what it lacks, filled as on a device.
				const lynx = readGlobal("lynx") as BackgroundLynx;
				// Boundary: the fill reads only `lynx` of the background's globals.
				fillEngineGaps({
					scope: globalScope(),
					strings: String.prototype,
					globals: { lynx } as unknown as BackgroundGlobals,
				});
				mountPage(Component, { props: props.props, ...(context && { context }) });
			},
		}),
	});
	const session: Rendered = {
		page,
		background,
		...(!background && {
			heldCalls: () => runtime?.page.frame?.early.filter((entry) => "call" in entry).length ?? 0,
		}),
	};
	setRendered(session);
	try {
		await settle(session);
	} catch (error) {
		page.dispose();
		setRendered(undefined);
		throw error;
	}

	// Boundary: the engine's `<page>` is a DOM element.
	const container = page.engine.page() as LynxTestElement;
	const document = container.ownerDocument;
	return {
		container,
		baseElement: document.body,
		get component() {
			if (background) return pageExports() as Exports;
			// Read in place (a spread of the result reads it), and refusing any use.
			// Boundary: the stand-in has none of the exports, and says so when one is read.
			return new Proxy({} as Exports, {
				get(_target, key) {
					if (typeof key === "symbol" || key === "then") return undefined;
					throw testingError({
						code: "background_not_started",
						details: { what: "the component's exports" },
					});
				},
			});
		},
		async rerender(next) {
			if (rendered() !== session)
				throw testingError({ code: "no_page_rendered", details: { call: "rerender()" } });
			if (!background)
				throw testingError({ code: "background_not_started", details: { what: "rerender()" } });
			page.asBackground(() => props.update(next));
			await settle(session);
		},
		async unmount() {
			try {
				page.destroy();
				await settle(session);
			} finally {
				page.dispose();
			}
		},
		debug(element = container) {
			// oxlint-disable-next-line no-console -- printing is what it is for
			console.log(prettyDOM(element));
		},
		lynx: createTestLynx(session),
		...getQueriesForElement(container),
	};
}
