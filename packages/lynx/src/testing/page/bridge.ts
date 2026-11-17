// The one bridge between a test page's two threads. On a device the main thread and the background
// run apart, and what one sends the other handles when it gets to it; here both run in one process,
// so everything that crosses arrives on a later macrotask. A hop in the same task would hide the
// races a device has: an event on the first frame before the background took over, an answer that
// comes after its element went.

import { nextMacrotask } from "../globals.ts";

/** How many macrotasks `settle()` waits before it calls the threads stuck. */
const ROUNDS = 100;

/** What crosses between the threads of one page. */
export interface Bridge {
	/**
	 * Runs `deliver` on a later macrotask, as on the other thread; dropped once closed. What it
	 * throws goes to that thread's error path, not up through the macrotask.
	 */
	send(deliver: () => void): void;
	/** Waits until nothing is on its way, and what arrived has done its work. */
	settle(): Promise<void>;
	/** Drops what is still on its way: the page has ended. */
	close(): void;
}

/** Makes the bridge of one page; `onError` gets what a delivery throws. */
export function createBridge(onError: (error: unknown) => void): Bridge {
	let inFlight = 0;
	let open = true;
	const nextTask = (): Promise<void> => new Promise((resolve) => nextMacrotask(resolve));

	return {
		send(deliver) {
			inFlight++;
			nextMacrotask(() => {
				inFlight--;
				if (!open) return;
				try {
					deliver();
				} catch (error) {
					onError(error);
				}
			});
		},
		async settle() {
			for (let round = 0; round < ROUNDS; round++) {
				await nextTask();
				if (inFlight > 0) continue;
				// One more task: a delivery may have left work for a microtask, which may send.
				await nextTask();
				if (inFlight === 0) return;
			}
			throw new Error(
				`The test page's threads are still sending after ${ROUNDS} rounds: ` +
					"each answers the other without end. Look for a handler that sends what it receives.",
			);
		},
		close() {
			open = false;
		},
	};
}
