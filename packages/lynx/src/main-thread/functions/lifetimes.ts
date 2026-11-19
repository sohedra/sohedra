// How long the background keeps a main-thread function's context: while the main thread holds any
// copy of a function sent with it, or a handle of one of its background functions. Each is counted
// as the main thread takes it (an attribute, a call's function or arguments), and the engine's
// collector says when it is gone; once a context's count is 0, the background is told, in one
// message for what went in a task. A text the main thread lets go of unread is told of at once.
// Each page counts its own: the background lets go of every context of a page that reloads.

import { mainThread } from "../globals.ts";

/** The contexts one page holds. */
export interface Lifetimes {
	/** The main thread holds `object` for the context `id`: counted once. */
	hold(id: number, object: object): void;
	/** Whether the page holds anything of the context `id`. */
	has(id: number): boolean;
	/** The main thread let go of text that held these contexts, unread. */
	dropUnread(ids: readonly number[]): void;
	/** The page ended: nothing more is told. */
	end(): void;
	/** The contexts held, for tests. */
	held(): number[];
}

/** What a page's lifetimes tell the background with, and when. */
export interface LifetimesOptions {
	/** Tells the background these contexts are let go of. */
	release(ids: number[]): void;
	/** Runs `callback` at the end of the task. */
	soon(callback: () => void): void;
}

/** The contexts of one page. */
export function createLifetimes({ release, soon }: LifetimesOptions): Lifetimes {
	const counts = new Map<number, number>();
	const counted = new WeakSet<object>();
	let released: number[] = [];
	let ended = false;

	function tell(): void {
		const ids = released;
		released = [];
		if (!ended && ids.length > 0) release(ids);
	}

	function letGo(id: number): void {
		if (released.push(id) === 1) soon(tell);
	}

	function collected(id: number): void {
		if (ended) return;
		const count = counts.get(id);
		if (count === undefined) return;
		if (count > 1) {
			counts.set(id, count - 1);
			return;
		}
		counts.delete(id);
		letGo(id);
	}

	const Registry = mainThread.FinalizationRegistry;
	// Without a collector to say so, the background keeps a page's contexts until the page ends.
	const registry = typeof Registry === "function" ? new Registry<number>(collected) : undefined;

	return {
		hold(id, object) {
			if (ended || counted.has(object)) return;
			counted.add(object);
			counts.set(id, (counts.get(id) ?? 0) + 1);
			registry?.register(object, id);
		},
		has: (id) => counts.has(id),
		dropUnread(ids) {
			for (const id of ids) if (!counts.has(id)) letGo(id);
		},
		end() {
			ended = true;
			counts.clear();
			released = [];
		},
		held: () => [...counts.keys()],
	};
}
