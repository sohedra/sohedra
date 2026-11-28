import {
	type HoverTriggerTarget,
	HoverTriggerStore,
	type SafePolygonSession,
} from "@sohedra/primitives-core/foundation/hover";
import type { OpenChangeDetails, PopupView } from "@sohedra/primitives-core/foundation/popup";
import { flushSync } from "svelte";
import { on } from "svelte/events";

import {
	contains,
	getInteractionEventType,
	getPointerType,
	getTarget,
	isElement,
	ownerDocument,
	type WebTypes,
} from "../kernel/index.js";
import type { HoverTrigger, HoverTriggerOptions } from "./hover-types.js";

/** Whether `target` is in a registered trigger. */
export function isInsideEnabledTrigger(
	target: EventTarget | null,
	triggers: PopupView<WebTypes>["triggers"],
): boolean {
	if (!isElement(target)) {
		return false;
	}
	if (triggers.hasElement(target)) {
		return true;
	}
	for (const [, trigger] of triggers.entries()) {
		if (contains(trigger, target)) {
			return true;
		}
	}
	return false;
}

/** Whether `currentTarget` (or `target` in it) is a registered trigger other than the anchor. */
function isOverInactiveTrigger(
	popup: PopupView<WebTypes>,
	anchorElement: Element | null,
	currentTarget: Element,
	target: EventTarget | null,
) {
	if (popup.triggers.hasElement(currentTarget)) {
		return !anchorElement || !contains(anchorElement, currentTarget);
	}
	if (!isElement(target)) {
		return false;
	}
	return (
		popup.triggers.hasMatchingElement((trigger) => contains(trigger, target)) &&
		(!anchorElement || !contains(anchorElement, target))
	);
}

/** The trigger the pointer is over: the registered one containing the target, or the anchor. */
function resolveTarget(
	popup: PopupView<WebTypes>,
	event: MouseEvent,
): HoverTriggerTarget<WebTypes> {
	const eventTarget = getTarget(event);
	const currentTarget = event.currentTarget as Element;
	const anchorElement = popup.anchorElement;
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
		isElement(anchorElement) &&
		!popup.triggers.hasElement(currentTarget) &&
		contains(currentTarget, anchorElement)
	) {
		trigger = anchorElement;
	}
	return {
		trigger,
		eventType: getInteractionEventType(event),
		overInactiveTrigger: isOverInactiveTrigger(popup, anchorElement, trigger, eventTarget),
		withinAnchor: isElement(anchorElement) && contains(anchorElement, trigger),
	};
}

/**
 * Feeds document `mousemove`s (and the `mouseleave` that started it) to a safe-polygon session,
 * measuring the trigger and popup on demand.
 */
function trackSafePolygon(
	popup: PopupView<WebTypes>,
	session: SafePolygonSession<WebTypes>,
	leave: MouseEvent,
) {
	const doc = ownerDocument(popup.anchorElement);
	const handler = (event: MouseEvent) => {
		const anchor = popup.anchorElement;
		const positioner = popup.positionerElement as HTMLElement | null;
		if (!anchor || !positioner) {
			session.move(null);
			return;
		}
		const target = getTarget(event) as Element | null;
		const isLeave = event.type === "mouseleave";
		session.move({
			clientX: event.clientX,
			clientY: event.clientY,
			isLeave,
			isOverPopup: contains(positioner, target),
			isOverAnchor: contains(anchor, target),
			leavingIntoPopup:
				isLeave && isElement(event.relatedTarget) && contains(positioner, event.relatedTarget),
			measure: () => ({
				anchor: anchor.getBoundingClientRect(),
				popup: positioner.getBoundingClientRect(),
			}),
		});
	};
	let off = () => {};
	popup.hover.setCloseTracker({
		handler,
		stop() {
			off();
			session.stop();
		},
	});
	off = on(doc, "mousemove", handler);
	handler(leave);
}

/**
 * The trigger side of a popup's hover: forwards the trigger's pointer events, with what they
 * hit, to the popup's hover store, which decides whether the popup opens or closes.
 *
 * `options` returns the trigger's hover options as a plain object and is called whenever one is
 * needed, so every option stays live. Its `popup` is the popup the trigger reads now: a trigger
 * attached through a handle can be given another popup. It installs the listeners when called,
 * once, while the trigger part initialises; `props` go on the trigger's element.
 */
export function useHoverTrigger(options: () => HoverTriggerOptions): HoverTrigger {
	// Value-compared views of the options an effect depends on: the effect re-runs when the value
	// changes, not when any signal the options object reads does.
	const popup = $derived(options().popup);
	const hover = new HoverTriggerStore<WebTypes>(options, {
		popup: () => popup,
		flush: flushSync,
	});
	const enabled = $derived(options().enabled);
	const isActiveTrigger = $derived(options().isActiveTrigger);
	const triggerElement = $derived(options().triggerElement);

	function startEffects(): void {
		// Follows the popup's open changes while enabled: a close cancels this trigger's pending
		// delays and the safe polygon.
		$effect(() => {
			if (!enabled) {
				return;
			}
			const view = popup;
			const onOpenChange = (details: OpenChangeDetails<WebTypes>) => hover.openChanged(details);
			view.events.on("openchange", onOpenChange);
			return () => view.events.off("openchange", onOpenChange);
		});

		// The pointer entering and leaving the trigger, on the element itself: neither event
		// bubbles.
		$effect(() => {
			const view = popup;
			const trigger = triggerElement ?? (isActiveTrigger ? view.anchorElement : null);
			if (!enabled || !isElement(trigger)) {
				return;
			}
			// The trigger the leave handler names is the one this listener was installed for.
			const ownTrigger = triggerElement;
			function onMouseEnter(event: MouseEvent) {
				hover.enter(event, resolveTarget(view, event));
			}
			function onMouseLeave(event: MouseEvent) {
				const session = hover.leave(event, {
					trigger: ownTrigger,
					intoEnabledTrigger: isInsideEnabledTrigger(event.relatedTarget, view.triggers),
					intoPopup: contains(view.positionerElement, event.relatedTarget as Element | null),
					clientX: event.clientX,
					clientY: event.clientY,
				});
				if (session) {
					trackSafePolygon(view, session, event);
				}
			}
			// A store's element is an `Element` on the web; the trigger is an HTML element.
			const target = trigger as HTMLElement;
			const offs = [on(target, "mouseenter", onMouseEnter), on(target, "mouseleave", onMouseLeave)];
			return () => {
				for (const off of offs) {
					off();
				}
			};
		});
	}

	function setPointerType(event: PointerEvent) {
		hover.pointerType(getPointerType(event));
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
				const view = popup;
				const trigger = event.currentTarget as Element;
				hover.move(
					event,
					{
						trigger,
						eventType: getInteractionEventType(event),
						overInactiveTrigger: isOverInactiveTrigger(
							view,
							view.anchorElement,
							trigger,
							event.target,
						),
					},
					event.movementX,
					event.movementY,
				);
			},
		},
	};
}
