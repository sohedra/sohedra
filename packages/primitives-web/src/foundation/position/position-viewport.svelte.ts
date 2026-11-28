import { watch } from "@sohedra/primitives-core/foundation/kernel/index.js";
import type { PopupView } from "@sohedra/primitives-core/foundation/popup/index.js";
import {
	pinnedEdges,
	type Side,
	type TriggerOffset,
	ViewportContentStore,
} from "@sohedra/primitives-core/foundation/position/index.js";
import { flushSync, untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

import {
	attachmentProps,
	DirectionContext,
	LTR,
	ownerDocument,
	webScheduler,
	type WebTypes,
} from "../kernel/index.js";
import { PopupLayoutContext } from "../popup/index.js";
import { TransitionStatusDataAttributes, waitForAnimations } from "../presence/index.js";
import { ViewportDataAttributes } from "./position-attributes.js";
import type { Viewport, ViewportOptions } from "./position-types.js";
import { type Dimensions, measurePopupSize, sizeVars } from "./position-viewport-size.js";

function cloneContent(container: HTMLElement): HTMLElement {
	const clone = ownerDocument(container).createElement("div");
	for (const child of Array.from(container.childNodes)) {
		clone.appendChild(child.cloneNode(true));
	}
	return clone;
}

function relativePosition(from: Element, to: Element): TriggerOffset {
	const a = from.getBoundingClientRect();
	const b = to.getBoundingClientRect();
	return {
		horizontal: b.left + b.width / 2 - (a.left + a.width / 2),
		vertical: b.top + b.height / 2 - (a.top + a.height / 2),
	};
}

// The popup grows away from the anchor on the top and left sides.
function anchoringStyle(side: Side, rtl: boolean): string {
	const edges = pinnedEdges(side, rtl);
	return edges ? `position: absolute; ${edges.vertical}: 0px; ${edges.horizontal}: 0px` : "";
}

/** Completes the CSS transitions running on `element` itself and styles it as it is now. */
function finishTransitions(element: HTMLElement) {
	if (typeof element.getAnimations !== "function") {
		return;
	}
	for (const animation of element.getAnimations()) {
		if (typeof CSSTransition !== "undefined" && animation instanceof CSSTransition) {
			animation.finish();
		}
	}
	void getComputedStyle(element).opacity;
}

/**
 * A popup Viewport: when the open popup moves to another trigger, the previous content stays as
 * an inert snapshot (`data-previous`) while the new content (`data-current`, re-created per
 * trigger and payload) transitions in, and the popup's size variables animate from the old size
 * to the new one, written to the enclosing Positioner's layout. `popup` is the popup's store;
 * `fixed.part` is the Viewport part's public name, for the error outside a Positioner. Call once
 * during the Viewport part's init.
 */
export function useViewport(
	popup: PopupView<WebTypes>,
	options: () => ViewportOptions,
	fixed: { readonly part: string },
): Viewport {
	const direction = DirectionContext.getOr(LTR);
	const layout = PopupLayoutContext.get(fixed.part);
	// The trigger change's offset is measured while core derives it, in the update that changes the
	// trigger, so the new container renders with its starting style and `data-activation-direction`
	// before the browser first styles it, whichever order Svelte runs block effects and effects in.
	const content = new ViewportContentStore<WebTypes>({
		popup,
		measureTriggerOffset: relativePosition,
	});
	content.connect();
	const anchoring = $derived(anchoringStyle(options().side, direction.direction === "rtl"));

	// The inert copy of the content shown before the trigger change (`data-previous`), while it
	// animates out. Core hears of it, for the Viewport's state.
	let previousContent: HTMLElement | null = $state.raw(null);
	let previousDimensions: Dimensions | null = $state.raw(null);
	// The content key whose container has left its starting style; `null` restarts it.
	let settledKey: number | null = $state(null);
	let currentContainer: HTMLElement | null = null;
	let previousContainer: HTMLElement | null = null;
	let cleanupController: AbortController | null = null;
	let committedDimensions: Dimensions | null = null;

	// The `data-current` containers by the content key each was created for, until the
	// trigger-change effect moves past that key. A container that left the document keeps its
	// children (Svelte removes only a destroyed block's top-level nodes, and an outroing one stays
	// as it was), so the snapshot doesn't depend on whether the old container's teardown, the new
	// one's attachment or the trigger-change effect runs first. The teardown can run before the
	// clone, though, so nodes that a teardown inside the old content removes (an attachment's
	// cleanup, say) are missing from the snapshot.
	//
	// In Svelte's async mode, a container whose content awaits outside a `<svelte:boundary>` is
	// attached only once that content resolves. A trigger change before then finds no container
	// for the shown key: it keeps the earlier snapshot, and the earlier trigger change's offset.
	const containers = new Map<number, HTMLElement>();

	// Takes the snapshot of a trigger change, after every update that can change what the popup
	// shows (open state, trigger, content key): if the trigger changed, the content shown before
	// the update is copied into the snapshot, then core is told the change is shown. Every content
	// key passes through here, payload re-creations included, so the previous key is always the key
	// of the content that was on screen. The trigger change is read untracked, so settling it
	// doesn't run this again. On mount nothing was shown yet, so there is no previous key and no
	// trigger change.
	watch(
		[
			() => popup.open,
			() => popup.mounted,
			() => popup.activeTriggerElement,
			() => content.contentKey,
		],
		([, , , key], [, , , shownKey]) => {
			const changeOffset = content.incomingOffset;
			const shown = shownKey === undefined ? undefined : containers.get(shownKey);
			if (changeOffset && shown) {
				previousContent = cloneContent(shown);
				content.showPrevious(changeOffset);
				settledKey = null;
				fillPrevious();
			}
			for (const containerKey of containers.keys()) {
				if (containerKey !== key) {
					containers.delete(containerKey);
				}
			}
			content.settle();
		},
	);

	// The snapshot's pending removal dies with the Viewport.
	$effect(() => () => cleanupController?.abort());

	// Removes the snapshot: one frame of starting styles, then a wait for the new content's
	// transitions. A newer content key (or snapshot) restarts it.
	$effect(() => {
		const key = content.contentKey;
		if (previousContent == null) {
			return;
		}
		return untrack(() => {
			cleanupController?.abort();
			return webScheduler.frame(() => {
				// The new container's enter transition runs from its starting styles only if the browser
				// styled it with them first. When the Viewport's own attributes (`data-transitioning`)
				// land after a layout read already styled the inserted container (Svelte's async mode
				// runs those effects in another order), it is transitioning into its starting styles
				// instead: complete that, so removing them below starts the enter transition.
				if (currentContainer) {
					finishTransitions(currentContainer);
				}
				settledKey = key;
				flushSync();
				cleanupController?.abort();
				const controller = new AbortController();
				cleanupController = controller;
				if (!currentContainer) {
					clearPrevious();
					return;
				}
				waitForAnimations(
					currentContainer,
					{ waitForStartingStyleRemoved: true, signal: controller.signal },
					clearPrevious,
				);
			});
		});
	});

	// Resizes the popup for new content: measures its natural size, then animates
	// `--popup-width` and `--popup-height` from the old size to it.
	$effect(() => {
		void popup.payload;
		const mounted = popup.mounted;
		const popupElement = popup.popupElement as HTMLElement | null;
		const positioner = popup.positionerElement as HTMLElement | null;
		const anchoringCss = anchoring;
		if (!mounted) {
			committedDimensions = null;
			return;
		}
		if (!popupElement || !positioner) {
			return;
		}
		let cancelFrame: (() => void) | undefined;
		let cancelRemeasure: (() => void) | undefined;
		const controller = new AbortController();
		const measure = () =>
			measurePopupSize(popupElement, positioner, anchoringCss, currentContainer, previousContainer);
		untrack(() => {
			const dimensions = measure();
			if (committedDimensions === null) {
				committedDimensions = dimensions;
				layout.setPopupStyle([anchoringCss, sizeVars("popup", "auto")].filter(Boolean).join("; "));
				layout.setPositionerStyle(sizeVars("positioner", dimensions));
				// The first opening's content may follow the payload in a later batch of the same update
				// (the Root's `children` render it): measure again once the update is done.
				cancelRemeasure = webScheduler.microtask(() => {
					const settled = measure();
					if (
						committedDimensions === dimensions &&
						(settled.width !== dimensions.width || settled.height !== dimensions.height)
					) {
						committedDimensions = settled;
						layout.setPositionerStyle(sizeVars("positioner", settled));
					}
				});
				return;
			}
			const previous = committedDimensions;
			committedDimensions = dimensions;
			previousDimensions = previous;
			layout.setPopupStyle([anchoringCss, sizeVars("popup", previous)].filter(Boolean).join("; "));
			layout.setPositionerStyle(sizeVars("positioner", dimensions));
			cancelFrame = webScheduler.frame(() => {
				layout.setPopupStyle(
					[anchoringCss, sizeVars("popup", dimensions)].filter(Boolean).join("; "),
				);
				flushSync();
				waitForAnimations(
					popupElement,
					{ waitForStartingStyleRemoved: true, signal: controller.signal },
					() => {
						layout.setPopupStyle(
							[anchoringCss, sizeVars("popup", "auto")].filter(Boolean).join("; "),
						);
					},
				);
			});
		});
		return () => {
			cancelRemeasure?.();
			controller.abort();
			cancelFrame?.();
		};
	});

	// Tells the Positioner to place a resizing popup from its far edges, while the Viewport is
	// there.
	$effect(() => {
		layout.setAdaptiveOrigin(true);
		return () => {
			layout.setAdaptiveOrigin(false);
			layout.setPopupStyle("");
			layout.setPositionerStyle("");
		};
	});

	// The snapshot is gone.
	function clearPrevious() {
		previousContent = null;
		previousDimensions = null;
		content.clearPrevious();
	}

	// Shows the snapshot in the `data-previous` container, from whichever runs second: the
	// trigger-change effect that takes the snapshot, or the container's attachment. A copy, so
	// showing it twice is harmless.
	function fillPrevious() {
		const snapshot = untrack(() => previousContent);
		if (snapshot && previousContainer) {
			previousContainer.replaceChildren(
				...Array.from(snapshot.childNodes, (node) => node.cloneNode(true)),
			);
		}
	}

	const attachCurrent: Attachment<HTMLElement> = (element) => {
		// The key this container was created for: the `{#key}` block re-creates it on a newer one.
		containers.set(
			untrack(() => content.contentKey),
			element,
		);
		currentContainer = element;
		return () => {
			if (currentContainer === element) {
				currentContainer = null;
			}
		};
	};

	const attachPrevious: Attachment<HTMLElement> = (element) => {
		previousContainer = element;
		fillPrevious();
		return () => {
			if (previousContainer === element) {
				previousContainer = null;
			}
		};
	};

	// Made once, so the containers keep their attachments while their other props change.
	const currentAttachment = attachmentProps(attachCurrent);
	const previousAttachment = attachmentProps(attachPrevious);
	// Whether the current content shows its starting style.
	const showStartingStyle = () =>
		content.incomingOffset != null || settledKey !== content.contentKey;

	return {
		get state() {
			return content.state;
		},
		get contentKey() {
			return content.contentKey;
		},
		get current() {
			const starting = content.state.transitioning && showStartingStyle();
			return {
				[ViewportDataAttributes.current]: "",
				[TransitionStatusDataAttributes.startingStyle]: starting ? "" : undefined,
				...currentAttachment,
			};
		},
		get previous() {
			const size = previousDimensions ? `${sizeVars("popup", previousDimensions)}; ` : "";
			return {
				[ViewportDataAttributes.previous]: "",
				inert: true,
				style: `${size}position: absolute`,
				[TransitionStatusDataAttributes.endingStyle]: showStartingStyle() ? undefined : "",
				...previousAttachment,
			};
		},
	};
}
