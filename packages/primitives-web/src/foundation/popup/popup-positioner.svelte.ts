// A popup Positioner's work on the web, beside the shared Positioner part that places it: the
// popup's node in the floating tree, the transitions that run again when the popup moves to
// another trigger, and the page scroll lock of a modal popup.
import type { InteractionType } from "@sohedra/primitives-core/foundation/popup/index.js";
import { untrack } from "svelte";

import {
	type TriggerSwitchView,
	useAnchoredScrollLock,
	useTriggerSwitchTransition,
} from "../position/index.js";
import { FloatingNodeContext } from "./popup-context.js";

/** What `usePopupPositioner` reads of its store and asks of it. A popup store is one as it is. */
export interface PopupPositionerView extends TriggerSwitchView {
	/** Whether the page scroll is locked now. */
	readonly anchoredScrollLockEnabled: boolean;
	/** How the popup was opened, while it is open. */
	readonly openMethod: InteractionType | null;
	/** The active trigger element, while the popup is mounted. */
	readonly activeTriggerElement: Element | null;
	/** Adds the popup's node to the floating tree under `parentId`; returns the removal. */
	joinFloatingTree(id: string, parentId: string | null): () => void;
}

/** What the Positioner part tells `usePopupPositioner`, from its options function. */
export interface PopupPositionerOptions {
	/** The Positioner's node id in the floating tree, fixed for its life (`$props.id()`). */
	readonly nodeId: string;
}

/**
 * A popup Positioner's work beside placing the popup: makes the Positioner a node of the floating
 * tree (popups nested in it are its children), runs the transitions again when the popup moves to
 * another trigger, and locks the page scroll while the store says so. Call once while the
 * Positioner part initialises: it reads and sets the node context and starts its own effects.
 */
export function usePopupPositioner(
	store: PopupPositionerView,
	options: () => PopupPositionerOptions,
): void {
	const parentNodeId = FloatingNodeContext.getOr(null);
	const nodeId = untrack(options).nodeId;
	FloatingNodeContext.set(nodeId);

	// The popup's node is in the floating tree while its Positioner is mounted.
	$effect(() => store.joinFloatingTree(nodeId, parentNodeId));
	useTriggerSwitchTransition(store);
	useAnchoredScrollLock(() => ({
		enabled: store.anchoredScrollLockEnabled,
		touchOpen: store.openMethod === "touch",
		positionerElement: store.positionerElement as HTMLElement | null,
		referenceElement: store.activeTriggerElement,
	}));
}
