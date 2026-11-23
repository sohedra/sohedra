// `@sohedra/lynx`, bundled from the source by `pnpm -F @sohedra/lynx declarations`.

import type { LynxNode } from "@sohedra/lynx/elements";
import type { GlobalProps, InitData } from "@sohedra/lynx/host";
import type { Component } from "svelte";
/**
 * Calls the main-thread function `fn` with `params` from the background, after the elements made
 * and changed before the call: a state change the call must see needs `await tick()` first, as
 * for an element's methods. Resolves with what the function returns, awaited when it is a
 * thenable. Rejects with what it threw, when `fn` is not a main-thread function (reported), and
 * when the page reloads or closes first. `params` and the result are copied as plain data. Called
 * as the page's first frame is drawn, on the main thread, it does nothing: the background's same
 * call runs it once the page starts.
 */
export function runOnMainThread<Args extends unknown[], Result>(
	fn: (...args: Args) => Result,
): (...args: Args) => Promise<Awaited<Result>>;
/**
 * Calls the background function `fn` from a main-thread function. It works only inside one: there
 * the build gives `fn`'s handle, and the call resolves with what `fn` returns. Called on the
 * background, it throws.
 */
export function runOnBackground<Args extends unknown[], Result>(
	fn: (...args: Args) => Result,
): (...args: Args) => Promise<Awaited<Result>>;
declare const brand: unique symbol;
/**
 * A value the main thread owns, which main-thread functions share: an element (with
 * `main-thread:ref`) or any state. Read and write `current` inside main-thread functions; on the
 * background it is the initial value, and setting it throws.
 */
export interface MainThreadRef<T> {
	current: T;
	/** Marks the type: a ref is made by `mainThreadRef` only. */
	readonly [brand]: T;
}
/**
 * Makes a main-thread ref that starts as `initial`, for an element (`main-thread:ref`) or state
 * that main-thread functions share. The main thread makes its value the first time a main-thread
 * function or an element uses it, and forgets it once the page lets go of the ref; a ref made at a
 * module's top level starts again from `initial` on a page that reloads.
 */
export function mainThreadRef<T>(initial: T): MainThreadRef<T>;
/** Makes a main-thread ref that starts as `undefined`: see the first overload. */
export function mainThreadRef<T = undefined>(): MainThreadRef<T | undefined>;
/** What `mount` takes: where the layer goes, its props and its context. */
export interface MountOptions<Props extends Bag = Bag> {
	/**
	 * The node the layer goes in, such as the one an attachment gets. Left out, it goes under the
	 * page's root, after everything the page drew, so it is above the page.
	 */
	target?: LynxNode;
	/** A child of `target` the layer goes before. Left out, it goes after the target's children. */
	anchor?: LynxNode;
	/** The component's props. */
	props?: Props;
	/**
	 * The contexts the component gets, as `getAllContexts()` returns them. A layer mounted outside a
	 * component inherits none: read them while the component starts, and pass them on.
	 */
	context?: Map<any, any>;
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
	component: Component<Props, Exports, any>,
	...[options]: {} extends Props
		? [options?: MountOptions<NoInfer<Props>>]
		: [
				options: MountOptions<NoInfer<Props>> & {
					props: NoInfer<Props>;
				},
			]
): Exports;
/**
 * Unmounts a component that `mount` returned: it is off the page when this returns. An error in its
 * teardown is reported into Lynx. A layer the page already took away, when it reloaded or closed,
 * is left as it is.
 */
export function unmount(component: Bag): void;
/**
 * Mounts `App` as the page of this Lynx view: the page's entry calls it once, on both threads. On
 * the main thread it draws the first frame from the page's data; on the background it mounts the
 * component over that frame, then answers the page's events, and mounts it again when the host
 * reloads the page. An error while the page starts is reported into Lynx, not thrown.
 *
 * ```ts
 * import { mountPage } from "@sohedra/lynx";
 * import App from "./App.svelte";
 *
 * mountPage(App, { props: (initData) => ({ route: String(initData.route ?? "/") }) });
 * ```
 */
