// How each kind of popup behaves, as plain data: one row per kind, read by a platform's parts and
// by the kind's store. Only fixed answers go in a row. An answer that depends on live state is a
// `$derived` in the store that reads the row (Popover's mouse press type while it traps focus).

import type { PressType } from "../dismiss/index.js";
import type { Side } from "../position/index.js";

export interface PopupBehavior {
	/**
	 * How a press outside the popup dismisses it, for mouse and for touch input: `intentional`
	 * waits for the click, `sloppy` dismisses when the press starts.
	 */
	readonly outsidePress: PressType | { readonly mouse: PressType; readonly touch: PressType };
	/**
	 * Where focus goes when the element holding it inside the popup goes away: to the popup
	 * itself (`popup`), or back to the last tabbable element inside it (`true`). Absent for a popup
	 * that manages no focus.
	 */
	readonly restoreFocus?: true | "popup" | undefined;
	/**
	 * How hovering a trigger opens the popup. Absent for a popup hover never opens: its store
	 * builds no hover state.
	 */
	readonly hover?:
		| {
				/** Whether only mouse-like pointers open it. */
				readonly mouseOnly: boolean;
				/**
				 * What the open delay waits for: the pointer resting on the trigger, or entering it.
				 * `getHoverTiming` turns it into a trigger's hover options.
				 */
				readonly delay: "rest" | "enter";
		  }
		| undefined;
	/**
	 * Which element holds the popup for dismissal and focus: the Positioner (the default), or the
	 * popup element itself, for a popup that no Positioner places.
	 */
	readonly floating?: "positioner" | "popup" | undefined;
	/** The side of the anchor the popup is placed on by default. Absent for a popup with no anchor. */
	readonly side?: Side | undefined;
	/**
	 * Which interactions a trigger of the kind wires beside its press, for a platform's shared
	 * trigger wiring: hover comes from {@link hover}; these are the others. Absent means none.
	 */
	readonly trigger?:
		| {
				/** Whether the trigger records how the popup was opened (a pointer type, or the keyboard). */
				readonly recordsOpenMethod?: true | undefined;
				/** Whether the trigger renders the focus guards that carry Tab into a portalled popup. */
				readonly focusGuards?: true | undefined;
				/** Whether keyboard focus on the trigger opens the popup. */
				readonly opensOnFocus?: true | undefined;
		  }
		| undefined;
	/**
	 * What an open popup does when its active trigger unmounts: keeps the trigger's place, or
	 * closes (the store's `lostTrigger` rule says with which details).
	 */
	readonly lostTrigger: "keep" | "close";
}

/** The rows, taken from what each kind's parts and wiring pass today. */
export const POPUP_BEHAVIOR = {
	popover: {
		outsidePress: { mouse: "intentional", touch: "sloppy" },
		restoreFocus: "popup",
		hover: { mouseOnly: true, delay: "rest" },
		side: "bottom",
		trigger: { recordsOpenMethod: true, focusGuards: true },
		lostTrigger: "keep",
	},
	tooltip: {
		outsidePress: "sloppy",
		hover: { mouseOnly: true, delay: "rest" },
		side: "top",
		lostTrigger: "close",
	},
	dialog: {
		outsidePress: { mouse: "intentional", touch: "sloppy" },
		restoreFocus: "popup",
		floating: "popup",
		lostTrigger: "keep",
	},
	previewCard: {
		outsidePress: "sloppy",
		hover: { mouseOnly: true, delay: "enter" },
		side: "bottom",
		lostTrigger: "close",
	},
	select: {
		outsidePress: "sloppy",
		restoreFocus: true,
		side: "bottom",
		lostTrigger: "keep",
	},
	menu: {
		outsidePress: "sloppy",
		restoreFocus: true,
		hover: { mouseOnly: true, delay: "rest" },
		side: "bottom",
		lostTrigger: "keep",
	},
	combobox: {
		// The software keyboard shrinks the visual viewport: a touch outside may be a scroll.
		outsidePress: { mouse: "sloppy", touch: "intentional" },
		side: "bottom",
		lostTrigger: "keep",
	},
	navigationMenu: {
		outsidePress: "intentional",
		hover: { mouseOnly: false, delay: "rest" },
		side: "bottom",
		lostTrigger: "keep",
	},
} as const satisfies Record<string, PopupBehavior>;

/** A kind of popup that has a row. */
export type PopupKind = keyof typeof POPUP_BEHAVIOR;
