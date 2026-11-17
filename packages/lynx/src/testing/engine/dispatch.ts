// The engine's side of events: it delivers an event along the tree, runs the main-thread
// functions bound to it, and reads back the bits that stop it. Main-thread functions run as the
// engine runs them (lynx-family/lynx, the same at tags 3.9.1 and 4.2.0). The engine knows nothing
// of a main-thread function but the value it was handed and one global:
//   - an event bound with `__AddEvent(el, type, name, { type: "worklet", value })` calls
//     `runWorklet(value, [event], { source: 1 })` and reads `eventReturnResult` from what that
//     returns: bit 1 stops the event after the listeners of this element and phase, bit 2 at once
//     (core/renderer/dom/fiber/fiber_element.cc, Element::FiberAddEvent;
//     core/renderer/events/touch_event_handler.cc, FireElementWorklet and
//     HandleEventOperations);
//   - `target` and `currentTarget` of those events also carry `elementRefptr`, the element itself
//     (touch_event_handler.cc, GetTargetInfo);
//   - a `global-bind` listener (`__AddEventListener` with `closure_type: 2`, `bind_type: 5`) is
//     heard in the engine's global phase only: for an event on any element, and only on an
//     element that has the type filed too, which `__AddEvent(el, "global-bindEvent", name,
//     handlerName)` does (Element::FiberAddEvent files it, ElementManager::ResolveEvents then
//     enters the element in the table that Element::HandleGlobalEvent reads). The listener alone
//     is heard for no event at all (FiberAddEventListener files its handler with an empty type).

import { readGlobal } from "../globals.ts";
import type { BoundFunction, ElementState, EngineState, RegisteredListener } from "./state.ts";
import { elementName } from "./state.ts";
import { descendantsOf } from "./tree.ts";
import type { ListenerOptions, LynxElement } from "./types.ts";

/** `RunWorkletType` (touch_event_handler.h): what the engine tells `runWorklet` it is running. */
export const SOURCE_EVENT = 1;
export const SOURCE_GESTURE = 2;
/** `EventResult` (touch_event_handler.h): the bits of `eventReturnResult`. */
const STOP_PROPAGATION = 0x1;
const STOP_IMMEDIATE_PROPAGATION = 0x2;

const GLOBAL_BIND = "global-bindEvent";
const CAPTURE_TYPES = new Set(["capture-bind", "capture-catch"]);
const CATCH_TYPES = new Set(["catchEvent", "capture-catch"]);

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

/** One call the engine makes for an event; `run` returns its `eventReturnResult`. */
interface Step {
	node: ElementState;
	phase: "global" | "capture" | "bubble";
	catches: boolean;
	run: () => number;
}

/** A `global-bind` listener of an element that has its type filed: the engine's global phase hears it. */
const isGlobal = (entry: RegisteredListener): boolean =>
	entry.options?.closure_type === 2 && entry.options.bind_type === 5;
const heardGlobally = (state: ElementState, entry: RegisteredListener): boolean =>
	state.filedEvents.has(`${GLOBAL_BIND}:${entry.name}`);

/**
 * The engine's rule (FiberAddEventListener): `bind_type` counts only with `closure_type` 2;
 * otherwise the listener is plain, honors `capture` and never catches.
 */
function semantics(options: ListenerOptions | undefined): { capture: boolean; catches: boolean } {
	const type = options?.bind_type ?? 1;
	if (options?.closure_type !== 2) return { capture: Boolean(options?.capture), catches: false };
	return { capture: type === 2 || type === 3, catches: type === 3 || type === 4 };
}

