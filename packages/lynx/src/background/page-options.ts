// The options of `mountPage` on the background: how the page's root component mounts, and who
// hears its errors.

import type { ErrorHandler } from "./errors.ts";

// oxlint-disable-next-line typescript/no-explicit-any -- Svelte's own bound on props
export type Bag = Record<string, any>;

/** How `mountPage` mounts the page's root component. */
export interface MountPageOptions<Props extends Bag> {
	/**
	 * The root component's props: an object, or a function of the page's data and the host's global
	 * props, called at the page's start and at each reload. The first frame is drawn with the same,
	 * so both threads draw the same page.
	 */
	props?:
		| Props
		| ((initData: Record<string, unknown>, globalProps: Record<string, unknown>) => Props);
	/**
	 * The contexts the root component gets, as Svelte's `mount` takes them: on the first frame and
	 * on the background alike.
	 */
	// oxlint-disable-next-line typescript/no-explicit-any -- Svelte's own type of a context
	context?: Map<any, any>;
	/**
	 * Hears each error the binding reports into Lynx, once, on either thread: what a component, an
	 * effect, an event handler, a host listener, a teardown at a reload or a main-thread function
	 * throws, what fails as the page starts, hydrates or changes, and what the app reports with
	 * `reportError`. A teardown that throws as the page is destroyed is lost: Svelte reports it a
	 * microtask later, and the engine frees the background's runtime first, as Lynx on Android
	 * does; neither Lynx nor `onError` gets it. Its context says the thread, the component when a
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
