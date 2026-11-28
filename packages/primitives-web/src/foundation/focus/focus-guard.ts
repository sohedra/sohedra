import type { HTMLAttributes } from "svelte/elements";
import { on } from "svelte/events";

import { attachmentProps, userAgent, visuallyHidden } from "../kernel/index.js";

/** Marks a focus guard. */
export const FOCUS_GUARD_ATTRIBUTE = "data-sohedra-focus-guard";

/**
 * The props of a focus guard: a visually hidden, tabbable span that turns Tab into a focus move.
 * VoiceOver's virtual cursor only fires `focus` on role="button", so WebKit with VoiceOver gets it.
 */
export function focusGuardProps(
	onfocus: (event: FocusEvent) => void,
	extra?: Record<string, unknown>,
): HTMLAttributes<HTMLSpanElement> {
	// WORKAROUND(safari): VoiceOver's virtual cursor only fires `focus` on role="button". Remove
	// when it focuses any tabbable element.
	const voiceOver = userAgent.screenReader.voiceOver && userAgent.engine.webkit;
	return {
		...extra,
		tabindex: 0,
		role: voiceOver ? "button" : undefined,
		"aria-hidden": voiceOver ? undefined : "true",
		style: visuallyHidden,
		[FOCUS_GUARD_ATTRIBUTE]: "",
		// `focusin` (React's `onFocus`), so a portal's capture-phase `focusin` listener re-enables
		// focus inside it first; `focus` fires before `focusin`. Not delegated: Svelte's delegated
		// listener misses a focus move between two elements of one shadow root.
		...attachmentProps<HTMLSpanElement>((element) => on(element, "focusin", onfocus)),
	};
}
