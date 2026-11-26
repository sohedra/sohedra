// A platform for core tests: a scheduler the test steps by hand, and services that throw unless
// the test scripts them, so a core decision that asks the platform something unplanned fails.
import type {
	FocusService,
	FormService,
	LocaleService,
	OrderService,
	Platform,
	PlatformTypes,
	Scheduler,
} from "../src/foundation/kernel/index.js";

/** Any object is an element and any value an event: core never reads either. */
export type FakeTypes = PlatformTypes;

interface Task {
	readonly at: number;
	readonly order: number;
	readonly callback: () => void;
	canceled: boolean;
}

/** A scheduler on a virtual clock, stepped by the test. */
export interface FakeScheduler extends Scheduler {
	/** Moves the clock by `ms`, running due timeouts in order (also ones they schedule). */
	advance(ms: number): void;
	/** Runs the frames requested so far (frames they request wait for the next call). */
	runFrames(): void;
	/** Runs queued microtasks, also ones they queue. */
	runMicrotasks(): void;
	/** How many timeouts, frames and microtasks are pending. */
	readonly pending: {
		readonly timeouts: number;
		readonly frames: number;
		readonly microtasks: number;
	};
}

function createScheduler(): FakeScheduler {
	let time = 0;
	let order = 0;
	let timeouts: Task[] = [];
	let frames: Task[] = [];
	const microtasks: Task[] = [];

	const add = (list: Task[], callback: () => void, at: number) => {
		const task: Task = { at, order: order++, callback, canceled: false };
		list.push(task);
		return () => {
			task.canceled = true;
		};
	};
	const live = (list: Task[]) => list.filter((task) => !task.canceled).length;

	return {
		timeout: (callback, ms) => add(timeouts, callback, time + Math.max(0, ms)),
		frame: (callback) => add(frames, callback, time),
		microtask: (callback) => add(microtasks, callback, time),
		now: () => time,
		advance(ms) {
			const end = time + ms;
			for (;;) {
				const due = timeouts
					.filter((task) => !task.canceled && task.at <= end)
					.sort((a, b) => a.at - b.at || a.order - b.order)[0];
				if (!due) {
					break;
				}
				timeouts = timeouts.filter((task) => task !== due);
				time = due.at;
				due.callback();
			}
			timeouts = timeouts.filter((task) => !task.canceled);
			time = end;
		},
		runFrames() {
			const current = frames;
			frames = [];
			for (const task of current) {
				if (!task.canceled) {
					task.callback();
				}
			}
		},
		runMicrotasks() {
			while (microtasks.length > 0) {
				const task = microtasks.shift()!;
				if (!task.canceled) {
					task.callback();
				}
			}
		},
		get pending() {
			return { timeouts: live(timeouts), frames: live(frames), microtasks: live(microtasks) };
		},
	};
}

function unscripted(name: string): never {
	throw new Error(`Unexpected platform call: ${name}. Script it in createFakePlatform().`);
}

export interface FakePlatform extends Platform<FakeTypes> {
	readonly scheduler: FakeScheduler;
}

/** A fake platform; services the test doesn't script throw when core calls them. */
export function createFakePlatform(
	script: {
		order?: Partial<OrderService<FakeTypes>>;
		focus?: Partial<FocusService<FakeTypes>>;
		locale?: Partial<LocaleService>;
		form?: Partial<FormService<FakeTypes>>;
	} = {},
): FakePlatform {
	return {
		scheduler: createScheduler(),
		order: { compare: script.order?.compare ?? (() => unscripted("order.compare")) },
		focus: { focus: script.focus?.focus ?? (() => unscripted("focus.focus")) },
		locale: {
			numberFormat: script.locale?.numberFormat ?? (() => unscripted("locale.numberFormat")),
			collator: script.locale?.collator ?? (() => unscripted("locale.collator")),
		},
		form: { requestSubmit: script.form?.requestSubmit ?? (() => unscripted("form.requestSubmit")) },
	};
}
