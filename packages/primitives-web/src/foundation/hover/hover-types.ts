import type {
	HoverPopupStoreProps,
	HoverTriggerStoreProps,
} from "@sohedra/primitives-core/foundation/hover/index.js";

import type { Props } from "../kernel/index.js";

/** A trigger's hover options, as a plain object the part builds from its props and store. */
export interface HoverTriggerOptions extends HoverTriggerStoreProps {
	/** Whether this trigger is the popup's active one. */
	readonly isActiveTrigger: boolean;
	/** The trigger element. */
	readonly triggerElement: Element | null;
}

/** The Popup's hover options, as a plain object the part builds from its props and store. */
export type HoverPopupOptions = HoverPopupStoreProps;

export interface HoverTrigger {
	/** Spread on the trigger's element. */
	readonly props: Props;
}
