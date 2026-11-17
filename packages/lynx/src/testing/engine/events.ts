// Events the page binds on its elements: main-thread functions and handler names with
// `__AddEvent`, and listeners with `__AddEventListener`. With `enableEventHandleRefactor`, which
// every page the plugin builds turns on, each is a listener in one list per element and event
// name, in the order it was bound (core/renderer/dom/fiber/fiber_element.cc, Element::FiberAddEvent;
// core/runtime/lepus/bindings/renderer_functions.cc, FiberAddEventListener). The engine's side
// that sends them is in dispatch.ts.

import { argumentError, elementName, stateOf } from "./state.ts";
import type { EngineState } from "./state.ts";
import type { LynxElement, ListenerFunction, ListenerOptions } from "./types.ts";

/** The functions that bind events. */
export interface EventFunctions {
	__AddEvent(element: LynxElement, eventType: string, eventName: string, value: unknown): void;
	__AddEventListener(
		element: LynxElement,
		name: string,
		listener: ListenerFunction,
		options: ListenerOptions,
	): void;
	__RemoveEventListener(
		element: LynxElement,
		name: string,
		listener: ListenerFunction,
		options: ListenerOptions,
	): void;
}

/** What a binding asks of the engine: the flags of Lynx's `EventListener::Options`. */
export interface BindingFlags {
	capture: boolean;
	catches: boolean;
	global: boolean;
}

/** The flags of an `__AddEvent` type (core/renderer/events/events.h, GetEventListenerOptions). */
export function flagsOfType(eventType: string): BindingFlags {
	return {
		capture: eventType === "capture-bind" || eventType === "capture-catch",
		catches: eventType === "catchEvent" || eventType === "capture-catch",
		global: eventType === "global-bindEvent",
	};
}

/**
 * The flags of a listener's options (FiberAddEventListener): `bind_type` sets capture and catch
 * only with `closure_type` 2, a closure of the page's own; otherwise the listener honors
 * `capture` and never catches. `bind_type` 5 makes it global either way.
 */
export function flagsOfOptions(options: ListenerOptions | undefined): BindingFlags {
	const type = options?.bind_type ?? 1;
	const global = type === 5;
	if (options?.closure_type !== 2)
		return { capture: Boolean(options?.capture), catches: false, global };
	return { capture: type === 2 || type === 3, catches: type === 3 || type === 4, global };
}

/**
 * What a log keeps of a value the engine was handed: a copy, as it was then. The engine's own
 * value changes when its function runs, and a log that held it would keep it from being
 * collected once the engine lets go.
 */
export function recorded<T>(value: T): T {
	try {
		return structuredClone(value);
	} catch {
		return value;
	}
}

/** Whether two listeners' options say the same to the engine: it compares their flags. */
function sameOptions(a: ListenerOptions | undefined, b: ListenerOptions | undefined): boolean {
	const one = flagsOfOptions(a);
	const other = flagsOfOptions(b);
	return (
		one.capture === other.capture &&
		one.catches === other.catches &&
		one.global === other.global &&
		(a?.closure_type === 2) === (b?.closure_type === 2)
	);
}

/** The functions that bind events, over the engine's records. */
export function eventFunctions(engine: EngineState): EventFunctions {
	return {
		__AddEvent(element, eventType, eventName, value) {
			const state = stateOf(engine, element, "__AddEvent", 0);
			if (typeof eventType !== "string") throw argumentError("__AddEvent", 1, "text");
			if (typeof eventName !== "string") throw argumentError("__AddEvent", 2, "text");
			const key = `${eventType}:${eventName}`;
			const same = (bound: { eventType: string; eventName: string }): boolean =>
				bound.eventName === eventName && bound.eventType === eventType;
			const unbindFunction = (): void => {
				state.mainThreadEvents = state.mainThreadEvents.filter((bound) => !same(bound));
			};
			const unbindHandler = (): void => {
				state.handlers = state.handlers.filter((bound) => !same(bound));
			};

			// None: the data model forgets the event, and both kinds of binding go.
			if (value == null) {
				engine.log.filings.push({ element: state.node, eventType, eventName, value });
				engine.log.workletEvents.push({ element: state.node, eventType, eventName, value });
				state.filedEvents.delete(key);
				unbindFunction();
				unbindHandler();
				return;
			}
			// A handler name: the data model files the event, and a binding sends the event to the
			// background by that name. Empty, it only files it. A main-thread function stays bound.
			if (typeof value === "string") {
				engine.log.filings.push({ element: state.node, eventType, eventName, value });
				state.filedEvents.add(key);
				unbindHandler();
				if (value !== "") {
					state.handlers.push({ eventType, eventName, handler: value, seq: engine.nextBinding++ });
				}
				return;
			}
			if (typeof value !== "object" || Array.isArray(value)) {
				throw argumentError("__AddEvent", 3, "a main-thread function, a handler name or none");
			}
			engine.log.workletEvents.push({
				element: state.node,
				eventType,
				eventName,
				value: recorded(value),
			});
			const handler = value as { type?: unknown; value?: unknown };
			if (handler.type !== "worklet") {
				throw new Error(
					`__AddEvent was given a handler for ${eventType} ${eventName} that is not ` +
						'{ type: "worklet", value }. Lynx logs a warning and binds nothing.',
				);
			}
			// One function per event name and type: bound again, it goes to the end.
			state.filedEvents.add(key);
			unbindFunction();
			if (handler.value == null) return;
			state.mainThreadEvents.push({
				eventType,
				eventName,
				value: handler.value,
				seq: engine.nextBinding++,
			});
		},
		__AddEventListener(element, name, listener, options) {
			const state = stateOf(engine, element, "__AddEventListener", 0);
			if (typeof name !== "string") throw argumentError("__AddEventListener", 1, "text");
			if (typeof options !== "object" || options === null) {
				throw argumentError("__AddEventListener", 3, "an object");
			}
			state.listeners.push({ name, listener, options, seq: engine.nextBinding++ });
		},
		__RemoveEventListener(element, name, listener, options) {
			const state = stateOf(engine, element, "__RemoveEventListener", 0);
			const index = state.listeners.findIndex(
				(entry) =>
					entry.name === name && entry.listener === listener && sameOptions(entry.options, options),
			);
			if (index === -1) {
				throw new Error(
					`__RemoveEventListener found no ${name} listener on ${elementName(state)} to remove. ` +
						"Lynx does nothing; a second removal is a mistake in the page.",
				);
			}
			state.listeners.splice(index, 1);
		},
	};
}
