import { ownerWindow } from "./kernel-dom.js";

interface ClickModifiers {
	shiftKey: boolean;
	ctrlKey: boolean;
	altKey: boolean;
	metaKey: boolean;
}

/**
 * Dispatches a constructed click carrying the source event's modifier state, which `click()`
 * reports as unpressed; it still runs native activation. `detail` defaults to 0 and `pointerType`
 * to `''`, as for a keyboard click.
 */
export function dispatchSyntheticClick(
	target: Element,
	sourceEvent: ClickModifiers,
	{ detail = 0, pointerType = "" }: { detail?: number; pointerType?: string } = {},
): void {
	target.dispatchEvent(
		new (ownerWindow(target).PointerEvent)("click", {
			bubbles: true,
			cancelable: true,
			composed: true,
			detail,
			pointerType,
			shiftKey: sourceEvent.shiftKey,
			ctrlKey: sourceEvent.ctrlKey,
			altKey: sourceEvent.altKey,
			metaKey: sourceEvent.metaKey,
		}),
	);
}
