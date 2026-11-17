// The ops the renderer made since they were last taken. The first op after a take tells the
// channel, which schedules a send.

import type { Op } from "../../wire/index.ts";

/** The renderer's ops, in the order it made them. */
export class OpQueue {
	ops: Op[] = [];
	onPending: () => void = () => {};
	/** How many patches the channel has sent: a node made before the last one is on the main thread. */
	sent: number = 0;

	push(op: Op): void {
		if (this.ops.length === 0) this.onPending();
		this.ops.push(op);
	}

	/** The ops so far; the queue is empty after. */
	take(): Op[] {
		const ops = this.ops;
		this.ops = [];
		return ops;
	}

	get size(): number {
		return this.ops.length;
	}
}
