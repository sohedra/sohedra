import { REASONS, Timeout } from "@sohedra/primitives-core/foundation/kernel/index.js";
import type {
	InteractionType,
	OpenChangeDetails,
	PopupView,
} from "@sohedra/primitives-core/foundation/popup/index.js";
/* oxlint-disable max-lines -- One idea: a popup's focus on open, while open and on close share state that six separate files had to pass around. */
import { tick, untrack } from "svelte";
import { createAttachmentKey } from "svelte/attachments";

import {
	activeElement,
	attachRef,
	closest,
	contains,
	createChangeEventDetails,
	enqueueFocus,
	type FocusableElement,
	getNextTabbable,
	getNodeName,
	getPreviousTabbable,
	getTarget,
	isElementVisible,
	isHTMLElement,
	isOutsideEvent,
	isTabbable,
	isTypeableCombobox,
	isVirtualClick,
	isVirtualPointerEvent,
	ownerDocument,
	ownerWindow,
	stopEvent,
	tabbable,
	TYPEABLE_SELECTOR,
	userAgent,
	webScheduler,
	type WebTypes,
} from "../kernel/index.js";
import { FOCUS_GUARD_ATTRIBUTE, focusGuardProps } from "./focus-guard.js";
import {
	addPreviouslyFocusedElement,
	clearDisconnectedPreviouslyFocusedElements,
	getFocusablePreviouslyFocusedElement,
	getPreviouslyFocusedElement,
} from "./focus-history.js";
import { focusedOtherPortal, markOutside, type OutsideMarking } from "./focus-mark-outside.js";
import { CLICK_TRIGGER_IDENTIFIER } from "./focus-markers.js";
import { getPopupFocusElement, handleTabIndex } from "./focus-tabbability.js";
import type { FocusManager, FocusManagerDeps, FocusManagerOptions } from "./focus-types.js";

/** A resolved focus target, when it is an element. */
function resolveTarget(target: HTMLElement | null | undefined | boolean | void) {
	return isHTMLElement(target) ? target : null;
}

function getFirstTabbableElement(container: Element | null): Element | null {
	if (!container) {
		return null;
	}
	if (isTabbable(container)) {
		return container;
	}
	return tabbable(container)[0] || container;
}

/** The kind of input behind the event that closed the popup. */
function getEventType(event: Event, lastInteractionType?: InteractionType): InteractionType {
	const win = ownerWindow(getTarget(event) as Node | null);
	if (event instanceof win.KeyboardEvent) {
		return "keyboard";
	}
	if (event instanceof win.FocusEvent) {
		return lastInteractionType || "keyboard";
	}
	if ("pointerType" in event) {
		const pointerType = (event as PointerEvent).pointerType as InteractionType;
		return (
			pointerType ||
			(isVirtualClick(event as PointerEvent) ? "keyboard" : lastInteractionType || "mouse")
		);
	}
	if ("touches" in event) {
		return "touch";
	}
	if (event instanceof win.MouseEvent) {
		return lastInteractionType || ((event as MouseEvent).detail === 0 ? "keyboard" : "mouse");
	}
	return "";
}

// Return focus on an outside press only where `focus({ preventScroll })` works.
function isPreventScrollSupported(doc: Document): boolean {
	let supported = false;
	doc.createElement("div").focus({
		get preventScroll() {
			supported = true;
			return false;
		},
	});
	return supported;
}

/**
 * Focus management for a popup: initial focus, return focus, a modal trap with focus guards,
 * `aria-hidden` and the inert marker on outside content, Tab bridging through portal guards for a
 * non-modal popup, and closing when focus leaves.
 *
 * `popup` is what the manager reads of the popup (its store satisfies the view as it is) and
 * `options` returns the part's focus options as a plain object; it is called whenever one is
 * needed, so every option stays live. It starts its effects when called, once, while the Popup
 * part initialises. The Popup renders `beforeGuard` and `afterGuard` around its element while
 * `renderGuards`.
 */
