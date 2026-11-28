import { error, watch } from "@sohedra/primitives-core/foundation/kernel/index.js";
import { DEV } from "esm-env";
import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

import {
	attachmentProps,
	dispatchSyntheticClick,
	isHTMLElement,
	makeEventPreventable,
	mergeProps,
	type Props,
} from "../kernel/index.js";

export interface ButtonOptions {
	/** Whether the button should ignore user interaction. */
	readonly disabled: boolean;
	/** Whether the element is a native `<button>`. */
	readonly native: boolean;
	/** Whether the button stays focusable while disabled. */
	readonly focusableWhenDisabled?: boolean | undefined;
	/**
	 * Whether the button is an item of a composite widget (a menu item): Space presses it on
	 * keydown, and the widget's roving focus owns its tab index. @default false
	 */
	readonly composite?: boolean | undefined;
	readonly tabIndex?: number | undefined;
}

/** What `useButton` returns. */
export interface Button {
	/**
	 * For `Part`'s `after`: button semantics that wrap the handlers merged before them, with the
	 * button's attachment inside.
	 */
	readonly after: (merged: Props) => Props;
}

type Handler = ((event: Event) => void) | undefined;

/**
 * The props that keep a disabled element focusable or not:
 * `aria-disabled` or the `disabled` attribute, the tab index outside a composite, and a keydown
 * that blocks every key but Tab on a focusable disabled element.
 */
function focusableWhenDisabledProps(options: ButtonOptions): Props {
	const { disabled, native, focusableWhenDisabled } = options;
	const composite = options.composite ?? false;
	const focusableComposite = composite && focusableWhenDisabled !== false;
	const nonFocusableComposite = composite && focusableWhenDisabled === false;
	const tabIndex = options.tabIndex ?? 0;
	const props: Props = {
		// Allow tabbing away from focusable disabled elements.
		onkeydown(event: KeyboardEvent) {
			if (options.disabled && options.focusableWhenDisabled && event.key !== "Tab") {
				event.preventDefault();
			}
		},
	};
	if (!composite) {
		props.tabindex = !native && disabled && !focusableWhenDisabled ? -1 : tabIndex;
	}
	if ((native && (focusableWhenDisabled || focusableComposite)) || (!native && disabled)) {
		props["aria-disabled"] = disabled;
	}
	if (native && (!focusableWhenDisabled || nonFocusableComposite)) {
		props.disabled = disabled;
	}
	return props;
}

/**
 * Native and non-native button semantics: Enter/Space activation on non-buttons, disabled
 * handling, focusability. `after` goes at the end of a part's merge chain: it wraps the handlers
 * merged so far. A composite item (a menu item) is pressed with Space on keydown, and leaves its
 * tab index to the widget. Call it once while the part initialises.
 */
