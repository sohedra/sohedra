// Gesture detectors: the page sets them on elements, and the engine runs their callbacks, with a
// gesture manager, when a gesture happens.
//   - a callback of a detector set with `__SetGestureDetector` runs as
//     `runWorklet(callback, [event, gestureManager], { source: 2 })`, where the manager has
//     `__SetGestureState` and `__ConsumeGesture` (core/renderer/events/touch_event_handler.cc,
//     HandleGestureEvent and TriggerFiberElementWorklet; core/runtime/lepusng/bindings/
//     renderer_ng.cc, Utils::CreateGestureManager).

import { SOURCE_GESTURE, mainThreadTarget, runMainThreadFunction } from "./dispatch.ts";
import { recorded } from "./events.ts";
import { elementName, stateOf } from "./state.ts";
import type { Detector, ElementState, EngineState } from "./state.ts";
import type { GestureConfig, GestureRelations, LynxElement } from "./types.ts";

/** The functions that set and remove detectors. */
export interface GestureFunctions {
	__SetGestureDetector(
		element: LynxElement,
		id: number,
		type: number,
		config: GestureConfig,
		relations: GestureRelations,
	): void;
	__RemoveGestureDetector(element: LynxElement, id: number): void;
}

/** What the engine's side of gestures offers. */
export interface GestureDriver {
	/**
	 * Runs the callback `name` of the element's detector `id` as Lynx does (HandleGestureEvent),
	 * with the gesture's event and the gesture manager. Returns what the function returned.
	 */
	fireGesture(
		element: LynxElement,
		id: number,
		name: string,
		params?: Record<string, unknown>,
	): unknown;
	/** An element's detectors, in the order they were set. */
	detectors(element: LynxElement): Detector[];
}

/** The functions that set and remove detectors, over the engine's records. */
export function gestureFunctions(engine: EngineState): GestureFunctions {
	return {
		__SetGestureDetector(element, id, type, config, relations) {
			const state = stateOf(engine, element, "__SetGestureDetector", 0);
			engine.log.gestureCalls.push({
				op: "set",
				element: state.node,
				id,
				type,
				config: recorded(config),
				relations: recorded(relations),
			});
			// Not an array: the engine sets nothing (core/runtime/lepus/bindings/renderer_functions.cc,
			// FiberSetGestureDetector).
			if (!Array.isArray(config?.callbacks)) return;
			state.detectors.set(id, {
				id,
				type,
				callbacks: config.callbacks,
				config: config.config,
				relations,
			});
		},
		__RemoveGestureDetector(element, id) {
			const state = stateOf(engine, element, "__RemoveGestureDetector", 0);
			engine.log.gestureCalls.push({ op: "remove", element: state.node, id });
			state.detectors.delete(id);
		},
	};
}

/** The engine's side of gestures, over the engine's records. */
export function createGestureDriver(engine: EngineState): GestureDriver {
	/** What Lynx hands a gesture callback second: it moves a detector of an element along. */
	const gestureManager = {
		// An id the element has no detector for changes nothing (Android:
		// GestureHandlerTrigger.handleGestureDetectorState finds no handler).
		__SetGestureState(element: unknown, id: number, state: number): void {
			const owner = stateOf(engine, element, "__SetGestureState", 0);
			const detector = owner.detectors.get(id);
			engine.log.gestureManagerCalls.push({
				op: "state",
				element: owner.node,
				id,
				state,
				detector: !!detector,
			});
			if (detector) detector.state = state;
		},
		__ConsumeGesture(element: unknown, id: number, params: unknown): void {
			const owner = stateOf(engine, element, "__ConsumeGesture", 0);
			const detector = owner.detectors.get(id);
			engine.log.gestureManagerCalls.push({
				op: "consume",
				element: owner.node,
				id,
				params,
				detector: !!detector,
			});
			if (detector) detector.consume = params;
		},
	};

	return {
		fireGesture(element, id, name, params = {}) {
			const state: ElementState = stateOf(engine, element, "fireGesture", 0);
			const detector = state.detectors.get(id);
			if (!detector) {
				throw new Error(`There is no gesture detector ${id} on ${elementName(state)}.`);
			}
			const entry = detector.callbacks.find((callback) => callback.name === name);
			if (!entry) {
				throw new Error(
					`The gesture detector ${id} on ${elementName(state)} has no ${name} callback.`,
				);
			}
			const { ran, returned } = runMainThreadFunction(
				entry.callback,
				[
					{
						type: name,
						timestamp: Date.now(),
						target: mainThreadTarget(state),
						currentTarget: mainThreadTarget(state),
						// GetCustomEventParam: the gesture's values are `params`, and `detail` too.
						params,
						detail: params,
					},
					gestureManager,
				],
				SOURCE_GESTURE,
			);
			if (ran) {
				engine.log.mainThreadRuns.push({
					source: "gesture",
					element: state.node,
					name,
					eventReturnResult: 0,
				});
			}
			return returned;
		},
		detectors: (element) => [...stateOf(engine, element, "detectors", 0).detectors.values()],
	};
}
