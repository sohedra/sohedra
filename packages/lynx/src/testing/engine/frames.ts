// Frames, and what the platform has measured. The platform draws the page at its frames, and the
// main thread's `requestAnimationFrame` asks for the next one (core/runtime/lepus/bindings/
// renderer_functions.cc, RequestAnimationFrame, on the vsync monitor).
//
// Android also measures Lynx's views at a frame, in the root view's `onMeasure`
// (LynxUIRenderer.performInnerMeasure, LynxUIOwner.performMeasure), and a scroll view takes the
// size of its content there (UIScrollView.measure). So until the frame after a flush, a scroll
// view's range is the one before the flush: a `scrollTo` past it answers code 4 and stops at the
// old end (UIScrollView.scrollTo), as Lynx 4.2 did on Android. The fake keeps each element as the
// last frame measured it, for the test's responder. A frame runs its callbacks before it measures,
// as Android's Choreographer runs animation callbacks before its traversal.

import { argumentError } from "./state.ts";
import type { EngineState } from "./state.ts";
import { descendantsOf } from "./tree.ts";

/** The main thread's frame function. */
export interface FrameFunctions {
	requestAnimationFrame(callback: (time: number) => void): number;
}

/** The frame callbacks of one engine, and whether a frame is coming. */
export interface FrameQueue {
	readonly callbacks: Map<number, (time: number) => void>;
	nextId: number;
	coming: boolean;
	/** The platform draws no frame: the callbacks wait. */
	held: boolean;
}

/** Makes an empty frame queue. */
export function frameQueue(): FrameQueue {
	return { callbacks: new Map(), nextId: 1, coming: false, held: false };
}

/** One frame: the callbacks asked for before it, then the platform measures the page. */
function runFrame(engine: EngineState): void {
	const frames = engine.frames;
	frames.coming = false;
	if (frames.held) return;
	const due = [...frames.callbacks.values()];
	frames.callbacks.clear();
	if (due.length > 0) engine.enter();
	const time = Date.now();
	for (const callback of due) {
		try {
			callback(time);
		} catch (error) {
			engine.report(error instanceof Error ? error : new Error(String(error)));
		}
	}
	if (!engine.page) return;
	for (const node of descendantsOf(engine.page)) {
		const state = engine.states.get(node);
		const shown = state && engine.shown.get(state);
		if (state && shown) engine.measured.set(state, shown);
	}
}

/** Asks for the next frame, if none is coming: a flush and a frame callback do. */
export function requestFrame(engine: EngineState): void {
	if (engine.frames.coming || engine.frames.held) return;
	engine.frames.coming = true;
	engine.schedule(() => runFrame(engine));
}

/** The main thread's frame function, over the engine's records. */
export function frameFunctions(engine: EngineState): FrameFunctions {
	return {
		requestAnimationFrame(callback) {
			if (typeof callback !== "function")
				throw argumentError({ fn: "requestAnimationFrame", index: 0, expected: "a function" });
			const id = engine.frames.nextId++;
			engine.frames.callbacks.set(id, callback);
			requestFrame(engine);
			return id;
		},
	};
}

/**
 * Stops the platform's frames until the returned function is called, as when the app is in the
 * background and the system sends no display frames: what the page asked for runs at the first
 * frame after.
 */
export function holdFrames(engine: EngineState): () => void {
	engine.frames.held = true;
	return () => {
		if (!engine.frames.held) return;
		engine.frames.held = false;
		requestFrame(engine);
	};
}
