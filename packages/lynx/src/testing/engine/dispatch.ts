// The engine's side of events: it delivers an event along the tree, runs the main-thread functions
// bound to it, and reads back the bits that stop it. With `enableEventHandleRefactor`, which every
// page the plugin builds turns on, Lynx delivers both touch and custom events through its event
// dispatcher (core/event/event_dispatcher.cc, EventDispatcher::Dispatch):
//   - first the global phase: every element in the engine's global-bind table for the event, in
//     the order the elements were made, hears it with its global bindings
//     (core/renderer/dom/element.cc, Element::HandleGlobalEvent; the ids are a sorted set). An
//     element enters the table at the flush that finds its `global-bindEvent` filed, and leaves it
//     when it is destroyed (core/renderer/dom/element_manager.cc; fiber_element.cc, ~Element);
//   - then capture, from the page down to the target's parent; then the target itself, its capture
//     bindings first and then the rest in the order they were bound; then bubble, from the
//     target's parent up. A touch event has capture and bubble (core/event/touch_event.cc); a
//     custom event has neither, so only its target hears it, and only its non-capture bindings
//     (core/event/event_listener.cc, EventListener::IsMatchEvent);
//   - an element's bindings run in turn, skipping one removed meanwhile, unless one stops at once;
//     then a stop or a catch among those that ran ends the event (core/event/event_target.cc,
//     EventTarget::DispatchEvent).
// The engine knows nothing of a main-thread function but the value it was handed and one global:
// it calls `runWorklet(value, [event], { source: 1 })` and reads `eventReturnResult` from what that
// returns, bit 1 to stop after this element and bit 2 to stop at once (Element::FiberAddEvent's
// listener; core/renderer/events/touch_event_handler.h, EventResult). `target` and
// `currentTarget` of those events also carry `elementRefptr`, the element itself
// (Element::GetEventTargetInfo).

import { readGlobal } from "../globals.ts";
import { asEngineCall, engineObject } from "./engine-objects.ts";
import { flagsOfOptions, flagsOfType } from "./events.ts";
import type { BindingFlags } from "./events.ts";
import type { ElementState, EngineState } from "./state.ts";
import { elementName, stateOf } from "./state.ts";
import type { LynxElement } from "./types.ts";

/** `RunWorkletType` (touch_event_handler.h): what the engine tells `runWorklet` it is running. */
export const SOURCE_EVENT = 1;
export const SOURCE_GESTURE = 2;
/** `EventResult` (touch_event_handler.h): the bits of `eventReturnResult`. */
const STOP_PROPAGATION = 0x1;
const STOP_IMMEDIATE_PROPAGATION = 0x2;

const GLOBAL_BIND = "global-bindEvent";

/** An event as a test hands it to the engine: its type, and the fields it carries. */
export type EngineEvent = { type: string } & Record<string, unknown>;

/**
 * Runs a main-thread function as the engine does: through whatever the global `runWorklet` is at
 * that moment. Without one nothing runs. The event and the options are the engine's own objects
 * (./engine-objects.ts).
 */
export function runMainThreadFunction(call: {
	value: unknown;
	params: unknown[];
	source: number;
}): { ran: boolean; returned?: unknown } {
	const run = readGlobal("runWorklet");
	if (typeof run !== "function") return { ran: false };
	const params = call.params.map((param, index) =>
		index === 0 && typeof param === "object" && param !== null ? engineObject(param) : param,
	);
	const options = engineObject({ source: call.source });
	return { ran: true, returned: asEngineCall(() => run(call.value, params, options)) };
}

/** A target as Lynx sends it: plain `{ id, uid, dataset }`. */
export function targetInfo(state: ElementState): { id: string; uid: number; dataset: unknown } {
	return { id: state.id ?? "", uid: state.uid, dataset: { ...state.dataset } };
}

/** A target of a main-thread function's event: it also carries the element. */
export function mainThreadTarget(state: ElementState): Record<string, unknown> {
	return { ...targetInfo(state), elementRefptr: state.node };
}

/** An animation's event, as the engine sends it. */
export interface AnimationEvent {
	type: "animationend" | "animationcancel";
	/** The animation's name. */
	name: string;
	/** How long it ran, in seconds. */
	elapsedTime: number;
}

/** What the engine's side of events offers. */
export interface Dispatcher {
	fire(element: LynxElement, event: EngineEvent): void;
	dispatch(element: LynxElement, event: EngineEvent): void;
	/** An animation event as the engine sends it; returns whether it went. */
	animationEvent(state: ElementState, event: AnimationEvent): boolean;
}

/** One binding of an element for one event: its flags, and how the engine runs it. */
interface Binding extends BindingFlags {
	seq: number;
	/** Whether it is still bound: one removed while the event is on its way does not run. */
	bound(): boolean;
	/** Runs it on `current`, for an event on `target`; returns the `eventReturnResult` it read. */
	run(target: ElementState, current: ElementState, event: EngineEvent): number;
}

