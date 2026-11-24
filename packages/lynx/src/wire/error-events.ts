// How the binding hears the errors a polyfill catches (`@sohedra/lynx-polyfill`, or any that follows
// the web): as the web reports an exception, they are `error` events on the global object, an
// `ErrorEvent` with the thrown value as its `error`. The binding listens there when a page starts,
// after the app's entry has imported its fills, and reports each event as the page's error,
// calling `preventDefault()` so the polyfill does not report it into Lynx again. An event the app's
// own listener already prevented is left alone. The binding imports nothing of the polyfill.

/** The global object, as far as listening reads it. */
interface ListeningScope {
	addEventListener?: unknown;
	[key: symbol]: unknown;
}

/** What a listener receives: an `ErrorEvent`, as far as this reads it. */
interface HeardEvent {
	defaultPrevented?: boolean;
	error?: unknown;
	message?: unknown;
	preventDefault?: () => void;
}

/** Marks a realm whose `error` events a page already hears: pages of a `LynxGroup` share one. */
const LISTENING: unique symbol = Symbol.for("sohedra.lynx.errorEvents");

/**
 * Reports the `error` events of `scope` with `report`, once per realm: the first page's report
 * hears them all. Nothing when the global object is no `EventTarget` (no polyfill was imported).
 */
export function hearErrorEvents(scope: object, report: (error: unknown) => void): void {
	// Boundary: the global object, read by name.
	const global = scope as ListeningScope;
	if (typeof global.addEventListener !== "function" || global[LISTENING]) return;
	Object.defineProperty(global, LISTENING, { value: true, configurable: true });
	(global.addEventListener as (type: string, listener: (event: HeardEvent) => void) => void).call(
		global,
		"error",
		(event) => {
			if (event.defaultPrevented) return;
			event.preventDefault?.();
			report("error" in event && event.error !== undefined ? event.error : event.message);
		},
	);
}
