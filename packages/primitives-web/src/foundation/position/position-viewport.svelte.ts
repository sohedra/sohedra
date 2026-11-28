import { watch } from "@sohedra/primitives-core/foundation/kernel/index.js";
import {
	getActivationDirection,
	pinnedEdges,
	type Side,
	type TriggerOffset,
	ViewportContentStore,
} from "@sohedra/primitives-core/foundation/position/index.js";
import { flushSync, untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

import {
	DirectionContext,
	LTR,
	ownerDocument,
	webScheduler,
	type WebTypes,
} from "../kernel/index.js";
import { waitForAnimations } from "../presence/index.js";
import { PopupLayoutContext } from "./position-popup-layout.svelte.js";
import type { Viewport, ViewportOptions, ViewportView } from "./position-types.js";
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
 * to the new one, written to the enclosing Positioner's layout. `popup` is the behaviour's view
 * of the popup; a part passes its store. Call once during the Viewport part's init.
 */
export function useViewport(popup: ViewportView, options: () => ViewportOptions): Viewport {
	const direction = DirectionContext.getOr(LTR);
	const layout = PopupLayoutContext.get();
	// Core's content rules take these five under its own names.
	const content = new ViewportContentStore<WebTypes>(() => ({
		open: popup.open,
		mounted: popup.mounted,
		activeTriggerId: popup.activeTriggerId,
		activeTrigger: popup.activeTriggerElement,
		payload: popup.payload,
	}));
	content.connect();

	// Where the content moves from, during the update that switches triggers. Measured while
	// deriving (a layout read in a derived, on purpose): the new container renders with its
	// starting style and `data-activation-direction` in that same update, before the browser
	// first styles it, whichever order Svelte runs block effects and effects in. An effect would
	// be an update late.
	const incomingOffset = $derived.by(() => {
		const change = content.switching;
		return change ? relativePosition(change.from, change.to) : null;
	});
	const anchoring = $derived(anchoringStyle(options().side, direction.direction === "rtl"));

	// The inert copy of the content shown before the switch (`data-previous`), while it animates out.
	let previousContent: HTMLElement | null = $state.raw(null);
	let offset: TriggerOffset | null = $state.raw(null);
	let previousDimensions: Dimensions | null = $state.raw(null);
	// The content key whose container has left its starting style; `null` restarts it.
	let settledKey: number | null = $state(null);
	let currentContainer: HTMLElement | null = null;
	let previousContainer: HTMLElement | null = null;
	let cleanupController: AbortController | null = null;
	let committedDimensions: Dimensions | null = null;

	// The `data-current` containers by the content key each was created for, until the switch
	// effect moves past that key. A container that left the document keeps its children (Svelte
	// removes only a destroyed block's top-level nodes, and an outroing one stays as it was), so the
	// snapshot doesn't depend on whether the old container's teardown, the new one's attachment or
	// the switch effect runs first. The teardown can run before the clone, though, so nodes that a
	// teardown inside the old content removes (an attachment's cleanup, say) are missing from the
	// snapshot.
	//
	// In Svelte's async mode, a container whose content awaits outside a `<svelte:boundary>` is
	// attached only once that content resolves. A switch before then finds no container for the
	// shown key: it keeps the earlier snapshot, and the earlier switch's offset.
	const containers = new Map<number, HTMLElement>();

	// Takes the snapshot of a switch, after every update that can change what the popup shows
	// (open state, trigger, content key): if it switched triggers, the content shown before the
	// update is copied into the snapshot, then core is told the switch is shown. Every content key
	// passes through here, payload re-creations included, so the previous key is always the key of
	// the content that was on screen. The switch is read untracked, so settling it doesn't run
	// this again. On mount nothing was shown yet, so there is no previous key and no switch.
	watch(
		[
			() => popup.open,
			() => popup.mounted,
			() => popup.activeTriggerElement,
			() => content.contentKey,
		],
		([, , , key], [, , , shownKey]) => {
			const switchOffset = incomingOffset;
			const shown = shownKey === undefined ? undefined : containers.get(shownKey);
			if (switchOffset && shown) {
				previousContent = cloneContent(shown);
				offset = switchOffset;
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
		{ lazy: false },
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
					previousContent = null;
					previousDimensions = null;
					return;
				}
				waitForAnimations(
					currentContainer,
					{ waitForStartingStyleRemoved: true, signal: controller.signal },
					() => {
						previousContent = null;
						previousDimensions = null;
					},
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
				layout.popupStyle = [anchoringCss, sizeVars("popup", "auto")].filter(Boolean).join("; ");
				layout.positionerStyle = sizeVars("positioner", dimensions);
				// The first opening's content may follow the payload in a later batch of the same update
				// (the Root's `children` render it): measure again once the update is done.
				cancelRemeasure = webScheduler.microtask(() => {
					const settled = measure();
					if (
						committedDimensions === dimensions &&
						(settled.width !== dimensions.width || settled.height !== dimensions.height)
					) {
						committedDimensions = settled;
						layout.positionerStyle = sizeVars("positioner", settled);
					}
				});
				return;
			}
			const previous = committedDimensions;
			committedDimensions = dimensions;
			previousDimensions = previous;
			layout.popupStyle = [anchoringCss, sizeVars("popup", previous)].filter(Boolean).join("; ");
			layout.positionerStyle = sizeVars("positioner", dimensions);
			cancelFrame = webScheduler.frame(() => {
				layout.popupStyle = [anchoringCss, sizeVars("popup", dimensions)]
					.filter(Boolean)
					.join("; ");
				flushSync();
				waitForAnimations(
					popupElement,
					{ waitForStartingStyleRemoved: true, signal: controller.signal },
					() => {
						layout.popupStyle = [anchoringCss, sizeVars("popup", "auto")]
							.filter(Boolean)
							.join("; ");
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
		layout.adaptiveOrigin = true;
		return () => {
			layout.adaptiveOrigin = false;
			layout.popupStyle = "";
			layout.positionerStyle = "";
		};
	});

	// Shows the snapshot in the `data-previous` container, from whichever runs second: the switch
	// effect that takes the snapshot, or the container's attachment. A copy, so showing it twice is
	// harmless.
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

	return {
		get contentKey() {
			return content.contentKey;
		},
		get transitioning() {
			return previousContent != null || incomingOffset != null;
		},
		get activationDirection() {
			return getActivationDirection(incomingOffset ?? offset);
		},
		get showStartingStyle() {
			return incomingOffset != null || settledKey !== content.contentKey;
		},
		get previousStyle() {
			const size = previousDimensions ? `${sizeVars("popup", previousDimensions)}; ` : "";
			return `${size}position: absolute`;
		},
		attachCurrent,
		attachPrevious,
	};
}
