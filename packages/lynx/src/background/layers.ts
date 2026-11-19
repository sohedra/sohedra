// `mount` and `unmount` for layers above the page: a modal, a sheet, a toast. Svelte's own, with the
// page's renderer filled in and the page's root as the default target. The page keeps the layers
// still mounted, and unmounts them when it reloads or closes.

import { mount as svelteMount, unmount as svelteUnmount } from "svelte";
import type { Component } from "svelte";

import { backgroundError } from "./catalogue.ts";
import type { ElementNode } from "./renderer/element.ts";
import { pageRenderer } from "./renderer/page-renderer.ts";
import { reportError } from "./report.ts";
import type { Root } from "./root.ts";

// oxlint-disable-next-line typescript/no-explicit-any -- Svelte's own bound on props and exports
type Bag = Record<string, any>;

/** What `mount` takes: where the layer goes, its props and its context. */
export interface MountOptions<Props extends Bag = Bag> {
	/**
	 * The node the layer goes in, such as the one an attachment gets. Left out, it goes under the
	 * page's root, after everything the page drew, so it is above the page.
	 */
	target?: ElementNode | Root;
	/** A child of `target` the layer goes before. Left out, it goes after the target's children. */
	anchor?: ElementNode;
	/** The component's props. */
	props?: Props;
	/**
	 * The contexts the component gets, as `getAllContexts()` returns them. A layer mounted outside a
	 * component inherits none: read them while the component starts, and pass them on.
	 */
	// oxlint-disable-next-line typescript/no-explicit-any -- Svelte's own type of a context
	context?: Map<any, any>;
}

/** The layers still mounted; null while no page runs. */
let layers: Set<Bag> | null = null;
/** The layers the page took away when it reloaded or closed: the app may still unmount them. */
const takenAway = new WeakSet<Bag>();

/** A page starts: layers can be mounted above it. */
export function openLayers(): void {
	layers = new Set();
}

/** Unmounts the layers still mounted: the page reloads or closes. */
export function unmountLayers(): void {
	if (!layers) return;
	const open = [...layers];
	layers.clear();
	for (const layer of open) {
		unmount(layer);
		takenAway.add(layer);
	}
}

/** The page has closed: nothing can be mounted until the next one starts. */
export function closeLayers(): void {
	layers = null;
}

/**
 * Mounts a component above the page, a modal, a sheet or a toast, and returns its exports, which
 * `unmount` takes. It draws with the page's renderer from wherever it is called: an effect, an
 * event handler, a timer or a promise. Whatever is still mounted when the page reloads or closes
 * goes with it.
 *
 * Without a `target`, the component goes under the page's root, after everything the page drew: a
 * later layer is above an earlier one. A layer that covers the page is `position: absolute` with
 * `width: 100%; height: 100%`. A layer outlives the effect that mounted it: unmount it in the
 * effect's cleanup to tie it to the component.
 *
 * ```svelte
 * <script lang="ts">
 *   import { getAllContexts } from "svelte";
 *   import { mount, unmount } from "@sohedra/lynx";
 *   import Sheet from "./Sheet.svelte";
 *
 *   const context = getAllContexts(); // while the component starts
 *
 *   function open() {
 *     const sheet = mount(Sheet, { context, props: { onclose: () => unmount(sheet) } });
 *   }
 * </script>
 * ```
 *
 * Throws when no page runs: before `mountPage`, or after the page closed. On the main thread it
 * throws too: call it from an effect, an attachment or an event handler.
 */
export function mount<Props extends Bag, Exports extends Bag>(
	// oxlint-disable-next-line typescript/no-explicit-any -- Svelte's own: the component's bindings, whatever they are
	component: Component<Props, Exports, any>,
	...[options]: {} extends Props
		? [options?: MountOptions<NoInfer<Props>>]
		: [options: MountOptions<NoInfer<Props>> & { props: NoInfer<Props> }]
): Exports {
	if (!layers) throw backgroundError({ code: "mount_without_page", details: {} });
	// Boundary: Svelte's `mount` takes its own node types; the page's renderer makes these.
	const instance = svelteMount(component, {
		...options,
		target: (options?.target ?? pageRenderer.root) as never,
		renderer: pageRenderer,
	} as never) as Exports;
	layers.add(instance);
	return instance;
}

/**
 * Unmounts a component that `mount` returned: it is off the page when this returns. An error in its
 * teardown is reported into Lynx. A layer the page already took away, when it reloaded or closed,
 * is left as it is.
 */
export function unmount(component: Bag): void {
	if (takenAway.has(component)) return;
	layers?.delete(component);
	svelteUnmount(component).catch(reportError);
}