export function mountPage<Props extends Bag>(
	App: Component<Props>,
	options?: MountPageOptions<NoInfer<Props>>,
): void;
type Bag = Record<string, any>;
/** How `mountPage` mounts the page's root component. */
export interface MountPageOptions<Props extends Bag> {
	/**
	 * The root component's props: an object, or a function of the page's data and the host's global
	 * props, called at the page's start and at each reload. The first frame is drawn with the same,
	 * so both threads draw the same page. The function's arguments are typed as the app augments
	 * `InitData` and `GlobalProps` of `@sohedra/lynx/host`.
	 */
	props?: Props | ((initData: InitData, globalProps: GlobalProps) => Props);
	/**
	 * The contexts the root component gets, as Svelte's `mount` takes them: on the first frame and
	 * on the background alike.
	 */
	context?: Map<any, any>;
	/**
	 * Hears each error the binding reports into Lynx, once, on either thread: what a component, an
	 * effect, an event handler, a host listener, a teardown at a reload or a main-thread function
	 * throws, what fails as the page starts, hydrates or changes, and what the app reports with
	 * `reportError`. A teardown that throws as the page is destroyed is lost: Svelte reports it in a
	 * promise's reaction, and Lynx frees the background's runtime before that runs, so neither Lynx
	 * nor `onError` gets it. After one teardown throws, Svelte runs none of the teardowns after it
	 * (sveltejs/svelte#18415), at a reload too. Its context says the thread, the component when a
	 * development build knows it, and the binding's code when the binding wrote the error. A crash
	 * reporter plugs in here. It hears every error in every build: a development build only folds
	 * the repeats of one error in LogBox, until it has been quiet for five seconds.
	 *
	 * What Lynx catches itself, a timer's callback or a rejection nobody handled, goes to the host
	 * and LogBox, not here: Lynx offers no hook for it. What `onError` throws is reported into Lynx,
	 * and goes no further. It runs on the background; the main thread's errors reach it from there.
	 */
	onError?: ErrorHandler;
}
/** What `onError` is told about an error, beside the error. */
export interface ErrorContext {
	/** The thread it was thrown on. */
	thread: Thread;
	/**
	 * The component it came from, as its file's name (`Card.svelte`), when a development build says:
	 * Svelte's own lines under the message of an error that left an effect, the element whose
	 * handler or main-thread function threw, or the element whose `main-thread:` attribute is
	 * refused. A production build has none.
	 */
	component: string | undefined;
	/** The binding's stable code (`hydration_mismatch`), when the binding wrote the error. */
	code: string | undefined;
}
/** What `mountPage`'s `onError` takes: it hears each error with where it came from. */
export type ErrorHandler = (error: Error, context: ErrorContext) => void;
/**
 * Reports an error into Lynx, as the binding reports its own: LogBox shows it, and the page's
 * `onError` hears it. A value that is not an `Error` is wrapped in one. Never throws over the error
 * it reports.
 *
 * In a main-thread function, import it with `with { runtime: "shared" }`
 * (`import { reportError } from "@sohedra/lynx" with { runtime: "shared" }`): it then reports from
 * the main thread. A plain import is captured as the background's function, which cannot cross
 * to the main thread.
 */
export function reportError(error: unknown): void;
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
export const root: LynxNode<"page">;
/** The options of `createStaticCopy`. */
export interface StaticCopyOptions {
	/**
	 * Keep each element's `id` in the copy. Left out, the copy has none: two elements with one id
	 * make `querySelector("#x")` and Lynx's own look-ups by id ambiguous.
	 * @defaultValue false
	 */
	keepIds?: boolean;
}
/** What `createStaticCopy` returns. */
export interface StaticCopy {
	/** The copies' roots, in the order of the sources: nodes of the page. */
	readonly nodes: readonly LynxNode[];
	/**
	 * Takes this call's copies out of the container. It does nothing the second time, or once Svelte
	 * removed the container, which took the copies with it.
	 */
	remove(): void;
}
/**
 * Copies drawn elements, with everything under them, into an element: a lifeless copy that keeps
 * outgoing content on screen, or a hidden twin to measure. The copies are nodes of the page:
 * `invoke`, `setAttribute`, `setStyleProperty`, `contains` and `isConnected` work on them as on
 * any node, and a call and the changes made to its copies in the same tick reach the screen
 * together.
 *
 * ```ts
 * import { createStaticCopy } from "@sohedra/lynx";
 *
 * const copy = createStaticCopy(card, holder);
 * copy.nodes; // the copies' roots
 * copy.remove(); // takes this call's copies out
 * ```
 *
 * `source` is one node or a list of them; `container` is an element Svelte rendered with no
 * children. A container that holds copies takes more after them, and each call's `remove()` takes
 * out its own. If Svelte removes the container, the copies go with it.
 *
 * A copy carries each element's tag, its text and its attributes as they are at the call, object
 * values copied. It leaves out listeners, `main-thread:` attributes and `id` unless `keepIds`. It
 * cannot carry what the background does not hold: styles set with `setStyleProperty` (set them
 * on the copy), a scroll position, typed text, an animation's progress, what a main-thread
 * function set. A `<list>` cannot be copied.
 *
 * Throws, before any node is made, when the container is not an element on the page or holds
 * something that is not a copy, when a source is not an element on the page or is the page's
 * `root`, and when a source holds a `<list>`. On the main thread it throws too: call it from an effect, an attachment or an
 * event handler.
 */
export function createStaticCopy(
	source: LynxNode | readonly LynxNode[],
	container: LynxNode,
	options?: StaticCopyOptions,
): StaticCopy;
/** The two threads a Lynx page runs on. */
type Thread = "background" | "main-thread";

export {};
