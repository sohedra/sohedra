// The shared suites Popover runs: the part contract for each part, the popup suite, and the
// detached-triggers suite.
import type { Component } from "svelte";

import { Popover } from "#lib/components/popover/index.js";
import type {
	PopoverArrowState,
	PopoverBackdropState,
	PopoverCloseState,
	PopoverDescriptionState,
	PopoverPopupState,
	PopoverPortalState,
	PopoverTitleState,
	PopoverTriggerState,
	PopoverViewportState,
} from "#lib/components/popover/popover-types.js";

import { describeDetachedTriggersConformance } from "../../conformance/conformance-detached-triggers.js";
import { describeConformance } from "../../conformance/conformance-part.js";
import { describePopupConformance } from "../../conformance/conformance-popup.js";
import type {
	ConformanceSetup,
	ConformanceWrapperProps,
} from "../../conformance/conformance-setup.js";
import PopoverBackdropWrapper from "./fixtures/popover-backdrop-wrapper.svelte";
import PopoverDemo from "./fixtures/popover-demo.svelte";
import PopoverPopupWrapper from "./fixtures/popover-popup-wrapper.svelte";
import PopoverPositionerWrapper from "./fixtures/popover-positioner-wrapper.svelte";
import PopoverRootTriggerWrapper from "./fixtures/popover-root-trigger-wrapper.svelte";
import PopoverRootWrapper from "./fixtures/popover-root-wrapper.svelte";
import PopoverTriggerWrapper from "./fixtures/popover-trigger-wrapper.svelte";

/** The popover entry, where the server finds each part. */
const POPOVER = new URL("../../../src/components/popover/index.ts", import.meta.url).href;

/**
 * Popover.Trigger as the conformance suite sees it: in a Root whose `open` the state props set,
 * naming the trigger with `triggerId` so the server renders it open too. Its own click toggles the
 * popover, read back from `aria-expanded`.
 */
const triggerSetup: ConformanceSetup<PopoverTriggerState> = {
	part: Popover.Trigger as Component<Record<string, unknown>>,
	wrapper: PopoverTriggerWrapper as Component<ConformanceWrapperProps>,
	props: { id: "conformance-trigger" },
	defaultTag: "button",
	server: {
		part: { url: POPOVER, name: "Popover.Trigger" },
		wrapper: {
			url: new URL("./fixtures/popover-trigger-wrapper.svelte", import.meta.url).href,
			name: "default",
		},
	},
	state: {
		attribute: "data-popup-open",
		on: { open: true },
		off: { open: false },
		isOn: (state) => state.open,
	},
	readOwnClick: (element) => element.getAttribute("aria-expanded"),
};

describeConformance("Popover.Trigger", () => triggerSetup);

/**
 * Popover.Portal as the conformance suite sees it: inside an open Popover.Root.
 * It is kept mounted: a click on the portal element is a press outside the (absent) popup, which
 * closes the popover. It resolves its container after mount, so the server leaves it out.
 */
const portalSetup: ConformanceSetup<PopoverPortalState> = {
	part: Popover.Portal as Component<Record<string, unknown>>,
	wrapper: PopoverRootWrapper as Component<ConformanceWrapperProps>,
	props: { keepMounted: true },
	defaultTag: "div",
	server: {
		part: { url: POPOVER, name: "Popover.Portal" },
		wrapper: {
			url: new URL("./fixtures/popover-root-wrapper.svelte", import.meta.url).href,
			name: "default",
		},
	},
	clientOnly: true,
};

describeConformance("Popover.Portal", () => portalSetup);

/**
 * Popover.Backdrop as the conformance suite sees it: inside a Popover.Root whose
 * `open` the state props set. The wrapper cancels the outside press a click on the backdrop is,
 * which would otherwise close the popover and hide the backdrop before the suite's second click.
 */
const backdropSetup: ConformanceSetup<PopoverBackdropState> = {
	part: Popover.Backdrop as Component<Record<string, unknown>>,
	wrapper: PopoverBackdropWrapper as Component<ConformanceWrapperProps>,
	defaultTag: "div",
	server: {
		part: { url: POPOVER, name: "Popover.Backdrop" },
		wrapper: {
			url: new URL("./fixtures/popover-backdrop-wrapper.svelte", import.meta.url).href,
			name: "default",
		},
	},
	state: {
		attribute: "data-open",
		on: { open: true },
		off: { open: false },
		isOn: (state) => state.open,
	},
};

describeConformance("Popover.Backdrop", () => backdropSetup);

/**
 * Popover.Popup as the conformance suite sees it: in Root > Portal > Positioner.
 * The state props set the root's `open`; the portal is kept mounted so the closed popup stays.
 * The portal renders after mount only, so the server leaves the popup out.
 */
const popupSetup: ConformanceSetup<PopoverPopupState> = {
	part: Popover.Popup as Component<Record<string, unknown>>,
	wrapper: PopoverPositionerWrapper as Component<ConformanceWrapperProps>,
	defaultTag: "div",
	server: {
		part: { url: POPOVER, name: "Popover.Popup" },
		wrapper: {
			url: new URL("./fixtures/popover-positioner-wrapper.svelte", import.meta.url).href,
			name: "default",
		},
	},
	state: {
		attribute: "data-open",
		on: { open: true },
		off: { open: false },
		isOn: (state) => state.open,
	},
	clientOnly: true,
	axe: { props: { "aria-label": "Popover" } },
};

describeConformance("Popover.Popup", () => popupSetup);

