// A popup Positioner's work on the web, beside the shared Positioner part that places it: the
// popup's node in the popup tree, the transitions that run again when the popup moves to
// another trigger, and the page scroll lock of a modal popup.
import type { InteractionType } from "@sohedra/primitives-core/foundation/popup/index.js";
import { untrack } from "svelte";

import {
	type TriggerChangeView,
	useAnchoredScrollLock,
	useTriggerChangeTransition,
} from "../position/index.js";
import { PopupNodeContext } from "./popup-context.js";

/** What `usePopupPositioner` reads of its store and asks of it. A popup store is one as it is. */
export interface PopupPositionerView extends TriggerChangeView {
	/** Whether the page scroll is locked now. */
	readonly anchoredScrollLockEnabled: boolean;
	/** How the popup was opened, while it is open. */
	readonly openMethod: InteractionType | null;
	/** The active trigger element, while the popup is mounted. */
	readonly activeTriggerElement: Element | null;
	/** Adds the popup's node to the popup tree under `parentId`; returns the removal. */
	joinPopupTree(id: string, parentId: string | null): () => void;
}

/** What the Positioner part tells `usePopupPositioner`, from its options function. */
export interface PopupPositionerOptions {
	/** The Positioner's node id in the popup tree, fixed for its life (`$props.id()`). */
	readonly nodeId: string;
}

/**
 * A popup Positioner's work beside placing the popup: makes the Positioner a node of the popup
 * tree (popups nested in it are its children), runs the transitions again when the popup moves to
 * another trigger, and locks the page scroll while the store says so. Call once while the
 * Positioner part initialises: it reads and sets the node context and starts its own effects.
 */
export function usePopupPositioner(
	store: PopupPositionerView,
	options: () => PopupPositionerOptions,
): void {
	const parentNodeId = PopupNodeContext.getOr(null);
	const nodeId = untrack(options).nodeId;
	PopupNodeContext.set(nodeId);

	// The popup's node is in the popup tree while its Positioner is mounted.
	$effect(() => store.joinPopupTree(nodeId, parentNodeId));
	useTriggerChangeTransition(store);
	useAnchoredScrollLock(() => ({
		enabled: store.anchoredScrollLockEnabled,
		touchOpen: store.openMethod === "touch",
		positionerElement: store.positionerElement as HTMLElement | null,
		triggerElement: store.activeTriggerElement,
	}));
}
