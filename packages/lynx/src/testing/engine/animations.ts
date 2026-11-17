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

/** The animation function, over the engine's records. */
export function animationFunctions(
	engine: EngineState,
	dispatcher: Dispatcher,
): AnimationFunctions {
	return {
		__ElementAnimate(element, args) {
			const state = stateOf(engine, element, "__ElementAnimate", 0);
			if (!Array.isArray(args)) throw argumentError("__ElementAnimate", 1, "an array");
			engine.log.animations.push({ element: state.node, args });
			// [operation, name, keyframes, options]: 0 start, 1 play, 2 pause, 3 cancel.
			const [operation, name, keyframes, options] = args as [number, string, unknown, unknown];
			const animation = state.running.get(name);
			if (operation === 0) state.running.set(name, { keyframes, options, state: "running" });
			else if (operation === 1 && animation) animation.state = "running";
			else if (operation === 2 && animation) animation.state = "paused";
			else if (operation === 3) {
				state.running.delete(name);
				// A running or paused animation that is canceled reports it.
				if (animation) dispatcher.animationEvent(state, "animationcancel", name);
			}
		},
	};
}