/**
 * Popover.Arrow as the conformance suite sees it: in Root > Portal > Positioner > Popup. The
 * state props set the root's `open`; the portal is kept mounted so the closed arrow
 * stays. The portal renders after mount only, so the server leaves the arrow out.
 */
const arrowSetup: ConformanceSetup<PopoverArrowState> = {
	part: Popover.Arrow as Component<Record<string, unknown>>,
	wrapper: PopoverPopupWrapper as Component<ConformanceWrapperProps>,
	defaultTag: "div",
	server: {
		part: { url: POPOVER, name: "Popover.Arrow" },
		wrapper: {
			url: new URL("./fixtures/popover-popup-wrapper.svelte", import.meta.url).href,
			name: "default",
		},
	},
	state: {
		attribute: "data-open",
		on: { open: true },
		off: { open: false },
		isOn: (state) => state.open,
	},
	clientOnly: true,
	axe: {
		disable: {
			"aria-dialog-name":
				"the wrapper renders the popup without a Title (and gives it no name); the component's axe test names it",
		},
	},
};

describeConformance("Popover.Arrow", () => arrowSetup);

/**
 * Popover.Viewport as the conformance suite sees it: in Root > Portal > Positioner > Popup. Its
 * state (a trigger change in progress) can't be set through props, so the suite
 * runs its stateless checks. The portal renders after mount only, so the server leaves it out.
 */
const viewportSetup: ConformanceSetup<PopoverViewportState> = {
	part: Popover.Viewport as Component<Record<string, unknown>>,
	wrapper: PopoverPopupWrapper as Component<ConformanceWrapperProps>,
	defaultTag: "div",
	server: {
		part: { url: POPOVER, name: "Popover.Viewport" },
		wrapper: {
			url: new URL("./fixtures/popover-popup-wrapper.svelte", import.meta.url).href,
			name: "default",
		},
	},
	clientOnly: true,
	axe: {
		disable: {
			"aria-dialog-name":
				"the wrapper renders the popup without a Title (and gives it no name); the component's axe test names it",
		},
	},
};

describeConformance("Popover.Viewport", () => viewportSetup);

/**
 * Popover.Title as the conformance suite sees it. Rather than in the popup, it sits
 * beside a trigger in an open Popover.Root (it needs only the root), so the server renders it.
 */
const titleSetup: ConformanceSetup<PopoverTitleState> = {
	part: Popover.Title as Component<Record<string, unknown>>,
	wrapper: PopoverRootTriggerWrapper as Component<ConformanceWrapperProps>,
	defaultTag: "h2",
	server: {
		part: { url: POPOVER, name: "Popover.Title" },
		wrapper: {
			url: new URL("./fixtures/popover-root-trigger-wrapper.svelte", import.meta.url).href,
			name: "default",
		},
	},
};

describeConformance("Popover.Title", () => titleSetup);

/**
 * Popover.Description as the conformance suite sees it. Rather than in the popup, it
 * sits beside a trigger in an open Popover.Root (it needs only the root), so the server renders
 * it.
 */
const descriptionSetup: ConformanceSetup<PopoverDescriptionState> = {
	part: Popover.Description as Component<Record<string, unknown>>,
	wrapper: PopoverRootTriggerWrapper as Component<ConformanceWrapperProps>,
	defaultTag: "p",
	server: {
		part: { url: POPOVER, name: "Popover.Description" },
		wrapper: {
			url: new URL("./fixtures/popover-root-trigger-wrapper.svelte", import.meta.url).href,
			name: "default",
		},
	},
};

describeConformance("Popover.Description", () => descriptionSetup);

/**
 * Popover.Close as the conformance suite sees it. Rather than in the popup, it sits
 * beside a trigger in an open Popover.Root (it needs only the root), so the server renders it.
 * Its own click handler closes the popover, read back from the trigger's `aria-expanded`.
 */
const closeSetup: ConformanceSetup<PopoverCloseState> = {
	part: Popover.Close as Component<Record<string, unknown>>,
	wrapper: PopoverRootTriggerWrapper as Component<ConformanceWrapperProps>,
	defaultTag: "button",
	server: {
		part: { url: POPOVER, name: "Popover.Close" },
		wrapper: {
			url: new URL("./fixtures/popover-root-trigger-wrapper.svelte", import.meta.url).href,
			name: "default",
		},
	},
	readOwnClick: (element) =>
		element.ownerDocument
			.querySelector('[data-testid="wrapper-trigger"]')
			?.getAttribute("aria-expanded"),
};

describeConformance("Popover.Close", () => closeSetup);

describePopupConformance("Popover", () => ({
	demo: PopoverDemo,
	// `open` goes to the demo's own `open` (bound to the Root), which a spread can't override.
	props: ({ root: { open, ...rootProps } = {}, trigger, portal, popup }) => ({
		triggers: ["Open menu"],
		open,
		rootProps,
		triggerProps: trigger,
		portalProps: portal,
		popupProps: popup,
	}),
	triggerAction: "click",
	popupRole: "dialog",
	// The demo's popup has no Title to name it.
	axe: { popupProps: { "aria-label": "Popover" } },
}));

describeDetachedTriggersConformance("Popover", () => ({
	createHandle: Popover.createHandle,
	Root: Popover.Root,
	Trigger: Popover.Trigger,
	Portal: Popover.Portal,
	Positioner: Popover.Positioner,
	Popup: Popover.Popup,
	Viewport: Popover.Viewport,
	Close: Popover.Close,
	openInteractions: ["click"],
	ariaExpanded: true,
	throwOnMissingTrigger: true,
}));
