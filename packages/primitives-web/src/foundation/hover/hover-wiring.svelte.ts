import {
	HoverPopupIntent,
	HoverTriggerIntent,
	type HoverTriggerTarget,
	type SafePolygonSession,
} from "@sohedra/primitives-core/foundation/hover/index.js";
import type { OpenChangeDetails } from "@sohedra/primitives-core/foundation/popup/index.js";
import { flushSync, untrack } from "svelte";

import {
	closest,
	contains,
	getInteractionEventType,
	getPointerType,
	getTarget,
	isElement,
	ownerDocument,
	TYPEABLE_SELECTOR,
	type WebTypes,
} from "../kernel/index.js";
import { blockPointerEventsOverTrigger, usePointerBlock } from "./hover-pointer-block.svelte.js";
import type {
	HoverPopupOptions,
	HoverPopupView,
	HoverTrigger,
	HoverTriggerOptions,
} from "./hover-types.js";

/** Whether `target` is in a registered trigger that isn't disabled. */
export function isInsideEnabledTrigger(
	target: EventTarget | null,
	triggers: HoverPopupView["triggers"],
): boolean {
	if (!isElement(target)) {
		return false;
	}
	if (triggers.hasElement(target)) {
		return !target.hasAttribute("data-trigger-disabled");
	}
	for (const [, trigger] of triggers.entries()) {
		if (contains(trigger, target)) {
			return !trigger.hasAttribute("data-trigger-disabled");
		}
	}
	return false;
}

const INTERACTIVE_SELECTOR = `button,a[href],[role="button"],select,[tabindex]:not([tabindex="-1"]),${TYPEABLE_SELECTOR}`;

/** Whether `element` is (inside) something a press activates or types into. */
export function isInteractiveElement(element: Element | null): boolean {
	return closest(element, INTERACTIVE_SELECTOR) != null;
}

/** Whether `currentTarget` (or `target` in it) is a registered trigger other than the reference. */
function isOverInactiveTrigger(
	popup: HoverPopupView,
	currentDomReference: Element | null,
	currentTarget: Element,
	target: EventTarget | null,
) {
	if (popup.triggers.hasElement(currentTarget)) {
		return !currentDomReference || !contains(currentDomReference, currentTarget);
	}
	if (!isElement(target)) {
		return false;
	}
	return (
		popup.triggers.hasMatchingElement((trigger) => contains(trigger, target)) &&
		(!currentDomReference || !contains(currentDomReference, target))
	);
}

/** The trigger the pointer is over: the registered one containing the target, or the reference. */
function resolveTarget(popup: HoverPopupView, event: MouseEvent): HoverTriggerTarget<WebTypes> {
	const eventTarget = getTarget(event);
	const currentTarget = event.currentTarget as Element;
	const currentDomReference = popup.anchorElement;
	let trigger: Element = currentTarget;
	// Wrapper or delegated listeners: resolve the trigger from the target.
	if (isElement(eventTarget) && !popup.triggers.hasElement(eventTarget)) {
		for (const element of popup.triggers.elements()) {
			if (contains(element, eventTarget)) {
				trigger = element;
				break;
			}
		}
	}
	if (
		isElement(currentTarget) &&
		isElement(currentDomReference) &&
		!popup.triggers.hasElement(currentTarget) &&
		contains(currentTarget, currentDomReference)
	) {
		trigger = currentDomReference;
	}
	return {
		trigger,
		eventType: getInteractionEventType(event),
		overInactiveTrigger: isOverInactiveTrigger(popup, currentDomReference, trigger, eventTarget),
		withinReference: isElement(currentDomReference) && contains(currentDomReference, trigger),
	};
}

/**
 * Feeds document `mousemove`s (and the `mouseleave` that started it) to a safe-polygon session,
 * measuring the trigger and popup on demand.
 */
