import type { Component, Snippet } from "svelte";
import type { Attachment } from "svelte/attachments";

import type { AxeOptions } from "../axe.js";

/** The props the harness gives a `wrapper`: the content, and the props the part is rendered with. */
export type ConformanceWrapperProps = {
	children: Snippet;
	/**
	 * The props the part is rendered with, including the state props (such as `checked` for a
	 * Switch.Thumb) that the wrapper consumes and the part doesn't receive.
	 */
	partProps: Record<string, unknown>;
};

/**
 * Describes a part to the conformance suite. Shared by the browser suite (`describeConformance`)
 * and its server-render half (`describeServerRender`), so keep it in a module both can import.
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
	 * Where this setup is exported: `{ url: import.meta.url, name: "<its export name>" }`. With it,
	 * the hydration test has the server render the part when it runs; without it, the test hydrates
	 * the HTML that `describeServerRender` keeps in `__ssr__`.
	 */
	module?: { url: string; name: string };
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

/** The props for `ConformanceHarness.svelte`. The part always gets `data-testid="part"` first. */
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

/** The harness props the server-render fixture is made with, and later hydrated with. */
export function serverRenderProps<State>(setup: ConformanceSetup<State>) {
	return harnessProps(setup, { partProps: setup.state?.on, withChildren: true });
}

/** The `__ssr__` file a part's server render is kept in: `Switch.Root` → `switch-root.html`. */
export function ssrFileName(name: string) {
	return `${name.toLowerCase().replace(/\./g, "-")}.html`;
}