/** Where an element hears an event. */
type Phase = "global" | "capture" | "target" | "bubble";

/** The `eventReturnResult` of what a main-thread function returned: an object's only. */
function eventReturnResult(returned: unknown): number {
	if (typeof returned !== "object" || returned === null) return 0;
	return Number(Reflect.get(returned, "eventReturnResult")) || 0;
}

/** The engine's side of events, over the engine's records. */
export function createDispatcher(engine: EngineState): Dispatcher {
	/** An element's bindings for the event `name`, in the order they were bound. */
	function bindingsOf(state: ElementState, name: string): Binding[] {
		const bindings: Binding[] = [];
		for (const bound of state.mainThreadEvents) {
			if (bound.eventName !== name) continue;
			bindings.push({
				...flagsOfType(bound.eventType),
				seq: bound.seq,
				bound: () => state.mainThreadEvents.includes(bound),
				run(target, current, event) {
					const { ran, returned } = runMainThreadFunction({
						value: bound.value,
						// The fake gives each function an event of its own. Whether a change one function
						// makes to the event reaches the next on a device is not verified.
						params: [
							{
								...event,
								type: name,
								target: mainThreadTarget(target),
								currentTarget: mainThreadTarget(current),
							},
						],
						source: SOURCE_EVENT,
					});
					if (!ran) return 0;
					const result = eventReturnResult(returned);
					engine.log.mainThreadRuns.push({
						source: "event",
						element: current.node,
						name,
						eventReturnResult: result,
					});
					return result;
				},
			});
		}
		for (const bound of state.handlers) {
			if (bound.eventName !== name) continue;
			bindings.push({
				...flagsOfType(bound.eventType),
				seq: bound.seq,
				bound: () => state.handlers.includes(bound),
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
				bound: () => state.listeners.includes(entry),
				run: (target, current, event) => {
					// Lynx sends a listener's targets as plain { id, uid, dataset }, and the listener a
					// copy of the event (core/runtime/lepus/bindings/event/lepus_event_listener.cc).
					const copy = engineObject({
						...event,
						type: name,
						target: targetInfo(target),
						currentTarget: targetInfo(current),
					});
					asEngineCall(() => entry.listener(copy));
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
		return [
			...own.filter((binding) => binding.capture),
			...own.filter((binding) => !binding.capture),
		];
	}

	/** The elements in the global-bind table for `name`, oldest first. */
	function globalElements(name: string): ElementState[] {
		return [...engine.globalPhase]
			.filter(([state, names]) => names.has(name) && engine.made.has(state.uid))
			.map(([state]) => state)
			.toSorted((a, b) => a.uid - b.uid);
	}

	/**
	 * Delivers an event along the tree as Lynx's event dispatcher does (see the top of this file).
	 * Returns how many bindings ran.
	 */
	function deliver(
		origin: ElementState,
		event: EngineEvent,
		kind: { capture: boolean; bubbles: boolean },
	): number {
		const name = event.type;
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

		engine.enter();
		let ran = 0;
		for (const { state, phase } of visits) {
			let stopped = false;
			let caught = false;
			for (const binding of heard(state, name, phase, kind.capture)) {
				if (!binding.bound()) continue;
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
	function fire(element: LynxElement, event: EngineEvent): void {
		const state = stateOf(engine, { value: element, fn: "fire", index: 0 });
		const ran = deliver(state, event, { capture: false, bubbles: false });
		if (ran === 0) {
			throw new Error(`There is no ${event.type} listener on ${elementName(state)} to fire.`);
		}
	}

	/** Delivers an event the way Lynx does a touch event (`tap`), with capture and bubble. */
	function dispatch(element: LynxElement, event: EngineEvent): void {
		const state = stateOf(engine, { value: element, fn: "dispatch", index: 0 });
		deliver(state, event, { capture: true, bubbles: true });
	}

	/** Whether the element has any binding for `name`, or the name filed for the global phase. */
	function boundTo(state: ElementState, name: string): boolean {
		return (
			state.listeners.some((entry) => entry.name === name) ||
			state.mainThreadEvents.some((bound) => bound.eventName === name) ||
			state.handlers.some((bound) => bound.eventName === name) ||
			state.filedEvents.has(`${GLOBAL_BIND}:${name}`)
		);
	}

	/**
	 * An animation event as the engine sends it (core/animation/animation.cc,
	 * Animation::CreateEventAndSend): only to an element with a binding of its name, of any kind,
	 * with the animation's name, type and time in `params`. Returns whether it went.
	 */
	function animationEvent(state: ElementState, animation: AnimationEvent): boolean {
		if (!boundTo(state, animation.type)) return false;
		deliver(
			state,
			{
				type: animation.type,
				params: {
					animation_name: animation.name,
					animation_type: "keyframe-animation",
					new_animator: true,
					elapsedTime: animation.elapsedTime,
				},
			},
			{ capture: false, bubbles: false },
		);
		return true;
	}

	return { fire, dispatch, animationEvent };
}
