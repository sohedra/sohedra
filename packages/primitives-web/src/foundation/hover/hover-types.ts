import type {
	HoverPopupOptions as CoreHoverPopupOptions,
	HoverTriggerOptions as CoreHoverTriggerOptions,
	HoverView,
} from "@sohedra/primitives-core/foundation/hover/index.js";
import type { OpenChangeDetails } from "@sohedra/primitives-core/foundation/popup/index.js";
import type { PhysicalSide } from "@sohedra/primitives-core/foundation/position/index.js";
import type { HTMLAttributes } from "svelte/elements";

import type { WebTypes } from "../kernel/index.js";

/**
 * Everything the web hover behaviour reads from a popup, and the one thing it asks of it. The
 * names are a popup store's own, so a part hands its store over as it is; the behaviour can reach
 * nothing else of it.
 */
export interface HoverPopupView extends HoverView<WebTypes> {
	/** The positioned element that holds the popup. */
	readonly floatingElement: Element | null;
	/** The popup's registered triggers. */
	readonly triggers: {
		hasElement(element: Element): boolean;
		hasMatchingElement(predicate: (element: Element) => boolean): boolean;
		entries(): IterableIterator<[string, Element]>;
		elements(): IterableIterator<Element>;
	};
	/** The popup's open changes, with the reason and the event of each. */
	readonly events: {
		on(event: "openchange", listener: (details: OpenChangeDetails<WebTypes>) => void): void;
		off(event: "openchange", listener: (details: OpenChangeDetails<WebTypes>) => void): void;
	};
}

/** A trigger's hover options, as a plain object the part builds from its props and store. */
export interface HoverTriggerOptions extends CoreHoverTriggerOptions<WebTypes> {
	/** Whether this trigger is the popup's active one. */
	readonly isActiveTrigger: boolean;
	/** The trigger element. */
	readonly triggerElement: Element | null;
	/** Whether the first pointer move over the trigger counts as entering it. @default false */
	readonly move?: boolean | undefined;
	/** Whether a `mouseout` from the trigger also cancels a pending open. @default false */
	readonly guardStaleOpen?: boolean | undefined;
	/**
	 * The side of the trigger the popup sits on, measured when the pointer leaves, for a popup no
	 * Positioner places (an inline NavigationMenu Viewport): the safe polygon's side.
	 */
	readonly safePolygonSide?: ((trigger: Element) => PhysicalSide | undefined) | undefined;
}

/** The Popup part's hover options. */
export interface HoverPopupOptions extends CoreHoverPopupOptions {
	/**
	 * The element whose pointer input is blocked while a hover opened the popup, when the popup
	 * chooses it (NavigationMenu's list). Else the enclosing menu tree's popup, or the page.
	 */
	readonly pointerBlockScope?: (() => HTMLElement | null) | undefined;
}

export interface HoverTrigger {
	/** Installs the listeners and effects. Call once, while the trigger part initialises. */
	/** Spread on the trigger's element. */
	readonly props: Pick<
		HTMLAttributes<HTMLElement>,
		"onpointerdown" | "onpointerenter" | "onmousemove"
	>;
}
