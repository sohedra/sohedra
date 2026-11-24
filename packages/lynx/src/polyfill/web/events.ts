// `Event`, `EventTarget` and `CustomEvent`: DOM § 2 "Events", by event-target-shim, and DOM § 2.4
// "Interface CustomEvent" over it. Both threads lack them. What a listener throws is reported as
// HTML reports an exception (errors.ts). The package's warning for a listener added twice, which
// the standard ignores quietly, is left out; its other warnings go to the console. Leaves out an
// event's `timeStamp` in the page's time (it is the epoch's, from `Date.now()`).

import { reportCaught } from "../errors.ts";
import { readConsole } from "../globals.ts";
import type { Scope } from "../globals.ts";
import { installLazy, named } from "../install.ts";
import { Event, EventTarget, setErrorHandler, setWarningHandler } from "../vendor/events.js";
import type { CustomEventClass, EventClass } from "./standard-classes.ts";

/**
 * Svelte's runtime tests values with `instanceof EventTarget`, unguarded, as it copies state
 * (`$state.snapshot`, and so `$inspect` and `{@debug}`) and as it walks an action's object
 * (svelte/src/internal/shared/clone.js, internal/client/runtime.js), on both threads. The other
 * fills' targets (`AbortSignal`, `MessagePort`, the global object) are `EventTarget`s.
 *
 * @workaround web-events kind=lynx-gap delete-when="Lynx's threads have global Event, EventTarget and CustomEvent"
 */
export function fillEvents(scope: Scope): void {
	installLazy(
		scope,
		"EventTarget",
		loadEvents(() => EventTarget),
		isFunction,
	);
	installLazy(
		scope,
		"Event",
		loadEvents(() => Event),
		isFunction,
	);
	installLazy(
		scope,
		"CustomEvent",
		loadEvents(() => createCustomEvent(scope)),
		isFunction,
	);
}

const isFunction = (existing: unknown): boolean => typeof existing === "function";

/** The package's warnings left out: a listener added twice, and the options of its second add. */
const QUIET = ["W06", "W07"];

/** `load`, after the package's errors and warnings are routed: once, the first time any loads. */
function loadEvents<T>(load: () => T): () => T {
	return () => {
		setErrorHandler(reportCaught);
		setWarningHandler(({ code, message, args }) => {
			if (!QUIET.includes(code)) readConsole()?.warn(message, ...args);
		});
		return load();
	};
}

/** DOM's `CustomEvent`, an `Event` of the thread's with its `detail`. */
export function createCustomEvent(scope: Scope): CustomEventClass {
	// Boundary: the thread's `Event`, this fill's or an engine's.
	const Base = scope["Event"] as EventClass;
	const details = new WeakMap<object, unknown>();
	class CustomEventFill<T> extends Base {
		constructor(type: string, init?: CustomEventInit<T>) {
			super(type, init);
			details.set(this, init?.detail ?? null);
		}

		get detail(): T {
			// Boundary: what the event was made with.
			return details.get(this) as T;
		}

		initCustomEvent(type: string, bubbles?: boolean, cancelable?: boolean, detail?: T): void {
			// Boundary: DOM's legacy initializer, which the package's `Event` has.
			(this as unknown as { initEvent: (...args: unknown[]) => void }).initEvent(
				type,
				bubbles,
				cancelable,
			);
			details.set(this, detail ?? null);
		}
	}
	// Boundary: DOM's `CustomEvent`, as TypeScript's DOM library types it.
	return named(CustomEventFill, "CustomEvent") as unknown as CustomEventClass;
}
