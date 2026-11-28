// A popup Root's work on the web: the deps its store is built from (its id, the tree of nested
// popups it joins, the platform), and what it does around its store while it is mounted: it
// unmounts a closed popup after its exit animations, and listens for Escape and outside presses
// while the popup is open.
import {
	PopupTree,
	isNestedInPopup,
	type PopupStoreDeps,
	type PopupView,
} from "@sohedra/primitives-core/foundation/popup/index.js";

import { useDismissRoot } from "../dismiss/index.js";
import { fallbackEvent, webPlatform, type WebTypes } from "../kernel/index.js";
import { DialogRootContext, PopupNodeContext, PopupTreeContext } from "./popup-context.js";
import { usePopupUnmount } from "./popup-unmount.svelte.js";

/** What `usePopupRootDeps` gives a popup store: every dep but the `open` binding. */
export type PopupRootDeps = Omit<PopupStoreDeps<WebTypes>, "open">;

/**
 * What every popup store is given from around its Root on the web: its id, the tree of nested
 * popups, the platform and the event of a change a handle asks for. A Root nested in another popup (a popover or a dialog) joins its
 * tree; the outermost creates one. Call once while the Root initialises: it reads and sets the
 * tree's context.
 */
export function usePopupRootDeps(defaultPopupId: string): PopupRootDeps {
	const tree = PopupTreeContext.getOr(null) ?? new PopupTree<WebTypes>();
	PopupTreeContext.set(tree);
	return {
		defaultPopupId,
		tree,
		nested: isNestedInPopup(PopupNodeContext.getOr(null), DialogRootContext.getOr(null)),
		platform: webPlatform,
		imperativeEvent: fallbackEvent,
	};
}

/**
 * A popup Root's work around its store: unmounts a closed popup once its exit animations finish
 * unless `preventUnmountOnClose()` was called (the store decides when it waits), and listens for
 * Escape and outside presses while it is open. Call once while the Root initialises, after it
 * built and connected its store: it starts its own effects.
 */
export function usePopupRoot(store: PopupView<WebTypes>): void {
	usePopupUnmount(store);

	// Escape and outside presses, through the document listeners of the store's dismissal.
	useDismissRoot(store);
}
