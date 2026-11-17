// Events the page binds on its elements: main-thread functions with `__AddEvent`, and plain
// listeners with `__AddEventListener`. The engine's side that sends them is in dispatch.ts.

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

/** Whether two listeners' options say the same: the engine compares what they say, not the object. */
function sameOptions(a: ListenerOptions | undefined, b: ListenerOptions | undefined): boolean {
	return (
		Boolean(a?.capture) === Boolean(b?.capture) &&
		a?.closure_type === b?.closure_type &&
		a?.bind_type === b?.bind_type
	);
}

/** The functions that bind events, over the engine's records. */
export function eventFunctions(engine: EngineState): EventFunctions {
	return {
		__AddEvent(element, eventType, eventName, value) {
			const state = stateOf(engine, element, "__AddEvent", 0);
			const key = `${eventType}:${eventName}`;
			// One listener per event name and type; an empty value removes it
			// (core/renderer/dom/fiber/fiber_element.cc, Element::FiberAddEvent, with the page's
			// `enableEventHandleRefactor`).
			const unbind = (): void => {
				state.mainThreadEvents = state.mainThreadEvents.filter(
					(bound) => bound.eventName !== eventName || bound.eventType !== eventType,
				);
			};
			// A handler name (a string) files the type, and the engine adds a listener that sends
			// the event to the background by that name: none here. Empty, it only files the type.
			if (typeof value === "string") {
				engine.log.filings.push({ element: state.node, eventType, eventName, value });
				unbind();
				state.filedEvents.add(key);
				return;
			}
			if (value != null && (typeof value !== "object" || Array.isArray(value))) {
				throw argumentError("__AddEvent", 3, "a main-thread function, a handler name or none");
			}
			if (value == null) {
				engine.log.filings.push({ element: state.node, eventType, eventName, value });
				state.filedEvents.delete(key);
			}
			engine.log.workletEvents.push({
				element: state.node,
				eventType,
				eventName,
				value: recorded(value),
			});
			unbind();
			if (value == null) return;
			const handler = value as { type?: unknown; value?: unknown };
			if (handler.type !== "worklet") {
				throw new Error(
					`__AddEvent was given a handler for ${eventType} ${eventName} that is not ` +
						'{ type: "worklet", value }. Lynx logs a warning and binds nothing.',
				);
			}
			state.filedEvents.delete(key);
			state.mainThreadEvents.push({ eventType, eventName, value: handler.value });
		},
		__AddEventListener(element, name, listener, options) {
			stateOf(engine, element, "__AddEventListener", 0).listeners.push({
				name,
				listener,
				options,
			});
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
