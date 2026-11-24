// A guard against a main-thread update loop, in development builds only. A main-thread function
// changes an element; the change is flushed; the engine lays the page out and runs the function
// again (a layout handler that sets a size, a scroll handler that sets a scroll position); and so
// on, with no turn for anything else, and the page hangs with no message.
//
// So the flushes main-thread functions ask for are counted, from the main thread's last turn: a
// timer of its own. Past `LIMIT` in a row, the loop is reported once, and those flushes stop until
// the next turn, which ends a loop that goes through the engine's layout. A long drag is not a
// loop: each move is a turn of its own.

import { mainThreadError } from "../catalogue.ts";

/**
 * How many flushes in a row are let through: far above what code that ends asks for before the
 * main thread's next turn, and reached by a loop in about the time it takes to see the page stuck.
 */
export const LOOP_LIMIT = 1000;

/** What the code that runs main-thread functions and flushes their changes tells the guard. */
interface LoopGuard {
	/** The function `id` runs, for the event `event` if the engine gave one. */
	ran(id: string, event: string | undefined): void;
	/** A function changed an element: `what` it called, with what. */
	changed(what: string, detail: unknown): void;
	/** A flush for main-thread functions is due: false when it is one more round of a loop. */
	flush(): boolean;
}

/** What the guard needs of the page. */
interface LoopGuardOptions {
	report(error: unknown): void;
	/** Runs `callback` at the main thread's next turn, if the engine can. */
	nextTurn(callback: () => void): boolean;
}

/** A guard for one page. */
export function createLoopGuard({ report, nextTurn }: LoopGuardOptions): LoopGuard {
	let flushes = 0;
	let waiting = false;
	let looping = false;
	let fn: string | undefined;
	let event: string | undefined;
	let change: string | undefined;

	function turn(): void {
		flushes = 0;
		waiting = false;
		looping = false;
	}

	return {
		ran(id, name) {
			fn = id;
			event = name;
		},
		changed(what, detail) {
			change = `${what}(${String(detail)})`;
		},
		flush() {
			if (looping) return false;
			if (!waiting) {
				// Without a timer nothing tells a turn from a loop.
				if (!nextTurn(turn)) return true;
				waiting = true;
			}
			if (++flushes <= LOOP_LIMIT) return true;
			looping = true;
			report(
				mainThreadError({
					code: "main_thread_update_loop",
					details: { limit: LOOP_LIMIT, fn, event, change },
				}),
			);
			return false;
		},
	};
}
