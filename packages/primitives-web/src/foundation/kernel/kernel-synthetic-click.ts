import { ownerWindow } from "./kernel-dom.js";

interface ClickModifiers {
	shiftKey: boolean;
	ctrlKey: boolean;
	altKey: boolean;
	metaKey: boolean;
}

/**
 * Dispatches a constructed click on the target so it carries the source event's modifier state,
 * which `click()` always reports as unpressed. Like `click()`, the untrusted click still runs
 * native activation behaviour (form submission, link navigation, checkbox toggling).
 * `detail` defaults to 0 and `pointerType` to `''` (the native convention for keyboard-generated
 * clicks).
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
