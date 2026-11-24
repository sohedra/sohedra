// The global object as an `EventTarget`: WinterTC's Minimum Common API § 6 "The global scope", with
// HTML § 8.1.4.6 "Runtime script errors" (`ErrorEvent`, "report an exception", `reportError`). Both
// threads lack them. Each error a fill catches, and each `reportError`, is an `error` event here
// before it is reported (errors.ts); `preventDefault()` on it, or `true` from `onerror`, keeps it
// from the report.
//
// Leaves out: an event's `target` is the global object's own target, not the global object itself
// (an engine's global object can't be made an `EventTarget` after the fact); no `filename`,
// `lineno` or `colno`, which the engine does not give; and the `unhandledrejection` and
// `rejectionhandled` events with their `on…` handlers: neither thread tells JavaScript about a
// rejection nobody handled (lynx-core sends the background's to the host, app/app.ts
// `setupPromise`; the main thread's engine reports its own), and WinterTC § 6 says a runtime that
// can't fire them must not offer the handlers. `PromiseRejectionEvent` is there, for code that makes
// its own.

import { reportCaught, setErrorDispatch } from "../errors.ts";
import type { Scope } from "../globals.ts";
import { installEager, installLazy, named } from "../install.ts";
import { eventHandlerProperty } from "./event-handlers.ts";
import type { Listening } from "./event-handlers.ts";
import type {
	ErrorEventClass,
	EventClass,
	EventTargetClass,
	PromiseRejectionEventClass,
} from "./standard-classes.ts";

/** @workaround web-global-events kind=lynx-gap delete-when="Lynx's threads have a global object that is an EventTarget and fires error events" */
export function fillGlobalEvents(scope: Scope): void {
	installLazy(scope, "ErrorEvent", () => createErrorEvent(scope), isFunction);
	installLazy(scope, "PromiseRejectionEvent", () => createPromiseRejectionEvent(scope), isFunction);
	installLazy(scope, "reportError", () => reportError, isFunction);
	if (typeof scope["addEventListener"] === "function") return;
	let target: EventTarget | undefined;
	const targetOf = (): EventTarget =>
		// Boundary: the thread's `EventTarget`, this folder's or an engine's.
		(target ??= new (scope["EventTarget"] as EventTargetClass)());
	installEager(
		scope,
		"addEventListener",
		function addEventListener(...args: Parameters<EventTarget["addEventListener"]>): void {
			targetOf().addEventListener(...args);
		},
	);
	installEager(
		scope,
		"removeEventListener",
		function removeEventListener(...args: Parameters<EventTarget["removeEventListener"]>): void {
			targetOf().removeEventListener(...args);
		},
	);
	installEager(scope, "dispatchEvent", function dispatchEvent(event: Event): boolean {
		return targetOf().dispatchEvent(event);
	});
	// Boundary: the global object's target, which has what an attribute listens with.
	const listening = { targetOf: () => targetOf() as unknown as Listening };
	if (!("onerror" in scope))
		Object.defineProperty(scope, "onerror", {
			...eventHandlerProperty("error", { ...listening, kind: "error" }),
			enumerable: false,
		});
	setErrorDispatch((error) => {
		// Boundary: the thread's `ErrorEvent`, this fill's or an engine's.
		const ErrorEventClass = scope["ErrorEvent"] as ErrorEventClass;
		const event = new ErrorEventClass("error", {
			cancelable: true,
			error,
			message: messageOf(error),
		});
		targetOf().dispatchEvent(event);
		return !event.defaultPrevented;
	});
}

const isFunction = (existing: unknown): boolean => typeof existing === "function";

/** HTML's `reportError`: reports `error` as an exception, as if a callback had thrown it. */
function reportError(...args: unknown[]): void {
	if (args.length === 0) throw new TypeError("reportError takes 1 argument, and none was given.");
	reportCaught(args[0]);
}

/**
 * What an error says, as a browser's report does: `Uncaught`, then the error's name and message, or
 * the value. Read from data properties only: HTML's "report an exception" runs no code of the
 * value's, so a getter is never called.
 */
function messageOf(error: unknown): string {
	try {
		if ((typeof error === "object" && error !== null) || typeof error === "function") {
			const name = dataOf(error, "name");
			const message = dataOf(error, "message");
			const text = [name, message].filter((part) => part !== "").join(": ");
			return `Uncaught ${text === "" ? "exception" : text}`;
		}
		return `Uncaught ${typeof error === "symbol" ? error.toString() : `${error as string}`}`;
	} catch {
		return "Uncaught exception";
	}
}

/** A string data property of `value` or its prototypes, without calling a getter; else `""`. */
function dataOf(value: object, key: string): string {
	for (let owner: object | null = value; owner !== null; owner = Object.getPrototypeOf(owner)) {
		const descriptor = Object.getOwnPropertyDescriptor(owner, key);
		if (descriptor) return typeof descriptor.value === "string" ? descriptor.value : "";
	}
	return "";
}

/** HTML's `ErrorEvent`, an `Event` of the thread's. */
export function createErrorEvent(scope: Scope): ErrorEventClass {
	// Boundary: the thread's `Event`, this folder's or an engine's.
	const Base = scope["Event"] as EventClass;
	const fields = new WeakMap<object, Required<Omit<ErrorEventInit, keyof EventInit>>>();
	class ErrorEventFill extends Base {
		constructor(type: string, init: ErrorEventInit = {}) {
			super(type, init);
			fields.set(this, {
				message: init.message === undefined ? "" : `${init.message}`,
				filename: init.filename === undefined ? "" : `${init.filename}`,
				lineno: init.lineno === undefined ? 0 : init.lineno >>> 0,
				colno: init.colno === undefined ? 0 : init.colno >>> 0,
				error: init.error,
			});
		}

		get message(): string {
			return fields.get(this)!.message;
		}

		get filename(): string {
			return fields.get(this)!.filename;
		}

		get lineno(): number {
			return fields.get(this)!.lineno;
		}

		get colno(): number {
			return fields.get(this)!.colno;
		}

		get error(): unknown {
			return fields.get(this)!.error;
		}
	}
	return named(ErrorEventFill, "ErrorEvent") as unknown as ErrorEventClass;
}

/** HTML's `PromiseRejectionEvent`, an `Event` of the thread's. */
export function createPromiseRejectionEvent(scope: Scope): PromiseRejectionEventClass {
	// Boundary: the thread's `Event`, this folder's or an engine's.
	const Base = scope["Event"] as EventClass;
	const fields = new WeakMap<object, { promise: Promise<unknown>; reason: unknown }>();
	class PromiseRejectionEventFill extends Base {
		constructor(type: string, init: PromiseRejectionEventInit) {
			if (typeof init !== "object" || init === null || typeof init.promise !== "object")
				throw new TypeError("PromiseRejectionEvent takes a promise in its second argument.");
			super(type, init);
			fields.set(this, { promise: init.promise, reason: init.reason });
		}

		get promise(): Promise<unknown> {
			return fields.get(this)!.promise;
		}

		get reason(): unknown {
			return fields.get(this)!.reason;
		}
	}
	return named(
		PromiseRejectionEventFill,
		"PromiseRejectionEvent",
	) as unknown as PromiseRejectionEventClass;
}