export function useButton(options: () => ButtonOptions): Button {
	function after(external: Props): Props {
		const {
			onclick: externalOnClick,
			onmousedown: externalOnMouseDown,
			onkeyup: externalOnKeyUp,
			onkeydown: externalOnKeyDown,
			onpointerdown: externalOnPointerDown,
			...otherExternalProps
		} = external as Record<string, unknown>;

		return mergeProps(
			{
				onclick(event: MouseEvent) {
					if (options().disabled) {
						event.preventDefault();
						return;
					}
					(externalOnClick as Handler)?.(event);
				},
				onmousedown(event: MouseEvent) {
					if (!options().disabled) {
						(externalOnMouseDown as Handler)?.(event);
					}
				},
				onkeydown(event: KeyboardEvent) {
					const { disabled, native, composite } = options();
					if (disabled) {
						return;
					}
					const preventable = makeEventPreventable(event);
					(externalOnKeyDown as Handler)?.(event);
					if (preventable.sohedraHandlerPrevented) {
						return;
					}
					const isCurrentTarget = event.target === event.currentTarget;
					const currentTarget = event.currentTarget as Element;
					const isButton = isButtonElement(currentTarget);
					const isLink = !native && isValidLinkElement(currentTarget);
					const shouldClick = isCurrentTarget && (native ? isButton : !isLink);
					const isEnterKey = event.key === "Enter";
					const isSpaceKey = event.key === " ";
					const role = currentTarget.getAttribute("role");
					const isTextNavigationRole =
						role?.indexOf("menuitem") === 0 || role === "option" || role === "gridcell";

					// A composite item is pressed by Space on keydown (unless typeahead took the Space).
					if (isCurrentTarget && composite && isSpaceKey) {
						if (event.defaultPrevented && isTextNavigationRole) {
							return;
						}
						event.preventDefault();
						if (!native || isButton) {
							preventable.preventSohedraHandler();
							dispatchSyntheticClick(currentTarget, event);
						}
						return;
					}

					// Keyboard accessibility for native and non-native elements.
					if (!shouldClick || native || (!isSpaceKey && !isEnterKey)) {
						// Space activates links on keyup; prevent the page scroll it would otherwise cause.
						if (isCurrentTarget && isLink && isSpaceKey) {
							event.preventDefault();
						}
						return;
					}
					// Match native buttons: preventing the keydown's default cancels activation.
					if (event.defaultPrevented) {
						return;
					}
					event.preventDefault();
					if (isEnterKey) {
						preventable.preventSohedraHandler();
						dispatchSyntheticClick(currentTarget, event);
					}
				},
				onkeyup(event: KeyboardEvent) {
					const { disabled, native, composite } = options();
					if (disabled) {
						return;
					}
					const preventable = makeEventPreventable(event);
					(externalOnKeyUp as Handler)?.(event);
					// A composite native button was pressed on keydown: its keyup click would repeat it.
					if (
						event.target === event.currentTarget &&
						native &&
						composite &&
						isButtonElement(event.currentTarget as Element) &&
						event.key === " "
					) {
						event.preventDefault();
						return;
					}
					if (preventable.sohedraHandlerPrevented) {
						return;
					}
					// Keyboard accessibility for non-interactive elements. Match native buttons:
					// preventing the keyup's default cancels Space activation.
					if (
						event.target === event.currentTarget &&
						!native &&
						!composite &&
						!event.defaultPrevented &&
						event.key === " "
					) {
						preventable.preventSohedraHandler();
						dispatchSyntheticClick(event.currentTarget as Element, event);
					}
				},
				onpointerdown(event: PointerEvent) {
					if (options().disabled) {
						event.preventDefault();
						return;
					}
					(externalOnPointerDown as Handler)?.(event);
				},
			},
			options().native ? { type: "button" } : { role: "button" },
			focusableWhenDisabledProps(options()),
			otherExternalProps,
			attached,
		);
	}

	/**
	 * A focusable disabled composite item whose element another part made natively disabled (a
	 * disabled Toolbar.Button rendering a Menu.Trigger or a grouped Toggle: `disabled` passes
	 * through both parts' buttons) clears the `disabled` attribute, so the item stays focusable.
	 * Then, in development, checks that the rendered element matches `native`.
	 */
	const attach: Attachment<Element> = (element) => {
		if (untrack(options).composite) {
			// Keeps a focusable disabled composite item focusable when another part disabled it natively.
			watch(
				[() => options().disabled, () => focusableWhenDisabledProps(options()).disabled],
				([disabled, disabledAttribute]) => {
					if (
						disabled &&
						disabledAttribute === undefined &&
						isButtonElement(element) &&
						element.disabled
					) {
						element.disabled = false;
					}
				},
			);
		}
		if (!DEV) {
			return;
		}
		const native = untrack(options).native;
		const isButtonTag = isButtonElement(element);
		if (native && !isButtonTag) {
			error(
				"A component that acts as a button expected a native <button> because the",
				"`nativeButton` prop is true. Rendering a non-<button> removes native button",
				"semantics, which can impact forms and accessibility. Use a real <button> in the",
				"`render` snippet, or set `nativeButton` to `false`.",
			);
		} else if (!native && isButtonTag) {
			error(
				"A component that acts as a button expected a non-<button> because the `nativeButton`",
				"prop is false. Rendering a <button> keeps native behavior while Sohedra applies",
				"non-native attributes and handlers, which can add unintended extra attributes (such",
				"as `role` or `aria-disabled`). Use a non-<button> in the `render` snippet, or set",
				"`nativeButton` to `true`.",
			);
		}
	};

	// Made once, so the attachment stays attached while the props are merged again.
	const attached = attachmentProps(attach);

	return { after };
}

function isButtonElement(element: Element | null): element is HTMLButtonElement {
	return isHTMLElement(element) && element.tagName === "BUTTON";
}

function isValidLinkElement(element: Element | null): element is HTMLAnchorElement {
	return (
		isHTMLElement(element) &&
		element.tagName === "A" &&
		Boolean((element as HTMLAnchorElement).href)
	);
}
