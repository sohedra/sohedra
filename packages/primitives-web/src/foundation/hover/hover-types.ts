import type {
	HoverTriggerOptions as CoreHoverTriggerOptions,
	HoverView,
} from "@sohedra/primitives-core/foundation/hover/index.js";
import type { OpenChangeDetails } from "@sohedra/primitives-core/foundation/popup/index.js";
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
export interface HoverTriggerOptions extends CoreHoverTriggerOptions {
	/** Whether this trigger is the popup's active one. */
	readonly isActiveTrigger: boolean;
	/** The trigger element. */
	readonly triggerElement: Element | null;
}

export interface HoverTrigger {
	/** Installs the listeners and effects. Call once, while the trigger part initialises. */
	/** Spread on the trigger's element. */
	readonly props: Pick<
		HTMLAttributes<HTMLElement>,
		"onpointerdown" | "onpointerenter" | "onmousemove"
	>;
}
