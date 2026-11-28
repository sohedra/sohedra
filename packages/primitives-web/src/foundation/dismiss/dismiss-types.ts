import type { DismissInteraction } from "@sohedra/primitives-core/foundation/dismiss/index.js";
import type { OpenChangeDetails } from "@sohedra/primitives-core/foundation/popup/index.js";
import type { HTMLAttributes } from "svelte/elements";

import type { WebTypes } from "../kernel/index.js";
import type { PressTargetView } from "./dismiss-press-target.js";

/** What a trigger's dismiss wiring reads from a popup: only its dismissal. */
export interface DismissTriggerView {
	/** The popup's dismissal: the decisions, and the press being followed. */
	readonly dismiss: DismissInteraction<WebTypes>;
}

/** What the Popup part's dismiss wiring reads from a popup. */
export interface DismissPopupView extends DismissTriggerView {
	/** The positioned element that holds the popup. */
	readonly floatingElement: Element | null;
}

/**
 * Everything the Root's dismiss wiring reads from a popup. The names are a popup store's own, so
 * a part hands its store over as it is; the behaviour can reach nothing else of it.
 */
export interface DismissView extends DismissPopupView, PressTargetView {
	readonly open: boolean;
	/** The popup's open changes, with the reason and the event of each. */
	readonly events: {
		on(event: "openchange", listener: (details: OpenChangeDetails<WebTypes>) => void): void;
		off(event: "openchange", listener: (details: OpenChangeDetails<WebTypes>) => void): void;
	};
}

/** What the Root's dismiss wiring is given besides the popup. */
export interface DismissRootOptions {
	/**
	 * The popup's kind's own test of an outside press: the part finds the facts in the event and
	 * hands them to its store, which answers whether the press dismisses. Asked only when the press
	 * would otherwise dismiss, while the event is still being dispatched. Absent, every such press
	 * dismisses.
	 */
	readonly outsidePress?: ((event: MouseEvent | PointerEvent | TouchEvent) => boolean) | undefined;
}

export interface DismissPopup {
	/** Spread on the popup's element. It holds an attachment. */
	readonly props: HTMLAttributes<HTMLElement>;
}

export interface DismissTriggerOptions {
	/** Whether a press on the trigger may close the popup; the popup's kind decides each time. */
	readonly press?: boolean | undefined;
}

export interface DismissTrigger {
	/** Spread on the trigger's element. */
	readonly props: Pick<HTMLAttributes<HTMLElement>, "onkeydown" | "onpointerdown" | "onclick">;
}
