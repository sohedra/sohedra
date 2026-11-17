// The engine's side of events: it delivers an event along the tree, runs the main-thread functions
// bound to it, and reads back the bits that stop it. With `enableEventHandleRefactor`, which every
// page the plugin builds turns on, Lynx delivers both touch and custom events through its event
// dispatcher (core/event/event_dispatcher.cc, EventDispatcher::Dispatch):
//   - first the global phase: every element whose data model has the event's `global-bindEvent`
//     filed, in the order the elements were made, hears it with its global bindings
//     (core/renderer/dom/element.cc, Element::HandleGlobalEvent; the ids are a sorted set);
//   - then capture, from the page down to the target's parent; then the target itself, its capture
//     bindings first and then the rest in the order they were bound; then bubble, from the
//     target's parent up. A touch event has capture and bubble (core/event/touch_event.cc); a
//     custom event has neither, so only its target hears it, and only its non-capture bindings
//     (core/event/event_listener.cc, EventListener::IsMatchEvent);
//   - an element's bindings all run unless one stops at once; then a stop or a catch among those
//     that ran ends the event (core/event/event_target.cc, EventTarget::DispatchEvent).
// The engine knows nothing of a main-thread function but the value it was handed and one global:
// it calls `runWorklet(value, [event], { source: 1 })` and reads `eventReturnResult` from what that
// returns, bit 1 to stop after this element and bit 2 to stop at once (Element::FiberAddEvent's
// listener; core/renderer/events/touch_event_handler.h, EventResult). `target` and
// `currentTarget` of those events also carry `elementRefptr`, the element itself
// (Element::GetEventTargetInfo).

import { readGlobal } from "../globals.ts";
import { flagsOfOptions, flagsOfType } from "./events.ts";
import type { BindingFlags } from "./events.ts";
import type { BoundFunction, ElementState, EngineState } from "./state.ts";
import { elementName, stateOf } from "./state.ts";
import type { LynxElement } from "./types.ts";

/** `RunWorkletType` (touch_event_handler.h): what the engine tells `runWorklet` it is running. */
export const SOURCE_EVENT = 1;
export const SOURCE_GESTURE = 2;
/** `EventResult` (touch_event_handler.h): the bits of `eventReturnResult`. */
const STOP_PROPAGATION = 0x1;
const STOP_IMMEDIATE_PROPAGATION = 0x2;

const GLOBAL_BIND = "global-bindEvent";

type RunWorklet = (value: unknown, params: unknown[], options: { source: number }) => unknown;

/**
 * Runs a main-thread function as the engine does: through whatever the global `runWorklet` is at
 * that moment. Without one nothing runs.
 */
export function runMainThreadFunction(
	value: unknown,
	params: unknown[],
	source: number,
): { ran: boolean; returned?: unknown } {
	// Boundary: `runWorklet` is installed by the page's own runtime, which this fake does not know.
	const run = readGlobal("runWorklet") as RunWorklet | undefined;
	if (typeof run !== "function") return { ran: false };
	return { ran: true, returned: run(value, params, { source }) };
}

/** A target as Lynx sends it: plain `{ id, uid, dataset }`. */
export function targetInfo(state: ElementState): { id: string; uid: number; dataset: unknown } {
	return { id: state.id ?? "", uid: state.uid, dataset: { ...state.dataset } };
}

/** A target of a main-thread function's event: it also carries the element. */
export function mainThreadTarget(state: ElementState): Record<string, unknown> {
	return { ...targetInfo(state), elementRefptr: state.node };
}

/** What the engine's side of events offers. */
export interface Dispatcher {
	fire(element: LynxElement, name: string, event?: Record<string, unknown>): void;
	dispatch(element: LynxElement, name: string, event?: Record<string, unknown>): void;
	/** An animation event as the engine sends it; returns whether it went. */
	animationEvent(
		state: ElementState,
		type: "animationend" | "animationcancel",
		name: string,
	): boolean;
}

/** One binding of an element for one event: its flags, and how the engine runs it. */
interface Binding extends BindingFlags {
	seq: number;
	/** Runs it on `current`, for an event on `target`; returns the `eventReturnResult` it read. */
	run(target: ElementState, current: ElementState, event: Record<string, unknown>): number;
}

/** Where an element hears an event. */
type Phase = "global" | "capture" | "target" | "bubble";