function trackSafePolygon(
	popup: HoverPopupView,
	session: SafePolygonSession<WebTypes>,
	leave: MouseEvent,
) {
	const doc = ownerDocument(popup.anchorElement);
	const handler = (event: MouseEvent) => {
		const domReference = popup.anchorElement;
		const floating = popup.floatingElement as HTMLElement | null;
		if (!domReference || !floating) {
			session.move(null);
			return;
		}
		const target = getTarget(event) as Element | null;
		const isLeave = event.type === "mouseleave";
		session.move({
			clientX: event.clientX,
			clientY: event.clientY,
			isLeave,
			isOverFloating: contains(floating, target),
			isOverReference: contains(domReference, target),
			leavingIntoFloating:
				isLeave && isElement(event.relatedTarget) && contains(floating, event.relatedTarget),
			measure: () => ({
				reference: domReference.getBoundingClientRect(),
				floating: floating.getBoundingClientRect(),
			}),
		});
	};
	popup.hover.setCloseTracker({
		handler,
		dispose() {
			doc.removeEventListener("mousemove", handler);
			session.dispose();
		},
	});
	doc.addEventListener("mousemove", handler);
	handler(leave);
}

/**
 * The trigger side of a popup's hover: forwards the trigger's pointer events, with what they
 * hit, to the popup's hover intent, which decides whether the popup opens or closes.
 *
 * `popup` is what the behaviour reads of the popup (its store satisfies the view as it is); it is
 * a function because a trigger attached through a handle can be given another popup. `options`
 * returns the trigger's hover options as a plain object and is called whenever one is needed, so
 * every option stays live. It installs the listeners when called, once, while the trigger part
 * initialises; `props` go on the trigger's element.
 */
export function useHoverTrigger(
	popup: () => HoverPopupView,
	options: () => HoverTriggerOptions,
): HoverTrigger {
	const intent = new HoverTriggerIntent<WebTypes>(popup, options, flushSync);

	// Value-compared views of the options an effect depends on: the effect re-runs when the value
	// changes, not when any signal the options object reads does.
	const enabled = $derived(options().enabled);
	const isActiveTrigger = $derived(options().isActiveTrigger);
	const triggerElement = $derived(options().triggerElement);
	const move = $derived(options().move === true);
	const guardStaleOpen = $derived(options().guardStaleOpen === true);

	function startEffects(): void {
		// Follows the popup's open changes while enabled: a close cancels this trigger's pending
		// delays and the safe polygon.
		$effect(() => {
			if (!enabled) {
				return;
			}
			const view = popup();
			const onOpenChange = (details: OpenChangeDetails<WebTypes>) => intent.openChanged(details);
			view.events.on("openchange", onOpenChange);
			return () => view.events.off("openchange", onOpenChange);
		});

		// The pointer entering and leaving the trigger, on the element itself: neither event
		// bubbles.
		$effect(() => {
			const view = popup();
			const trigger = triggerElement ?? (isActiveTrigger ? view.anchorElement : null);
			if (!enabled || !isElement(trigger)) {
				return;
			}
			// The trigger the leave handler names is the one this listener was installed for.
			const ownTrigger = triggerElement;
			function onMouseEnter(event: MouseEvent) {
				intent.enter(event, resolveTarget(view, event));
			}
			function onMouseLeave(event: MouseEvent) {
				const session = intent.leave(event, {
					trigger: ownTrigger,
					side: options().safePolygonSide?.(trigger as Element),
					intoEnabledTrigger: isInsideEnabledTrigger(event.relatedTarget, view.triggers),
					intoFloating: contains(view.floatingElement, event.relatedTarget as Element | null),
					clientX: event.clientX,
					clientY: event.clientY,
				});
				if (session) {
					trackSafePolygon(view, session, event);
				}
			}
			// A backup for a `mouseleave` Chrome drops during a fast sweep: cancel the pending open.
			function onMouseOut(event: MouseEvent) {
				if (!contains(trigger, event.relatedTarget as Element | null)) {
					intent.pointerOut();
				}
			}
			const opensOnMove = move;
			const guardsStaleOpen = guardStaleOpen;
			trigger.addEventListener("mouseenter", onMouseEnter as EventListener);
			trigger.addEventListener("mouseleave", onMouseLeave as EventListener);
			if (opensOnMove) {
				trigger.addEventListener("mousemove", onMouseEnter as EventListener, { once: true });
			}
			if (guardsStaleOpen) {
				trigger.addEventListener("mouseout", onMouseOut as EventListener);
			}
			return () => {
				trigger.removeEventListener("mouseenter", onMouseEnter as EventListener);
				trigger.removeEventListener("mouseleave", onMouseLeave as EventListener);
				if (opensOnMove) {
					trigger.removeEventListener("mousemove", onMouseEnter as EventListener);
				}
				if (guardsStaleOpen) {
					trigger.removeEventListener("mouseout", onMouseOut as EventListener);
				}
			};
		});

		// The popup's hover timers and safe polygon never outlive a trigger.
		$effect(() => () => untrack(popup).hover.dispose());
	}

	function setPointerType(event: PointerEvent) {
		intent.pointerType(getPointerType(event));
	}

	startEffects();
	return {
		props: {
			onpointerdown: setPointerType,
			onpointerenter: setPointerType,
			onmousemove(event: MouseEvent) {
				if (!options().enabled) {
					return;
				}
				const view = popup();
				const trigger = event.currentTarget as Element;
				const overInactiveTrigger = isOverInactiveTrigger(
					view,
					view.anchorElement,
					trigger,
					event.target,
				);
				// Another trigger of a popup that blocks pointer input: only it and the popup take input.
				if (overInactiveTrigger) {
					blockPointerEventsOverTrigger(view, trigger as HTMLElement, options().mouseOnly);
				}
				intent.move(
					event,
					{
						trigger,
						eventType: getInteractionEventType(event),
						overInactiveTrigger,
					},
					event.movementX,
					event.movementY,
				);
			},
		},
	};
}

