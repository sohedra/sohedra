import type {
	HoverPopupStoreProps,
	HoverTriggerStoreProps,
} from "@sohedra/primitives-core/foundation/hover";
import type { PopupView } from "@sohedra/primitives-core/foundation/popup";

import type { Props, WebTypes } from "../kernel/index.js";

/** A trigger's hover options, as a plain object the part builds from its props and store. */
export interface HoverTriggerOptions extends HoverTriggerStoreProps {
	/** The popup the trigger reads now: a handle's store changes when a Root attaches. */
	readonly popup: PopupView<WebTypes>;
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
