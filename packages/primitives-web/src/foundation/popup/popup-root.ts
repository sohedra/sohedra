// A popup Root's work on the web: the deps its store is built from (its id, the popup tree, the
// platform), and, while mounted, unmounting a closed popup after its exit animations and listening
// for Escape and outside presses while it is open.
import {
	PopupTree,
	isNestedInPopup,
	type PopupStoreDeps,
	type PopupView,
} from "@sohedra/primitives-core/foundation/popup";

import { useDismissRoot } from "../dismiss/index.js";
import { fallbackEvent, webPlatform, type WebTypes } from "../kernel/index.js";
import { DialogRootContext, PopupNodeContext, PopupTreeContext } from "./popup-context.js";
import { usePopupUnmount } from "./popup-unmount.svelte.js";

/** What `usePopupRootDeps` gives a popup store: every dep but the `open` binding. */
export type PopupRootDeps = Omit<PopupStoreDeps<WebTypes>, "open">;

/**
 * What every popup store is given from around its Root: its id, the popup tree, the platform and
 * the event of a handle's change. A Root nested in a popup joins its tree; the outermost creates
 * one. Call once while the Root initialises: it reads and sets the tree's context.
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
 * A popup Root's work around its store: unmounts a closed popup after its exit animations unless
 * `preventUnmountOnClose()` was called, and listens for Escape and outside presses while open.
 * Call once while the Root initialises, after it built and connected its store.
 */
export function usePopupRoot(store: PopupView<WebTypes>): void {
	usePopupUnmount(store);

	// Escape and outside presses, through the document listeners of the store's dismissal.
	useDismissRoot(store);
}