/** The engine's side of events, over the engine's records. */
export function createDispatcher(engine: EngineState): Dispatcher {
	const stateOfNode = (node: Node): ElementState | undefined => engine.states.get(node);

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
		// Only an object's `eventReturnResult` counts (FireElementWorklet).
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

	/**
	 * Fires an event the way Lynx does a custom event, on this element only: the main-thread
	 * functions bound to it, then its listeners (core/renderer/events/touch_event_handler.cc,
	 * HandleCustomEvent).
	 */
	function fire(element: LynxElement, name: string, event: Record<string, unknown> = {}): void {
		const state = engine.states.get(element)!;
		const bound = state.mainThreadEvents.filter(
			(entry) => entry.eventName === name && entry.eventType !== GLOBAL_BIND,
		);
		const listeners = state.listeners.filter(
			(entry) => entry.name === name && (!isGlobal(entry) || heardGlobally(state, entry)),
		);
		if (listeners.length === 0 && bound.length === 0) {
			throw new Error(`There is no ${name} listener on ${elementName(state)} to fire.`);
		}
		for (const entry of bound) {
			if (runBound(entry, state, state, event) & STOP_IMMEDIATE_PROPAGATION) return;
		}
		// Lynx sends targets as plain { id, uid, dataset }.
		const target = targetInfo(state);
		for (const { listener } of listeners) {
			listener({ type: name, target, currentTarget: target, ...event });
		}
	}

	/**
	 * An event as Lynx delivers it along the tree: the main-thread functions bound globally, then
	 * capture from the page down to the target, then bubble from the target up. A catch ends the
	 * chain at its element. On one element a main-thread function runs before a listener ("Lepus
	 * Event Handler must be in the prior position of JS Event Handler", touch_event_handler.cc,
	 * get_handlers_f_). What a main-thread function returns can stop the rest: `stopPropagation()`
	 * everything but its own element and phase, `stopImmediatePropagation()` everything
	 * (HandleEventOperations; StartEventCapture, StartEventBubble and StartEventFire for the
	 * phases).
	 */
	function dispatch(element: LynxElement, name: string, event: Record<string, unknown> = {}): void {
		const origin = engine.states.get(element)!;
		const path: ElementState[] = [];
		for (
			let state: ElementState | undefined = origin;
			state;
			state = state.node.parentNode ? stateOfNode(state.node.parentNode) : undefined
		) {
			path.unshift(state);
		}
		const target = targetInfo(origin);
		const stepsAt = (node: ElementState, capture: boolean): Step[] => {
			const phase = capture ? "capture" : "bubble";
			const steps: Step[] = [];
			for (const bound of node.mainThreadEvents) {
				if (bound.eventName !== name || bound.eventType === GLOBAL_BIND) continue;
				if (CAPTURE_TYPES.has(bound.eventType) !== capture) continue;
				steps.push({
					node,
					phase,
					catches: CATCH_TYPES.has(bound.eventType),
					run: () => runBound(bound, origin, node, event),
				});
			}
			for (const entry of node.listeners) {
				const { capture: isCapture, catches } = semantics(entry.options);
				if (entry.name !== name || isCapture !== capture || isGlobal(entry)) continue;
				steps.push({
					node,
					phase,
					catches,
					run: () => {
						entry.listener({ type: name, target, currentTarget: targetInfo(node), ...event });
						return 0;
					},
				});
			}
			return steps;
		};

		const steps: Step[] = [];
		const everyElement = engine.page
			? descendantsOf(engine.page)
					.map(stateOfNode)
					.filter((state): state is ElementState => state !== undefined)
			: [];
		for (const node of everyElement) {
			for (const bound of node.mainThreadEvents) {
				if (bound.eventName === name && bound.eventType === GLOBAL_BIND) {
					steps.push({
						node,
						phase: "global",
						catches: false,
						run: () => runBound(bound, origin, node, event),
					});
				}
			}
		}
		// A global-bind listener hears an event on any element, first of all.
		for (const node of everyElement) {
			for (const entry of node.listeners) {
				if (entry.name !== name || !isGlobal(entry) || !heardGlobally(node, entry)) continue;
				steps.push({
					node,
					phase: "global",
					catches: false,
					run: () => {
						entry.listener({ type: name, target, currentTarget: targetInfo(node), ...event });
						return 0;
					},
				});
			}
		}
		let caught = false;
		for (const node of path) {
			const found = stepsAt(node, true);
			steps.push(...found);
			if (found.some((step) => step.catches)) {
				caught = true;
				break;
			}
		}
		if (!caught) {
			for (const node of path.toReversed()) {
				const found = stepsAt(node, false);
				steps.push(...found);
				if (found.some((step) => step.catches)) break;
			}
		}

		let stopped: Step | undefined;
		for (const step of steps) {
			if (stopped && (stopped.node !== step.node || stopped.phase !== step.phase)) continue;
			const result = step.run();
			if (result & STOP_IMMEDIATE_PROPAGATION) return;
			if (result & STOP_PROPAGATION) stopped = step;
		}
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
