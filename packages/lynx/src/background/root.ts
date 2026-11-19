// `root`: the page's root node, one value for the runtime's life, for Svelte's `on()`, as
// `on(window, …)` is on the web. Its type, and the overload of `on()` that takes it.

import { pageRenderer } from "./renderer/page-renderer.ts";

/** An event a listener on the page's root hears. */
export interface RootEvent {
	/** The event's name, as Lynx sends it: `tap`, `touchstart`… */
	readonly type: string;
	/** The node the event happened on: the root itself, or a node inside it. */
	readonly target: unknown;
	/** The root. */
	readonly currentTarget: Root;
	/** The rest of what Lynx sends with the event: `detail`, `touches`, `timestamp`… */
	readonly [field: string]: unknown;
}

/** A listener of the page's root. */
export type RootListener = (event: RootEvent) => unknown;

/** The page's root: what `root` is. */
export interface Root {
	/** The tag of Lynx's page element. */
	readonly tag: "page";
	/** Whether a page runs: the root is Lynx's page element only then. */
	readonly isConnected: boolean;
	/** Whether `other` is the root or a node of the page. */
	contains(other: unknown): boolean;
	/**
	 * Listens to the events of every element of the page. With `capture`, the listener hears an
	 * event before the element's own handlers, and a handler that catches it does not stop it.
	 */
	addEventListener(type: string, listener: RootListener, options?: { capture?: boolean }): void;
	removeEventListener(type: string, listener: RootListener, options?: { capture?: boolean }): void;
}

/**
 * The page's root: the node above everything the page drew and every layer `mount` mounted, which
 * is Lynx's page element. Listen on it with Svelte's `on()`, in an effect or an attachment: a
 * capture listener hears the touches of every element of the page, layers included, before their
 * own handlers, and a handler that catches below does not stop it.
 *
 * ```ts
 * import { on } from "svelte/events";
 * import { root } from "@sohedra/lynx";
 *
 * $effect(() => on(root, "tap", (event) => closeUnless(event.target), { capture: true }));
 * ```
 *
 * It is one value for the runtime's life. Before a page starts it is not on the page: a listener
 * it is given then is bound when the page starts. Once the page closes, its listeners are dropped
 * and none is called. On the main thread, its listeners throw: listen from the background.
 */
// Boundary: the root is the renderer's own element node; this is the part an app uses.
export const root: Root = pageRenderer.root as unknown as Root;

declare module "svelte/events" {
	/**
	 * Listens on the page's root, and returns a function that stops. Call it in an effect or an
	 * attachment, which stops it when they end.
	 */
	export function on(
		root: Root,
		type: string,
		handler: RootListener,
		options?: { capture?: boolean },
	): () => void;
}