/**
 * The popup side of a popup's hover: keeps a hover-opened popup open while the pointer is over
 * it, and closes it when the pointer leaves. Call once, while the Popup part initialises.
 *
 * `popup` is what the behaviour reads of the popup (its store satisfies the view as it is);
 * `options` returns the Popup's hover options as a plain object.
 */
export function useHoverPopup(popup: HoverPopupView, options: () => HoverPopupOptions): void {
	const intent = new HoverPopupIntent<WebTypes>(popup, options, flushSync);

	// Value-compared: the listeners are installed again only when this changes.
	const enabled = $derived(options().enabled);

	// The pointer entering, leaving and pressing inside the popup's positioned element.
	$effect(() => {
		const floating = popup.floatingElement as HTMLElement | null;
		if (!enabled || !floating) {
			return;
		}
		const tree = popup.tree;

		function onInteractInside(event: PointerEvent) {
			const target = getTarget(event) as Element | null;
			const interactive = isInteractiveElement(target);
			intent.pressInside(interactive, interactive && closest(target, "[aria-haspopup]") != null);
		}

		function onMouseLeave(event: MouseEvent) {
			const relatedTarget = event.relatedTarget;
			intent.leave(event, {
				enabledTrigger: isInsideEnabledTrigger(relatedTarget, popup.triggers),
				descendant: Boolean(
					tree &&
					isElement(relatedTarget) &&
					tree
						.children(popup.data.nodeId, false)
						.some((node) => contains(node.context?.floatingElement, relatedTarget)),
				),
			});
		}

		const onMouseEnter = () => intent.enter();
		floating.addEventListener("mouseenter", onMouseEnter);
		floating.addEventListener("mouseleave", onMouseLeave);
		floating.addEventListener("pointerdown", onInteractInside, true);
		return () => {
			floating.removeEventListener("mouseenter", onMouseEnter);
			floating.removeEventListener("mouseleave", onMouseLeave);
			floating.removeEventListener("pointerdown", onInteractInside, true);
			intent.dispose();
		};
	});

	// While a hover opened it, only the popup and its trigger take pointer input around it.
	usePointerBlock(
		popup,
		() => enabled,
		() => options().pointerBlockScope?.() ?? null,
	);

	// The popup's hover timers, safe polygon and pointer block never outlive the Popup.
	$effect(() => () => popup.hover.dispose());
}
