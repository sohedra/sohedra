// A part as the conformance suite sees it (`ConformanceSetup`), and the props its harness renders
// the part with, in the browser and on the server.
import type { Component, Snippet } from "svelte";
import type { Attachment } from "svelte/attachments";

import type { AxeOptions } from "../kit/kit-axe.js";

/** The props the harness gives a `wrapper`: the content, and the props the part is rendered with. */
export type ConformanceWrapperProps = {
	children: Snippet;
	/**
	 * The props the part is rendered with, including the state props (such as `checked` for a
	 * Switch.Thumb) that the wrapper consumes and the part doesn't receive.
	 */
	partProps: Record<string, unknown>;
};

/** A module's export the server loads by itself: the module's URL and a dotted export path. */
export type ServerExport = { url: string; name: string };

/**
 * Describes a part to the conformance suite (`describeConformance`), written beside the call that
 * runs it. The server render (`renderPartOnServer` in tests/browser-commands.ts) cannot load the
 * test file, so `server` names the modules it renders from.
 */
export type ConformanceSetup<State> = {
	/** The part under test. */
	part: Component<Record<string, unknown>>;
	/**
	 * Providers the part must be placed within, rendered around it. It receives the part's props,
	 * so it can give the part the state the setup's `on` and `off` stand for.
	 */
	wrapper?: Component<ConformanceWrapperProps>;
	/** Props passed to the part on every render. */
	props?: Record<string, unknown>;
	/**
	 * Props passed to the part only while it renders through the `<button>` render snippet, e.g.
	 * `nativeButton: true` for a part that otherwise expects a non-button element.
	 */
	renderProps?: Record<string, unknown>;
	/** The tag of the element the part renders without a render snippet. */
	defaultTag: string;
	/**
	 * A state the part shows as a data attribute, with props that turn it on and off. Omitted for a
	 * part with empty state (Form): the suite then skips its state checks.
	 */
	state?: {
		attribute: string;
		on: Record<string, unknown>;
		off: Record<string, unknown>;
		/** Reads the same state from the part's state object. */
		isOn: (state: State) => boolean;
	};
	/**
	 * For a part with its own click handler: reads something from the element that the handler
	 * changes, so the suite can tell whether it ran. Clicking the part in its `off` state must turn
	 * the state on (the suite uses this to give the part state that only the part holds).
	 */
	readOwnClick?: (element: Element) => unknown;
	/**
	 * For a part that forwards its ARIA props to the range input it renders (Slider.Thumb): the
	 * suite expects `aria-label` on that input instead of the part's element.
	 */
	ariaOnInput?: boolean;
	/**
	 * For a part that renders a void element (such as `<input>`) and takes no `children`: the
	 * harness never passes a children snippet, and the suite skips its children tests.
	 */
	childless?: boolean;
	/**
	 * For a part that renders nothing on the server (one inside a Portal, which resolves its
	 * container after mount): the hydration test then checks that the server HTML
	 * leaves the part out and that it appears, anywhere in the document, once hydration settles.
	 */
	clientOnly?: boolean;
	/**
	 * Data attributes that hydration changes, because the part learns them only once mounted (an
	 * item's `data-index`, `-1` on the server): each element carrying one shows the
	 * `server` value before hydration and the `client` value after it.
	 */
	settledOnMount?: Readonly<Record<string, { server: string; client: string }>>;
	/**
	 * For a part whose elements get their id only once mounted (Combobox.Item derives it
	 * from its index, -1 on the server): an element without an id on the server may have one after
	 * hydration.
	 */
	idsAssignedOnMount?: boolean;
	/**
	 * Where the server finds `part` and `wrapper`, so the hydration test can have it render the part
	 * when it runs: `{ part: { url, name: "Popover.Trigger" }, wrapper: { url, name: "default" } }`,
	 * each `url` a `new URL(…, import.meta.url).href`.
	 */
	server: { part: ServerExport; wrapper?: ServerExport };
	/**
	 * For the axe check: props that complete the part the way a page would (an accessible name for
	 * a control rendered alone), and rules a part alone can't satisfy, each with the reason.
	 */
	axe?: { props?: Record<string, unknown> } & AxeOptions;
};

/** How the harness renders the part in one test. */
export type HarnessOptions = {
	/** Props passed to the part, on top of `setup.props`. */
	partProps?: Record<string, unknown>;
	/** The render snippet: a `<button {...props}>`, or an `<em>` that ignores `props`. */
	render?: "button" | "ignore-props";
	/** Passes a children snippet that prints whether the state is on. */
	withChildren?: boolean;
	/** An attachment placed on the part with `{@attach}`. */
	attach?: Attachment;
};

/** The props for `conformance-harness.svelte`. The part always gets `data-testid="part"` first. */
export function harnessProps<State>(setup: ConformanceSetup<State>, options: HarnessOptions = {}) {
	return {
		part: setup.part,
		wrapper: setup.wrapper,
		// The harness only passes the part's own state back to it.
		isOn: (setup.state?.isOn ?? (() => false)) as (state: unknown) => boolean,
		render: options.render,
		renderProps: setup.renderProps,
		withChildren: options.withChildren && !setup.childless,
		attach: options.attach,
		partProps: { "data-testid": "part", ...setup.props, ...options.partProps },
		// With a wrapper, the state props are the wrapper's (it gives the part that state); the part
		// must not receive them, or they would land on its element as attributes.
		stateKeys:
			setup.state && setup.wrapper
				? [...new Set([...Object.keys(setup.state.on), ...Object.keys(setup.state.off)])]
				: [],
	};
}

/** The harness props the server renders a part with, and the browser later hydrates with. */
export function serverRenderProps<State>(setup: ConformanceSetup<State>) {
	return harnessProps(setup, { partProps: setup.state?.on, withChildren: true });
}

/**
 * What the server renders a part's harness from, as JSON: the part's and the wrapper's exports,
 * and `serverRenderProps` without its functions. The server renders the part in its `on` state, so
 * its `isOn` is `stateful`.
 */
export type ServerHarness = {
	part: ServerExport;
	wrapper?: ServerExport;
	stateful: boolean;
	props: Record<string, unknown>;
};

/** The `ServerHarness` of `setup`. */
export function serverHarness<State>(setup: ConformanceSetup<State>): ServerHarness {
	const {
		part: _part,
		wrapper: _wrapper,
		isOn: _isOn,
		attach: _attach,
		...props
	} = serverRenderProps(setup);
	return {
		part: setup.server.part,
		wrapper: setup.server.wrapper,
		stateful: setup.state !== undefined,
		props,
	};
}
