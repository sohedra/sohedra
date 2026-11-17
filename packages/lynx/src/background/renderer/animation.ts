// `element.animate(keyframes, options)`: an animation of the element's Lynx element, run by the
// engine (`__ElementAnimate`) and controlled by its name.
//
// The engine tells of an animation's end only to an element that listens for `animationend` or
// `animationcancel`, with the animation's name in `params.animation_name`
// (core/animation/animation.cc, Animation::CreateEventAndSend). So `finished` listens only once it
// is read, and stops when it settles.

import { backgroundError } from "../catalogue.ts";
import type { Handler } from "./handlers.ts";

/** One keyframe: style names and their values. */
export type Keyframe = Record<string, string | number>;

/** How an animation runs, with the web's option names, which the engine reads. */
export interface AnimationOptions {
	/** In milliseconds. */
	duration?: number;
	/** In milliseconds. */
	delay?: number;
	/** How many times it runs; `Infinity` runs it for good. */
	iterations?: number;
	direction?: "normal" | "reverse" | "alternate" | "alternate-reverse";
	easing?: string;
	fill?: "none" | "forwards" | "backwards" | "both";
	/** The animation's name, by which it is controlled and reported; one is made up when not given. */
	name?: string;
}

/** A running animation of an element, as the web's `Animation` has it. */
export interface LynxAnimation<Target> {
	/** The animation's name. */
	readonly id: string;
	readonly effect: { target: Target; keyframes: Keyframe[]; options: AnimationOptions };
	play(): void;
	pause(): void;
	/** Stops it and takes its styles off; `finished` rejects with an `AbortError`. */
	cancel(): void;
	/** Jumps to its end; `finished` resolves. */
	finish(): void;
	/**
	 * Resolves when the animation ends by itself or through `finish()`, and rejects with an
	 * `AbortError` when it is canceled. Read it right after `animate()`: an end before it is read is
	 * not heard. A rejection that nothing reads raises no error, as on the web.
	 */
	readonly finished: Promise<void>;
}

/** The engine's operations of `__ElementAnimate` (core/runtime/js/bindings/java_script_element.h). */
const START = 0;
const PLAY = 1;
const PAUSE = 2;
const CANCEL = 3;
const FINISH = 4;

/** What an animation needs of its element. */
export interface AnimationTarget<Target> {
	node: Target;
	keyframes: Keyframe[];
	options: AnimationOptions;
	/** Sends `__ElementAnimate`'s arguments to the element; `undefined` once the page is gone. */
	send: ((args: unknown[]) => void) | undefined;
	/** The error `finished` rejects with when the page is gone. */
	gone: () => Error;
	listen(type: string, handler: Handler): void;
	unlisten(type: string, handler: Handler): void;
}

let made = 0;

/** The options as the engine reads them. JSON has no `Infinity`: the engine also takes "infinite". */
function engineOptions(options: AnimationOptions): Record<string, string | number> {
	const native: Record<string, string | number> = {};
	if (options.duration !== undefined) native["duration"] = options.duration;
	if (options.delay !== undefined) native["delay"] = options.delay;
	if (options.direction !== undefined) native["direction"] = options.direction;
	if (options.iterations !== undefined)
		native["iterations"] = options.iterations === Infinity ? "infinite" : options.iterations;
	if (options.fill !== undefined) native["fill"] = options.fill;
	if (options.easing !== undefined) native["easing"] = options.easing;
	return native;
}

/** Starts an animation on the element, and gives what controls it. */
export function startAnimation<Target>(target: AnimationTarget<Target>): LynxAnimation<Target> {
	const { node, keyframes, options, send } = target;
	const name = options.name ?? `sohedra-animation-${++made}`;
	send?.([START, name, keyframes, engineOptions(options)]);

	/** How it ended: 0 not yet, 1 finished, 2 canceled. */
	let ended: 0 | 1 | 2 = 0;
	let finished: Promise<void> | undefined;
	let settle: ((how: 1 | 2) => void) | undefined;
	const end = (how: 1 | 2): void => {
		if (ended !== 0) return;
		ended = how;
		settle?.(how);
	};
	const canceled = (): Error => {
		const error = backgroundError({ code: "animation_canceled", details: { name } });
		error.name = "AbortError";
		return error;
	};

	function read(): Promise<void> {
		if (!send) return Promise.reject(target.gone());
		return new Promise<void>((resolve, reject) => {
			const settled = (how: 1 | 2): void => (how === 1 ? resolve() : reject(canceled()));
			if (ended !== 0) {
				settled(ended);
				return;
			}
			const mine = (event: unknown): boolean => {
				// Boundary: the engine's animation event, read by field.
				const params = (event as { params?: { animation_name?: unknown } } | null)?.params;
				return params?.animation_name === name;
			};
			const onEnd: Handler = (event) => mine(event) && end(1);
			const onCancel: Handler = (event) => mine(event) && end(2);
			target.listen("animationend", onEnd);
			target.listen("animationcancel", onCancel);
			settle = (how) => {
				settle = undefined;
				target.unlisten("animationend", onEnd);
				target.unlisten("animationcancel", onCancel);
				settled(how);
			};
		});
	}

	return {
		id: name,
		effect: { target: node, keyframes, options },
		play: () => send?.([PLAY, name]),
		pause: () => send?.([PAUSE, name]),
		cancel() {
			send?.([CANCEL, name]);
			end(2);
		},
		finish() {
			send?.([FINISH, name]);
			end(1);
		},
		get finished() {
			if (finished) return finished;
			finished = read();
			// As on the web, a canceled animation's promise counts as handled.
			finished.catch(() => {});
			return finished;
		},
	};
}
