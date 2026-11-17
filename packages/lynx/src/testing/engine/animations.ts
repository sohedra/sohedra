// `__ElementAnimate`: an animation's life on an element. A canceled animation says so to the
// element's listeners (core/animation/animation.cc, Animation::Destroy).

import type { Dispatcher } from "./dispatch.ts";
import { argumentError, stateOf } from "./state.ts";
import type { EngineState } from "./state.ts";
import type { LynxElement } from "./types.ts";

/** The function that starts and changes animations. */
export interface AnimationFunctions {
	__ElementAnimate(element: LynxElement, args: unknown[]): void;
}

/** The operations of `__ElementAnimate`, by number (core/renderer/dom/element.cc, Element::AnimateV2). */
const START = 0;
const PLAY = 1;
const PAUSE = 2;
const CANCEL = 3;

/** The animation function, over the engine's records. */
export function animationFunctions(
	engine: EngineState,
	dispatcher: Dispatcher,
): AnimationFunctions {
	return {
		// [operation, name, keyframes, options] (Element::AnimateV2).
		__ElementAnimate(element, args) {
			const state = stateOf(engine, { value: element, fn: "__ElementAnimate", index: 0 });
			if (!Array.isArray(args)) {
				throw argumentError({ fn: "__ElementAnimate", index: 1, expected: "an array" });
			}
			const [operation, name, keyframes, options] = args;
			if (typeof operation !== "number" || ![START, PLAY, PAUSE, CANCEL].includes(operation)) {
				throw new Error(
					`__ElementAnimate was given the operation ${String(operation)}, which Lynx ignores. ` +
						"Use 0 to start, 1 to play, 2 to pause or 3 to cancel.",
				);
			}
			const key = String(name);
			engine.log.animations.push({ element: state.node, args });
			const animation = state.running.get(key);
			if (operation === START) state.running.set(key, { keyframes, options, state: "running" });
			else if (operation === PLAY && animation) animation.state = "running";
			else if (operation === PAUSE && animation) animation.state = "paused";
			else if (operation === CANCEL) {
				state.running.delete(key);
				// A running or paused animation that is canceled reports it. The fake keeps no clock,
				// so the time it ran is 0.
				if (animation) {
					dispatcher.animationEvent(state, { type: "animationcancel", name: key, elapsedTime: 0 });
				}
			}
		},
	};
}
