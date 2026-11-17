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

/** The types of `__AddEvent` that Lynx knows (core/renderer/events/events.h). */
const EVENT_TYPES = [
	"bindEvent",
	"catchEvent",
	"capture-bind",
	"capture-catch",
	"global-bindEvent",
];

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
			const state = stateOf(engine, { value: element, fn: "__AddEvent", index: 0 });
			if (typeof eventType !== "string")
				throw argumentError({ fn: "__AddEvent", index: 1, expected: "text" });
			if (typeof eventName !== "string")
				throw argumentError({ fn: "__AddEvent", index: 2, expected: "text" });
			// Lynx takes any other type as a bubble binding (GetEventListenerOptions); a typo there
			// is a mistake in the page.
			if (!EVENT_TYPES.includes(eventType)) {
				throw new Error(
					`__AddEvent was given the type ${eventType}, which Lynx does not know and takes as ` +
						`bindEvent. Use one of ${EVENT_TYPES.join(", ")}.`,
				);
			}
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
				throw argumentError({
					fn: "__AddEvent",
					index: 3,
					expected: "a main-thread function, a handler name or none",
				});
			}
			engine.log.workletEvents.push({
				element: state.node,
				eventType,
				eventName,
				value: recorded(value),
			});
			if (Reflect.get(value, "type") !== "worklet") {
				throw new Error(
					`__AddEvent was given a handler for ${eventType} ${eventName} that is not ` +
						'{ type: "worklet", value }. Lynx logs a warning and binds nothing.',
				);
			}
			// One function per event name and type: bound again, it goes to the end.
			state.filedEvents.add(key);
			unbindFunction();
			const worklet: unknown = Reflect.get(value, "value");
			if (worklet == null) return;
			state.mainThreadEvents.push({
				eventType,
				eventName,
				value: worklet,
				seq: engine.nextBinding++,
			});
		},
		__AddEventListener(element, name, listener, options) {
			const state = stateOf(engine, { value: element, fn: "__AddEventListener", index: 0 });
			if (typeof name !== "string")
				throw argumentError({ fn: "__AddEventListener", index: 1, expected: "text" });
			if (typeof options !== "object" || options === null) {
				throw argumentError({ fn: "__AddEventListener", index: 3, expected: "an object" });
			}
			state.listeners.push({ name, listener, options, seq: engine.nextBinding++ });
		},
		__RemoveEventListener(element, name, listener, options) {
			const state = stateOf(engine, { value: element, fn: "__RemoveEventListener", index: 0 });
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
