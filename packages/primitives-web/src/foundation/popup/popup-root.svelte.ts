// A popup Root's work on the web: the deps its store is built from (its id, the tree of nested
// popups it joins, the platform), and what it does around its store while it is mounted: it
// attaches the store to a handle, unmounts a closed popup after its exit animations, and listens
// for Escape and outside presses while the popup is open.
import {
	FloatingTree,
	isNestedInFloating,
	type PopupStoreDeps,
} from "@sohedra/primitives-core/foundation/popup/index.js";
import { getAbortSignal, untrack } from "svelte";

import { type DismissRootOptions, type DismissView, useDismiss } from "../dismiss/index.js";
import { fallbackEvent, webPlatform, type WebTypes } from "../kernel/index.js";
import { waitForAnimations } from "../presence/index.js";
import { DialogRootContext, FloatingNodeContext, FloatingTreeContext } from "./popup-context.js";

/** What `usePopupDeps` gives a popup store: every dep but the `open` binding. */
export type PopupRootDeps = Omit<PopupStoreDeps<WebTypes>, "open">;

/** What `usePopupUnmount` reads of its store and asks of it. */
export interface PopupUnmountView {
	/** Whether a closed popup is waiting for its exit animations before unmounting. */
	readonly awaitingUnmount: boolean;
	/** The popup element, whose exit animations are awaited by default. */
	readonly popupElement: Element | null;
	/** Ends the closing phase. */
	unmount(): void;
}

/** What `usePopupRoot` reads of its store and asks of it. A popup store is one as it is. */
export interface PopupRootView extends DismissView, PopupUnmountView {}

/** A handle a Root attaches its store to, whatever the handle's store type. */
export interface PopupRootHandle {
	attachStore(store: never, imperativeEvent: () => unknown): () => void;
}

/** What the Root tells `usePopupRoot`, from its options function. */
export interface PopupRootOptions extends DismissRootOptions {
	/** The `handle` prop: it holds the Root's store while the Root is mounted. */
	readonly handle?: PopupRootHandle | undefined;
}

/**
 * What every popup store is given from around its Root on the web: its id, the tree of nested
 * popups and the platform. A Root nested in another popup (a popover or a dialog) joins its
 * tree; the outermost creates one. Call once while the Root initialises: it reads and sets the
 * tree's context.
 */
export function usePopupDeps(floatingId: string): PopupRootDeps {
	const tree = FloatingTreeContext.getOr(null) ?? new FloatingTree<WebTypes>();
	FloatingTreeContext.set(tree);
	return {
		floatingId,
		tree,
		nested: isNestedInFloating(FloatingNodeContext.getOr(null), DialogRootContext.getOr(null)),
		platform: webPlatform,
	};
}

/**
 * A popup Root's work around its store: attaches it to its handle, unmounts a closed popup once
 * its exit animations finish unless `preventUnmountOnClose()` was called (the store decides when
 * it waits), and listens for Escape and outside presses while it is open. Call once while the
 * Root initialises, after it built its store: it starts its own effects.
 */
export function usePopupRoot(
	store: PopupRootView,
	options: () => PopupRootOptions = () => ({}),
): void {
	// The handle holds this Root's store while it is mounted. Attached before descendants
	// initialise (a pre-effect runs during init), so they can use the handle in their first
	// effects. Its imperative calls carry the web's fallback event. A handle is made at module
	// scope, before any platform, so it holds stores of any platform: the one cast of a store to a
	// handle's store type is here.
	$effect.pre(() => options().handle?.attachStore(store as never, fallbackEvent));

	usePopupUnmount(store);

	// Escape and outside presses, through the document listeners of the store's dismissal.
	useDismiss(store, options);
}

/**
 * Unmounts a closed popup once its exit animations finish, unless `preventUnmountOnClose()` was
 * called (the store decides when it waits). `element` gives the element whose animations are
 * awaited when it isn't the popup. Call once while the Root initialises: it starts its own effect.
 */
export function usePopupUnmount(
	store: PopupUnmountView,
	element: () => HTMLElement | null = () => store.popupElement as HTMLElement | null,
): void {
	// Waits for the exit animations of a closed popup, then unmounts it.
	$effect(() => {
		if (!store.awaitingUnmount) {
			return;
		}
		const awaited = element();
		const signal = getAbortSignal();
		untrack(() => {
			// Without a popup element (its Portal was removed) there is nothing to wait for: the
			// close never completes.
			if (awaited) {
				waitForAnimations(awaited, { signal }, store.unmount);
			}
		});
	});
}
