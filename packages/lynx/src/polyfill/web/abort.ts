// `AbortController` and `AbortSignal`: DOM § 3.1 "Interface AbortController" and § 3.2 "Interface
// AbortSignal", with `abort()`, `timeout()`, `any()`, `throwIfAborted()` and `reason`. The main
// thread lacks them; the background has lynx-core's (modules/fetch/AbortController.ts), which is
// no `EventTarget`, has none of the statics and aborts with a plain `Error`. Both threads get these,
// over the thread's `EventTarget`, where the thread's own fails the check. lynx-core's `fetch`
// reads only `aborted`, `reason` and `addEventListener("abort", …)` of the signal it is given
// (lynx/lynx.ts, `fetch`), which these have. Leaves out nothing.

import type { Scope } from "../globals.ts";
import { readTimers } from "../globals.ts";
import { holds, installLazy, named } from "../install.ts";
import { domException } from "./dom-exception.ts";
import { eventHandlerProperty } from "./event-handlers.ts";
import type {
	AbortControllerClass,
	AbortSignalClass,
	EventClass,
	EventTargetClass,
} from "./standard-classes.ts";

/** @workaround web-abort-signal kind=lynx-gap delete-when="Lynx's threads have AbortController and an AbortSignal with any, timeout and abort, aborting with a DOMException" */
export function fillAbort(scope: Scope): void {
	if (works(scope)) return;
	let made: ReturnType<typeof createAbort> | undefined;
	const make = () => (made ??= createAbort(scope));
	installLazy(scope, "AbortSignal", () => make().AbortSignal, never);
	installLazy(scope, "AbortController", () => make().AbortController, never);
}

const never = (): boolean => false;

/** Whether the thread's own pair has the standard's statics and aborts with a `DOMException`. */
function works(scope: Scope): boolean {
	// Boundary: the thread's own, checked as the standard ones.
	const Signal = scope["AbortSignal"] as AbortSignalClass | undefined;
	const Controller = scope["AbortController"] as AbortControllerClass | undefined;
	return (
		typeof Signal === "function" &&
		typeof Controller === "function" &&
		typeof Signal.any === "function" &&
		typeof Signal.timeout === "function" &&
		holds(() => {
			const controller = new Controller();
			controller.abort();
			// A `DOMException` of any realm (an engine's, or this folder's): its name and legacy code.
			const aborted = (reason: unknown): boolean =>
				(reason as DOMException | undefined)?.name === "AbortError" &&
				(reason as DOMException).code === 20;
			return (
				aborted(controller.signal.reason) &&
				aborted(Signal.abort().reason) &&
				typeof controller.signal.dispatchEvent === "function"
			);
		})
	);
}

/** What a signal holds: its reason once aborted, and the signals of `any` that follow it. */
interface SignalState {
	aborted: boolean;
	reason: unknown;
	/** Whether `any` made it: it follows its sources, and is never another's source. */
	dependent: boolean;
	sources: Set<AbortSignal>;
	dependents: Set<AbortSignal>;
}

/** The thread's `AbortController` and `AbortSignal`, over its `EventTarget`. */
export function createAbort(scope: Scope): {
	AbortController: AbortControllerClass;
	AbortSignal: AbortSignalClass;
} {
	// Boundary: the thread's `EventTarget` and `Event`, this folder's or an engine's.
	const Base = scope["EventTarget"] as EventTargetClass;
	const EventClass = scope["Event"] as EventClass;
	const states = new WeakMap<object, SignalState>();
	let creating = false;
	const stateOf = (signal: unknown): SignalState => {
		const state = typeof signal === "object" && signal !== null ? states.get(signal) : undefined;
		if (!state) throw new TypeError("Illegal invocation: not an AbortSignal.");
		return state;
	};

	/** DOM's "signal abort": the signal's reason, its followers' too, then each one's event. */
	const signalAbort = (signal: AbortSignal, reason: unknown): void => {
		const state = stateOf(signal);
		if (state.aborted) return;
		state.aborted = true;
		state.reason =
			reason === undefined
				? domException(scope, "This operation was aborted.", "AbortError")
				: reason;
		const followers: AbortSignal[] = [];
		for (const dependent of state.dependents) {
			const followed = stateOf(dependent);
			if (followed.aborted) continue;
			followed.aborted = true;
			followed.reason = state.reason;
			followers.push(dependent);
		}
		for (const each of [signal, ...followers]) each.dispatchEvent(new EventClass("abort"));
	};

	const newSignal = (): AbortSignal => {
		creating = true;
		try {
			// Boundary: the class below, as TypeScript's DOM library types it.
			return new AbortSignalFill() as unknown as AbortSignal;
		} finally {
			creating = false;
		}
	};

	class AbortSignalFill extends Base {
		constructor() {
			if (!creating)
				throw new TypeError("AbortSignal can't be constructed: make one with an AbortController.");
			super();
			states.set(this, {
				aborted: false,
				reason: undefined,
				dependent: false,
				sources: new Set(),
				dependents: new Set(),
			});
		}

		static abort(reason?: unknown): AbortSignal {
			const signal = newSignal();
			signalAbort(signal, reason);
			return signal;
		}

		static timeout(milliseconds: number): AbortSignal {
			const delay = Number(milliseconds);
			if (!Number.isFinite(delay) || delay < 0 || delay > Number.MAX_SAFE_INTEGER)
				throw new TypeError("AbortSignal.timeout takes a number of milliseconds from 0.");
			const signal = newSignal();
			readTimers().setTimeout(() => {
				signalAbort(signal, domException(scope, "The operation timed out.", "TimeoutError"));
			}, delay);
			return signal;
		}

		static any(signals: Iterable<AbortSignal>): AbortSignal {
			const list = [...signals];
			for (const each of list) stateOf(each);
			const signal = newSignal();
			const state = stateOf(signal);
			state.dependent = true;
			const aborted = list.find((each) => stateOf(each).aborted);
			if (aborted) {
				signalAbort(signal, stateOf(aborted).reason);
				return signal;
			}
			for (const each of list) {
				const source = stateOf(each);
				for (const root of source.dependent ? source.sources : [each]) {
					state.sources.add(root);
					stateOf(root).dependents.add(signal);
				}
			}
			return signal;
		}

		get aborted(): boolean {
			return stateOf(this).aborted;
		}

		get reason(): unknown {
			return stateOf(this).reason;
		}

		throwIfAborted(): void {
			const state = stateOf(this);
			if (state.aborted) throw state.reason;
		}
	}
	Object.defineProperty(AbortSignalFill.prototype, "onabort", eventHandlerProperty("abort"));

	const signals = new WeakMap<object, AbortSignal>();

	class AbortControllerFill {
		constructor() {
			signals.set(this, newSignal());
		}

		get signal(): AbortSignal {
			const signal = signals.get(this);
			if (!signal) throw new TypeError("Illegal invocation: not an AbortController.");
			return signal;
		}

		abort(reason?: unknown): void {
			signalAbort(this.signal, reason);
		}
	}

	return {
		// Boundary: the classes above, as TypeScript's DOM library types them.
		AbortController: named(
			AbortControllerFill,
			"AbortController",
		) as unknown as AbortControllerClass,
		AbortSignal: named(AbortSignalFill, "AbortSignal") as unknown as AbortSignalClass,
	};
}
