// `root`: the page's root node, one value for the runtime's life, for Svelte's `on()`, as
// `on(window, …)` is on the web.

import type { LynxNode } from "@sohedra/lynx/elements";

import { pageRenderer } from "./renderer/page-renderer.ts";

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
 * and none is called. On the main thread, listening on it throws: listen from the background.
 *
 * A tap on the first frame, before the background has taken it over, reaches the handlers of the
 * element and its ancestors once the background has, but no listener on `root`.
 */
// Boundary: the root is the renderer's own element node, which an app sees as a node.
export const root: LynxNode<"page"> = pageRenderer.root as unknown as LynxNode<"page">;
