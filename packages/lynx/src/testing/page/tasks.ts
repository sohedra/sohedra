// What a thread of a test page leaves for later runs as that thread. On a device each thread has
// its own timers and its own promise queue; here both share the process's. So the background's
// timers are the process's, each callback run as the background, and a promise's continuation runs
// as the thread that was running when it was queued, with its `then` or its `await`.

import { promiseHooks } from "node:v8";

import { testingError } from "../catalogue.ts";
import type { Thread } from "./lynx.ts";

/** A function of the process's. */
type ProcessFunction = (...args: unknown[]) => unknown;

/** The function each thread's timer stands for, by the timer, whichever page made it. */
const standsFor = new WeakMap<object, ProcessFunction>();

/**
 * The process's own function behind `value`, if it is a thread's timer: a test that fakes timers
 * while a page runs may keep one, and puts it back after the page has ended.
 */
export function processTimer(value: unknown): unknown {
	return typeof value === "function" ? (standsFor.get(value) ?? value) : value;
}

/** How a page runs its threads' later work. */
export interface ThreadTasks {
	/**
	 * `schedule`, a timer of the process's (`setTimeout`, `setInterval`, `requestAnimationFrame`), as
	 * `thread`'s: it schedules with the function itself, read when the thread is entered, so a test's
	 * fake timers or its own `requestAnimationFrame` decide when the callback runs, and the callback
	 * runs as `thread`. One timer per function.
	 */
	timer(thread: Thread, schedule: unknown): unknown;
	/** Stops running promise continuations as their thread: the page has ended. */
	stop(): void;
}

/**
 * Runs a page's later work as the thread that left it. `enter` puts a thread's globals in place
 * and answers the thread that was in place; `current` answers the thread in place now.
 */
export function createThreadTasks(options: {
	enter: (thread: Thread) => Thread | undefined;
	current: () => Thread | undefined;
}): ThreadTasks {
	const { enter, current } = options;
	/** Puts the thread that was in place before back, if another one ran. */
	const leave = (thread: Thread, before: Thread | undefined): void => {
		if (before !== undefined && before !== thread) enter(before);
	};
	const timers = new Map<ProcessFunction, ProcessFunction>();
	/** The thread each promise was queued on. */
	const queuedOn = new WeakMap<Promise<unknown>, Thread>();
	/** The thread in place before each continuation that runs now. */
	const before: (Thread | undefined)[] = [];
	const stops: ReturnType<typeof promiseHooks.onInit>[] = [];
	// V8 calls these around every promise of the process: when one is made (by `then`, by an
	// `await`, by a promise's constructor) and around each continuation it runs. A runtime without
	// them (Bun's own) would run continuations as the wrong thread: it fails instead.
	try {
		stops.push(
			promiseHooks.onInit((promise) => {
				const thread = current();
				if (thread !== undefined) queuedOn.set(promise, thread);
			}),
			promiseHooks.onBefore((promise) => {
				const thread = queuedOn.get(promise);
				const was = current();
				before.push(was);
				if (thread !== undefined && thread !== was) enter(thread);
			}),
			promiseHooks.onAfter(() => {
				const was = before.pop();
				const thread = current();
				if (thread !== undefined) leave(thread, was);
			}),
		);
	} catch (error) {
		for (const stop of stops) stop();
		throw testingError({
			code: "promise_hooks_missing",
			details: { reason: error instanceof Error ? error.message : String(error) },
		});
	}

	return {
		timer(thread, schedule) {
			if (typeof schedule !== "function") return schedule;
			// Boundary: a timer of the process's is a function of any arguments.
			const own = processTimer(schedule) as ProcessFunction;
			let timer = timers.get(own);
			if (!timer) {
				timer = new Proxy(own, {
					apply(target, self, args: unknown[]) {
						const [callback, ...rest] = args;
						if (typeof callback !== "function") return Reflect.apply(target, self, args);
						return Reflect.apply(target, self, [
							function (this: unknown, ...callbackArgs: unknown[]): unknown {
								const was = enter(thread);
								try {
									return Reflect.apply(callback, this, callbackArgs);
								} finally {
									leave(thread, was);
								}
							},
							...rest,
						]);
					},
				});
				timers.set(own, timer);
				standsFor.set(timer, own);
			}
			return timer;
		},
		stop() {
			for (const stop of stops) stop();
		},
	};
}