export function useFocusManager(
	popup: PopupView<WebTypes>,
	options: () => FocusManagerOptions,
	deps: FocusManagerDeps,
): FocusManager {
	const { portal, bridge } = deps;

	// Value-compared views of the options an effect depends on: the effect re-runs when the value
	// changes, not when any signal the options object reads does (a close changes the reason a
	// Popup's `disabled` reads). `options()` itself is never called from a teardown, where a read
	// of derived state can go stale: a teardown reads plain copies.
	const disabled = $derived(options().disabled);
	const modal = $derived(options().modal ?? true);
	const restoreFocus = $derived(options().restoreFocus ?? false);
	const returnFocusOption = $derived(options().returnFocus);
	const popupFocusElement = $derived(
		getPopupFocusElement(popup.positionerElement as HTMLElement | null),
	);
	// A typeable combobox anchor keeps focus while its popup is open.
	const untrappedCombobox = $derived(
		isTypeableCombobox(popup.anchorElement) && options().initialFocus === false,
	);
	const renderGuards = $derived(
		!disabled && (modal ? !untrappedCombobox : true) && (portal != null || modal),
	);

	// Bookkeeping, read when input arrives and never rendered.
	/** A close that moves focus itself (a focus guard, a focus-out) skips the return. */
	let preventReturnFocus = false;
	/** A trigger is being pressed; focus moving out meanwhile isn't a focus-out. */
	let isPointerDown = false;
	/** The input that closed the popup, for the return focus's `focusVisible`. */
	let closeType: InteractionType = "";
	let lastInteractionType: InteractionType = "";
	/** The popup's own guards, around its element. */
	let beforeGuardElement: HTMLElement | null = null;
	let afterGuardElement: HTMLElement | null = null;
	let pointerDownOutside = false;
	let lastFocusedTabbable: FocusableElement | null = null;
	let cancelRestoreFocus: (() => void) | undefined;
	// `returnFocus` is read when the popup closes, not tracked: a new target doesn't re-arm.
	let pendingReturnFocus: { cancelled: boolean } | null = null;
	const blurTimeout = new Timeout(webScheduler);
	const pointerDownTimeout = new Timeout(webScheduler);

	/** The tabbable elements in `container` (the popup's focus element by default). */
	function tabbableContent(container: Element | null = popupFocusElement): FocusableElement[] {
		return container ? tabbable(container) : [];
	}

	/** The elements treated as inside the popup although rendered elsewhere. */
	function insideElements(): Element[] {
		const guard = bridge?.guards?.beforeTrigger;
		return guard ? [guard] : [];
	}

	/** The element Tab goes to when leaving the popup backwards: the trigger. */
	function previousFocusable(): HTMLElement | undefined {
		const trigger = bridge?.activeTriggerElement;
		return isHTMLElement(trigger) ? trigger : undefined;
	}

	/** The element Tab goes to when leaving the popup forwards: the guard after the trigger. */
	function nextFocusable(): HTMLElement | null | undefined {
		return bridge?.guards?.afterTrigger as HTMLElement | null | undefined;
	}

	function setOpen(open: boolean, event: FocusEvent): void {
		popup.setOpen(open, createChangeEventDetails(REASONS.focusOut, event));
	}

	function markPointerDown() {
		isPointerDown = true;
		pointerDownTimeout.start(0, () => {
			isPointerDown = false;
		});
	}

	// The guards around the Popup's element. A trap sends focus to its other end as the guard
	// takes it, not a frame later: a Tab pressed before that frame would leave from the guard.
	function onBeforeGuardFocus(event: FocusEvent) {
		if (modal) {
			const elements = tabbableContent();
			enqueueFocus(elements[elements.length - 1], { sync: true });
		} else if (portal?.portalNode) {
			preventReturnFocus = false;
			if (isOutsideEvent(event, portal.portalNode)) {
				getNextTabbable(popup.anchorElement)?.focus();
			} else {
				(previousFocusable() ?? portal.beforeOutsideGuard)?.focus();
			}
		}
	}

	function onAfterGuardFocus(event: FocusEvent) {
		if (modal) {
			enqueueFocus(tabbableContent()[0], { sync: true });
		} else if (portal?.portalNode) {
			preventReturnFocus = true;
			if (isOutsideEvent(event, portal.portalNode)) {
				getPreviousTabbable(popup.anchorElement)?.focus();
			} else {
				(nextFocusable() ?? portal.afterOutsideGuard)?.focus();
			}
		}
	}

	function setBeforeGuard(element: HTMLElement | null) {
		beforeGuardElement = element;
		if (portal) {
			portal.setBeforeInsideGuard(element);
		}
		bridge?.guards?.setBeforeContent(element);
	}

	function setAfterGuard(element: HTMLElement | null) {
		afterGuardElement = element;
		if (portal) {
			portal.setAfterInsideGuard(element);
		}
	}

	const beforeGuard = {
		...focusGuardProps(onBeforeGuardFocus, { "data-type": "inside" }),
		[createAttachmentKey()]: attachRef<HTMLElement>(setBeforeGuard),
	};
	const afterGuard = {
		...focusGuardProps(onAfterGuardFocus, { "data-type": "inside" }),
		[createAttachmentKey()]: attachRef<HTMLElement>(setAfterGuard),
	};

	// Whether focus moving to `relatedTarget` left the popup's tree: its trigger, popup, portal,
	// inside elements, other triggers, its guards, or a nested or parent popup.
	function movedToUnrelatedNode(
		relatedTarget: HTMLElement | null,
		positioner: HTMLElement | null,
		anchor: Element | null,
	) {
		const nodeId = popup.nodeId;
		const tree = popup.tree;
		const isRelatedFocusGuard =
			relatedTarget?.hasAttribute(FOCUS_GUARD_ATTRIBUTE) &&
			[
				beforeGuardElement,
				afterGuardElement,
				portal?.beforeInsideGuard,
				portal?.afterInsideGuard,
				portal?.beforeOutsideGuard,
				portal?.afterOutsideGuard,
				previousFocusable(),
				nextFocusable(),
			].includes(relatedTarget);
		return !(
			contains(anchor, relatedTarget) ||
			contains(positioner, relatedTarget) ||
			contains(relatedTarget, positioner) ||
			contains(portal?.portalNode, relatedTarget) ||
			insideElements().some(
				(element) => element === relatedTarget || contains(element, relatedTarget),
			) ||
			popup.triggers.hasMatchingElement((trigger) => contains(trigger, relatedTarget)) ||
			isRelatedFocusGuard ||
			(tree &&
				(tree
					.children(nodeId)
					.find(
						(node) =>
							contains(node.context?.positionerElement, relatedTarget) ||
							contains(node.context?.anchorElement, relatedTarget),
					) ||
					tree
						.ancestors(nodeId)
						.find(
							(node) =>
								[
									node.context?.positionerElement,
									getPopupFocusElement(
										node.context?.positionerElement as HTMLElement | null | undefined,
									),
								].includes(relatedTarget) || node.context?.anchorElement === relatedTarget,
						)))
		);
	}

	/** Everything outside the popup's tree, marked. Runs after the flush, untracked. */
	function hideOutside(
		positioner: Element,
		isModal: boolean,
		anchor: Element | null,
		untrapped: boolean,
		portalNode: HTMLElement | null | undefined,
	): OutsideMarking {
		const tree = popup.tree;
		const ancestors = tree ? tree.ancestors(popup.nodeId) : [];
		const rootAncestorComboboxAnchor = ancestors.find((node) =>
			isTypeableCombobox(node.context?.anchorElement || null),
		)?.context?.anchorElement;
		const exposed = [
			beforeGuardElement,
			afterGuardElement,
			portal?.beforeOutsideGuard,
			portal?.afterOutsideGuard,
			...insideElements(),
			rootAncestorComboboxAnchor,
			previousFocusable(),
			nextFocusable(),
			untrapped ? anchor : null,
		].filter((element): element is Element => element != null);
		return markOutside(positioner, { portalNode, exposed, ariaHidden: isModal || untrapped });
	}

	/** Lifetime work: every effect of the manager, in a fixed order. */
	function startEffects(): void {
		// Tab can't escape a modal popup without tabbable content.
		$effect(() => {
			if (disabled || !modal) {
				return;
			}
			const focusElement = popupFocusElement;
			const untrapped = untrappedCombobox;
			const doc = ownerDocument(focusElement);
			const onKeyDown = (event: KeyboardEvent) => {
				if (
					event.key === "Tab" &&
					contains(focusElement, activeElement(ownerDocument(focusElement))) &&
					tabbableContent().length === 0 &&
					!untrapped
				) {
					stopEvent(event);
				}
			};
			doc.addEventListener("keydown", onKeyDown);
			return () => doc.removeEventListener("keydown", onKeyDown);
		});

		// Pointer and keyboard tracking, to tell focus moves and outside presses apart.
		$effect(() => {
			if (disabled || !popup.open) {
				return;
			}
			const positioner = popup.positionerElement as HTMLElement | null;
			const anchor = popup.anchorElement;
			const doc = ownerDocument(popupFocusElement);
			const clearPointerDownOutside = () => {
				pointerDownOutside = false;
			};
			const onPointerDown = (event: PointerEvent) => {
				const target = getTarget(event) as Element | null;
				const pointerTargetInside =
					contains(positioner, target) ||
					contains(anchor, target) ||
					contains(portal?.portalNode, target) ||
					insideElements().some((element) => element === target || contains(element, target));
				pointerDownOutside = !pointerTargetInside;
				lastInteractionType = (event.pointerType as InteractionType) || "keyboard";
				if (closest(target, `[${CLICK_TRIGGER_IDENTIFIER}]`)) {
					markPointerDown();
				}
			};
			const onKeyDown = () => {
				lastInteractionType = "keyboard";
			};
			doc.addEventListener("pointerdown", onPointerDown, true);
			doc.addEventListener("pointerup", clearPointerDownOutside, true);
			doc.addEventListener("pointercancel", clearPointerDownOutside, true);
			doc.addEventListener("keydown", onKeyDown, true);
			return () => {
				doc.removeEventListener("pointerdown", onPointerDown, true);
				doc.removeEventListener("pointerup", clearPointerDownOutside, true);
				doc.removeEventListener("pointercancel", clearPointerDownOutside, true);
				doc.removeEventListener("keydown", onKeyDown, true);
				clearPointerDownOutside();
			};
		});

		// Closes on focus out, and keeps focus inside the popup when its focused element
		// disappears.
		$effect(() => {
			if (disabled) {
				return;
			}
			const positioner = popup.positionerElement as HTMLElement | null;
			const anchor = popup.anchorElement;
			const focusElement = popupFocusElement;
			const isModal = modal;
			const restore = restoreFocus;
			const untrapped = untrappedCombobox;
			const doc = ownerDocument(focusElement);

			const handleFocusIn = (event: FocusEvent) => {
				const target = getTarget(event) as Element | null;
				if (isTabbable(target)) {
					lastFocusedTabbable = target as FocusableElement;
				}
			};
			// The focused element disappeared: keep focus in the popup.
			const restoreFocusInside = () => {
				if (isHTMLElement(focusElement)) {
					focusElement.focus();
					if (restore === "popup") {
						// An element removed on pointerdown steals the focus back; refocus next frame, but
						// only if focus is still lost: where the app or the user moved it meanwhile, it stays.
						cancelRestoreFocus?.();
						cancelRestoreFocus = webScheduler.frame(() => {
							const focused = activeElement(doc);
							if (!focused || focused === doc.body) {
								focusElement.focus();
							}
						});
						return;
					}
				}
				const content = tabbableContent() as (Element | null)[];
				const previous = lastFocusedTabbable;
				const nodeToFocus =
					(previous && content.includes(previous) ? previous : null) ||
					content[content.length - 1] ||
					focusElement;
				if (isHTMLElement(nodeToFocus)) {
					nodeToFocus.focus();
				}
			};
			const handleFocusOutside = (event: FocusEvent) => {
				const relatedTarget = event.relatedTarget as HTMLElement | null;
				const currentTarget = event.currentTarget;
				const target = getTarget(event) as HTMLElement | null;
				// Focus lost to the body (a backdrop press): remember where it was, for a later dialog.
				if (isModal && relatedTarget == null && target != null && contains(positioner, target)) {
					addPreviouslyFocusedElement(target);
				}
				webScheduler.microtask(() => {
					const movedOut = movedToUnrelatedNode(relatedTarget, positioner, anchor);
					if (currentTarget === anchor && focusElement) {
						handleTabIndex(focusElement);
					}
					if (
						restore &&
						currentTarget !== anchor &&
						!isElementVisible(target) &&
						activeElement(doc) === doc.body
					) {
						restoreFocusInside();
						if (restore === "popup" && isHTMLElement(focusElement)) {
							return;
						}
					}
					if (popup.dismiss.insideTree) {
						popup.dismiss.leaveInside();
						return;
					}
					// Focus left the popup tree, and no portal guard handles closing.
					if (
						(untrapped ? true : !isModal) &&
						relatedTarget &&
						movedOut &&
						!isPointerDown &&
						(untrapped || relatedTarget !== getPreviouslyFocusedElement())
					) {
						preventReturnFocus = true;
						// A popup that closed meanwhile, or is closed and still mounted, reports no close.
						if (popup.open) {
							setOpen(false, event);
						}
					}
				});
			};
			const markInsideTree = () => {
				if (pointerDownOutside) {
					return;
				}
				popup.dismiss.enterInside();
				blurTimeout.start(0, () => {
					popup.dismiss.leaveInside();
				});
			};

			const anchorElement = isHTMLElement(anchor) ? anchor : null;
			if (!positioner && !anchorElement) {
				return;
			}
			anchorElement?.addEventListener("focusout", handleFocusOutside);
			// In Safari, buttons lose focus when pressed.
			anchorElement?.addEventListener("pointerdown", markPointerDown);
			positioner?.addEventListener("focusin", handleFocusIn);
			positioner?.addEventListener("focusout", handleFocusOutside);
			if (positioner && portal) {
				positioner.addEventListener("focusout", markInsideTree, true);
			}
			return () => {
				anchorElement?.removeEventListener("focusout", handleFocusOutside);
				anchorElement?.removeEventListener("pointerdown", markPointerDown);
				positioner?.removeEventListener("focusin", handleFocusIn);
				positioner?.removeEventListener("focusout", handleFocusOutside);
				positioner?.removeEventListener("focusout", markInsideTree, true);
				cancelRestoreFocus?.();
			};
		});

		// The pointer and blur timers never outlive the Popup.
		$effect(() => () => {
			blurTimeout.clear();
			pointerDownTimeout.clear();
		});

		// Hides everything outside the popup tree while open. The marking reads the whole
		// document and elements other components register, so it runs after the flush: every portal
		// placed in this update is in its container by then.
		$effect(() => {
			const positioner = popup.positionerElement;
			if (disabled || !positioner || !popup.open) {
				return;
			}
			const isModal = modal;
			const anchor = popup.anchorElement;
			const untrapped = untrappedCombobox;
			const portalNode = portal?.portalNode;
			const doc = ownerDocument(positioner);
			let marking: OutsideMarking | undefined;
			// Focus can land in another popup's portal after the marking (an unrelated popup opened in
			// the same update takes focus in its own effect, or moves to another container): hide again
			// around the portal that now holds it. The inert marker stays as first applied.
			const onFocusIn = () => {
				const focused = focusedOtherPortal(positioner);
				if (marking && focused && focused !== marking.exempt) {
					marking.hideAround(focused);
				}
			};
			const cancel = webScheduler.microtask(() => {
				marking = untrack(() => hideOutside(positioner, isModal, anchor, untrapped, portalNode));
			});
			doc.addEventListener("focusin", onFocusIn, true);
			return () => {
				cancel();
				doc.removeEventListener("focusin", onFocusIn, true);
				marking?.undo();
			};
		});

		// Focuses the initial element when the popup opens: the `initialFocus` target, else the
		// first tabbable element, else the popup.
		$effect(() => {
			const focusElement = popupFocusElement;
			if (!popup.open || disabled || !isHTMLElement(focusElement)) {
				return;
			}
			untrack(() => {
				closeType = "";
				lastInteractionType = "";
				const doc = ownerDocument(focusElement);
				const previouslyFocused = activeElement(doc);
				// Wait for Svelte's pending updates to land: the tabindex updates, and content behind a
				// `<svelte:boundary>` whose `await` has already resolved (Svelte 5.59 renders it after the
				// open's own microtasks). Content still loading is not waited for.
				void tick().then(() => {
					const current = options();
					const value = current.initialFocus ?? true;
					const resolved =
						typeof value === "function" ? value(current.openInteractionType || "") : value;
					if (resolved === undefined || resolved === false) {
						return;
					}
					if (contains(focusElement, previouslyFocused)) {
						return;
					}
					let focusableElements: FocusableElement[] | null = null;
					const getDefaultFocusElement = () => {
						focusableElements ??= tabbableContent(focusElement);
						return focusableElements[0] || focusElement;
					};
					let elementToFocus: FocusableElement | null | undefined =
						resolved === true || resolved === null
							? getDefaultFocusElement()
							: resolveTarget(resolved);
					elementToFocus = elementToFocus || getDefaultFocusElement();
					const hadFocusInside = contains(focusElement, activeElement(doc));
					// A screen reader re-syncs focus right after a synthesized press: focus synchronously.
					const openEvent = popup.openEvent;
					const openedByVirtualPress =
						openEvent?.type === "mousedown" && isVirtualClick(openEvent as MouseEvent);
					const focusInitial = (target: FocusableElement, sync: boolean) => {
						enqueueFocus(target, {
							sync,
							preventScroll: target === focusElement,
							shouldFocus() {
								// Closed meanwhile (tabbing out of a kept-mounted popup): don't pull focus back.
								if (!popup.open) {
									return false;
								}
								// Still off the document when the focus lands, like an empty ref: the default
								// element takes focus instead. Content pending behind a `<svelte:boundary>`
								// already exists, off the document, until it resolves.
								if (!target.isConnected) {
									focusableElements = null;
									const fallback = getDefaultFocusElement();
									if (fallback.isConnected) {
										focusInitial(fallback, true);
									}
									return false;
								}
								if (hadFocusInside) {
									return true;
								}
								const focused = activeElement(doc);
								return !(focused !== target && contains(focusElement, focused));
							},
						});
					};
					focusInitial(elementToFocus, openedByVirtualPress);
				});
			});
		});

		// What the options say while the popup is mounted, kept as plain values for the close's
		// teardown: a teardown read of state derived from an unbound `$bindable` `open`, in the flush
		// that wrote it, leaves that state stale (sveltejs/svelte#19099), and a return target may read
		// the active trigger. A teardown saw the values from before the flush anyway, which are the
		// last ones read while mounted.
		let returnFocus = untrack(() => returnFocusOption);
		// Copies the return-focus options before the DOM updates, while mounted.
		$effect.pre(() => {
			if (!popup.mounted) {
				return;
			}
			returnFocus = returnFocusOption;
		});

		// Remembers where focus was before the popup opened and returns it on close.
		$effect(() => {
			const focusElement = popupFocusElement;
			const positioner = popup.positionerElement;
			const anchor = popup.anchorElement;
			if (disabled || !focusElement) {
				pendingReturnFocus = null;
				return;
			}
			return untrack(() => {
				if (pendingReturnFocus) {
					// Re-armed in the same flush: a dependency changed while open, not a close.
					pendingReturnFocus.cancelled = true;
					pendingReturnFocus = null;
				}
				const doc = ownerDocument(focusElement);
				const elementFocusedBeforeOpen = activeElement(doc);
				// Only an explicit `null` interaction type is a programmatic open.
				const preferPreviousFocus = options().openInteractionType == null;
				// A press leaves a button without focus in some browsers. The trigger is remembered
				// then, so a popup opened from inside this one can still return focus to it.
				const pressedWithoutFocus =
					!preferPreviousFocus &&
					anchor != null &&
					(!elementFocusedBeforeOpen || getNodeName(elementFocusedBeforeOpen) === "body");
				addPreviouslyFocusedElement(pressedWithoutFocus ? anchor : elementFocusedBeforeOpen);

				const onOpenChange = (details: OpenChangeDetails<WebTypes>) => {
					if (!details.open) {
						closeType = getEventType(details.event, lastInteractionType);
					}
					// Focus guards move focus themselves; a hover-out never returns focus.
					if (
						(details.reason === REASONS.focusOut &&
							details.trigger?.hasAttribute(FOCUS_GUARD_ATTRIBUTE)) ||
						(details.reason === REASONS.triggerHover && details.event.type === "mouseleave")
					) {
						preventReturnFocus = true;
					}
					if (details.reason !== REASONS.outsidePress) {
						return;
					}
					if (details.nested) {
						preventReturnFocus = false;
					} else if (
						isVirtualClick(details.event as MouseEvent) ||
						isVirtualPointerEvent(details.event as PointerEvent)
					) {
						preventReturnFocus = false;
					} else {
						preventReturnFocus = !isPreventScrollSupported(ownerDocument(focusElement));
					}
				};
				popup.events.on("openchange", onOpenChange);

				const getReturnElement = (type: InteractionType) => {
					const value = returnFocus ?? true;
					let resolved = typeof value === "function" ? value(type) : value;
					if (resolved === undefined || resolved === false) {
						return null;
					}
					if (resolved === null) {
						resolved = true;
					}
					const anchorReturn = anchor?.isConnected ? anchor : null;
					const previousReturn =
						elementFocusedBeforeOpen?.isConnected &&
						getNodeName(elementFocusedBeforeOpen) !== "body"
							? elementFocusedBeforeOpen
							: null;
					let defaultReturn = preferPreviousFocus
						? previousReturn || anchorReturn
						: anchorReturn || previousReturn;
					if (!defaultReturn) {
						defaultReturn = getPreviouslyFocusedElement() || null;
					}
					if (typeof resolved === "boolean") {
						return defaultReturn;
					}
					return resolveTarget(resolved) || defaultReturn || null;
				};

				return () => {
					popup.events.off("openchange", onOpenChange);
					const activeEl = activeElement(doc);
					const tree = popup.tree;
					const isFocusInsidePopupTree =
						contains(positioner, activeEl) ||
						insideElements().some(
							(element) => element === activeEl || contains(element, activeEl),
						) ||
						(tree != null &&
							tree
								.children(popup.nodeId, false)
								.some((node) => contains(node.context?.positionerElement, activeEl)));
					const returnValue = returnFocus ?? true;
					const type = closeType;
					// Resolved now: the return target and the anchor's connection are read while the
					// popup is still in the DOM.
					const returnElement = getReturnElement(type);
					const job = { cancelled: false };
					pendingReturnFocus = job;
					webScheduler.microtask(() => {
						if (pendingReturnFocus === job) {
							pendingReturnFocus = null;
						}
						const tabbableReturnElement = getFirstTabbableElement(returnElement);
						const hasExplicitReturnFocus = typeof returnValue !== "boolean";
						if (
							!job.cancelled &&
							returnValue &&
							!preventReturnFocus &&
							isHTMLElement(tabbableReturnElement) &&
							// Focus that moved elsewhere after opening is respected.
							(!hasExplicitReturnFocus &&
							tabbableReturnElement !== activeEl &&
							activeEl !== doc.body
								? isFocusInsidePopupTree
								: true)
						) {
							const focusOptions: FocusOptions & { focusVisible?: boolean } = {
								preventScroll: true,
							};
							if (type === "keyboard") {
								focusOptions.focusVisible = true;
							}
							tabbableReturnElement.focus(focusOptions);
							// A target in the document can still be hidden, as a control of a closed popup
							// that stays mounted is, and focusing it does nothing: focus then goes to the
							// newest element focused before a popup opened that can take it, unless it has
							// moved on since the close.
							const focused = activeElement(doc);
							if (
								focused !== tabbableReturnElement &&
								!isElementVisible(tabbableReturnElement) &&
								(!focused || focused === doc.body || contains(positioner, focused))
							) {
								const fallback = getFirstTabbableElement(
									getFocusablePreviouslyFocusedElement() ?? null,
								);
								if (isHTMLElement(fallback)) {
									fallback.focus(focusOptions);
								}
							}
						}
						// A cancelled return must also clear suppression before the next close.
						preventReturnFocus = false;
					});
				};
			});
		});

		// WORKAROUND(safari): Safari may scroll to the bottom if an input inside unmounts focused, so
		// it is blurred first. Remove when Safari keeps the scroll position.
		$effect(() => {
			const positioner = popup.positionerElement;
			if (!userAgent.engine.webkit || popup.open || !positioner) {
				return;
			}
			const activeEl = activeElement(ownerDocument(positioner));
			if (
				isHTMLElement(activeEl) &&
				activeEl.matches(TYPEABLE_SELECTOR) &&
				contains(positioner, activeEl)
			) {
				activeEl.blur();
			}
		});

		// Tells the portal whether to render its own guards.
		$effect(() => {
			if (disabled || !portal) {
				return;
			}
			portal.setFocusManagerState({
				modal,
				open: popup.open,
				anchorElement: popup.anchorElement,
				onOpenChange: (open, event) => setOpen(open, event as FocusEvent),
			});
			return () => {
				portal.setFocusManagerState(null);
			};
		});

		// Keeps the popup's tabindex in step with its content.
		$effect(() => {
			const focusElement = popupFocusElement;
			if (disabled || !focusElement) {
				return;
			}
			untrack(() => handleTabIndex(focusElement));
			return () => {
				webScheduler.microtask(clearDisconnectedPreviouslyFocusedElements);
			};
		});
	}

	startEffects();
	return {
		get renderGuards() {
			return renderGuards;
		},
		beforeGuard,
		afterGuard,
	};
}