/** The engine's side of events, over the engine's records. */
export function createDispatcher(engine: EngineState): Dispatcher {
	/** Runs the main-thread function bound to an event; returns the `eventReturnResult` it read. */
	function runBound(
		bound: BoundFunction,
		target: ElementState,
		currentTarget: ElementState,
		event: Record<string, unknown>,
	): number {
		const { ran, returned } = runMainThreadFunction(
			bound.value,
			// A new event for each function, as the engine builds one per call.
			[
				{
					type: bound.eventName,
					target: mainThreadTarget(target),
					currentTarget: mainThreadTarget(currentTarget),
					...event,
				},
			],
			SOURCE_EVENT,
		);
		if (!ran) return 0;
		// Only an object's `eventReturnResult` counts.
		const result =
			typeof returned === "object" && returned !== null
				? Number((returned as { eventReturnResult?: unknown }).eventReturnResult) || 0
				: 0;
		engine.log.mainThreadRuns.push({
			source: "event",
			element: currentTarget.node,
			name: bound.eventName,
			eventReturnResult: result,
		});
		return result;
	}

	/** An element's bindings for the event `name`, in the order they were bound. */
	function bindingsOf(state: ElementState, name: string): Binding[] {
		const bindings: Binding[] = [];
		for (const bound of state.mainThreadEvents) {
			if (bound.eventName !== name) continue;
			bindings.push({
				...flagsOfType(bound.eventType),
				seq: bound.seq,
				run: (target, current, event) => runBound(bound, target, current, event),
			});
		}
		for (const bound of state.handlers) {
			if (bound.eventName !== name) continue;
			bindings.push({
				...flagsOfType(bound.eventType),
				seq: bound.seq,
				run: (_target, current) => {
					engine.log.backgroundEvents.push({
						element: current.node,
						eventType: bound.eventType,
						eventName: name,
						handler: bound.handler,
					});
					return 0;
				},
			});
		}
		for (const entry of state.listeners) {
			if (entry.name !== name) continue;
			bindings.push({
				...flagsOfOptions(entry.options),
				seq: entry.seq,
				run: (target, current, event) => {
					// Lynx sends a listener's targets as plain { id, uid, dataset }.
					entry.listener({
						type: name,
						target: targetInfo(target),
						currentTarget: targetInfo(current),
						...event,
					});
					return 0;
				},
			});
		}
		return bindings.toSorted((a, b) => a.seq - b.seq);
	}

	/** The bindings of an element that hear an event in `phase`, in the order they run. */
	function heard(state: ElementState, name: string, phase: Phase, capturing: boolean): Binding[] {
		const all = bindingsOf(state, name);
		if (phase === "global") return all.filter((binding) => binding.global);
		const local = all.filter((binding) => !binding.global);
		if (phase === "capture") return local.filter((binding) => binding.capture);
		if (phase === "bubble") return local.filter((binding) => !binding.capture);
		const own = local.filter((binding) => capturing || !binding.capture);
		return [...own.filter((binding) => binding.capture), ...own.filter((b) => !b.capture)];
	}

	/** The elements that hear the global phase of `name`: the ones with it filed, oldest first. */
	function globalElements(name: string): ElementState[] {
		return [...engine.made.values()]
			.filter((state) => state.filedEvents.has(`${GLOBAL_BIND}:${name}`))
			.toSorted((a, b) => a.uid - b.uid);
	}

	/**
	 * Delivers an event along the tree as Lynx's event dispatcher does (see the top of this file).
	 * Returns how many bindings ran.
	 */
	function deliver(
		origin: ElementState,
		name: string,
		event: Record<string, unknown>,
		kind: { capture: boolean; bubbles: boolean },
	): number {
		const path: ElementState[] = [];
		for (let node: Node | null = origin.node; node; node = node.parentNode) {
			const state = engine.states.get(node);
			if (!state) break;
			path.push(state);
		}
		const visits: { state: ElementState; phase: Phase }[] = [
			...globalElements(name).map((state) => ({ state, phase: "global" as const })),
			...(kind.capture
				? path
						.slice(1)
						.toReversed()
						.map((state) => ({ state, phase: "capture" as const }))
				: []),
			{ state: origin, phase: "target" },
			...(kind.bubbles ? path.slice(1).map((state) => ({ state, phase: "bubble" as const })) : []),
		];

		let ran = 0;
		for (const { state, phase } of visits) {
			let stopped = false;
			let caught = false;
			for (const binding of heard(state, name, phase, kind.capture)) {
				ran++;
				caught ||= binding.catches;
				const result = binding.run(origin, state, event);
				if (result & (STOP_PROPAGATION | STOP_IMMEDIATE_PROPAGATION)) stopped = true;
				if (result & STOP_IMMEDIATE_PROPAGATION) break;
			}
			if (phase === "global") {
				if (stopped) {
					throw new Error(
						`A global-bind function stopped the ${name} event on ${elementName(state)}. ` +
							"What Lynx does with a stop in its global phase is not verified, so the engine " +
							"fake does not guess.",
					);
				}
				continue;
			}
			if (stopped || caught) break;
		}
		return ran;
	}

	/**
	 * Fires an event the way Lynx does a custom event (`scroll`, `load`), at this element: the
	 * global phase, then the element's own non-capture bindings
	 * (core/renderer/events/touch_event_handler.cc, HandleCustomEvent). Throws when nothing hears
	 * it, which is a test's mistake.
	 */
	function fire(element: LynxElement, name: string, event: Record<string, unknown> = {}): void {
		const state = stateOf(engine, element, "fire", 0);
		const ran = deliver(state, name, event, { capture: false, bubbles: false });
		if (ran === 0)
			throw new Error(`There is no ${name} listener on ${elementName(state)} to fire.`);
	}

	/** Delivers an event the way Lynx does a touch event (`tap`), with capture and bubble. */
	function dispatch(element: LynxElement, name: string, event: Record<string, unknown> = {}): void {
		deliver(stateOf(engine, element, "dispatch", 0), name, event, { capture: true, bubbles: true });
	}

	/**
	 * An animation event as the engine sends it (core/animation/animation.cc,
	 * Animation::CreateEventAndSend): only to an element that listens for it, with the animation's
	 * name and type in `params`. Returns whether it went.
	 */
	function animationEvent(
		state: ElementState,
		type: "animationend" | "animationcancel",
		name: string,
	): boolean {
		if (!state.listeners.some((entry) => entry.name === type)) return false;
		fire(state.node, type, {
			params: { animation_name: name, animation_type: "keyframe-animation", new_animator: true },
		});
		return true;
	}

	return { fire, dispatch, animationEvent };
}
