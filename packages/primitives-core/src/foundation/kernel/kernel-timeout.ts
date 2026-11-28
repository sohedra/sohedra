import type { Scheduler } from "./kernel-platform.js";

/**
 * One restartable timeout on the platform's scheduler: starting it again
 * replaces the pending one. A callback whose run was cleared or replaced never runs, even when the
 * platform delivers it late.
 */
export class Timeout {
	readonly #scheduler: Scheduler;
	#cancel: (() => void) | undefined;
	#generation = 0;

	constructor(scheduler: Scheduler) {
		this.#scheduler = scheduler;
	}

	start(delay: number, callback: () => void): void {
		this.clear();
		const generation = this.#generation;
		this.#cancel = this.#scheduler.timeout(() => {
			if (generation !== this.#generation) {
				return;
			}
			this.#cancel = undefined;
			this.#generation += 1;
			callback();
		}, delay);
	}

	isStarted(): boolean {
		return this.#cancel !== undefined;
	}

	clear = (): void => {
		this.#generation += 1;
		const cancel = this.#cancel;
		if (cancel !== undefined) {
			this.#cancel = undefined;
			cancel();
		}
	};
}
