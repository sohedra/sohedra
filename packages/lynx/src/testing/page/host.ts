// The host's events on a test page: lynx-core's `GlobalEventEmitter`, which the background's
// `lynx.getJSModule` answers, and what the page asked of it.

/** A listener of the emitter: it gets the event's arguments. */
type Listener = (...args: unknown[]) => void;

/** lynx-core's `GlobalEventEmitter` (lynx-core's modules/event/eventEmitter.ts). */
export interface TestEmitter {
	/**
	 * Adds a listener of `name`; the same one twice is called twice. A `keyboardstatuschanged`
	 * listener starts Android's keyboard detection (`switchKeyBoardDetect(true)`).
	 */
	addListener(name: string, listener: Listener, context?: object): void;
	/**
	 * Removes the first entry of `listener` under `name`. Any removal of a `keyboardstatuschanged`
	 * listener stops the detection, whether others are left or not.
	 */
	removeListener(name: string, listener: Listener): void;
	/** Calls the listeners of `name` with `args`, in the order they were added. */
	emit(name: string, args: unknown[]): void;
}

/** What the page asked of the host's events, for a test to read. */
export interface HostEventsLog {
	/** How many times the page asked lynx-core for its `GlobalEventEmitter`. */
	readonly asked: number;
	/** The emitter's listeners of `name` now. */
	listeners(name: string): number;
	/** Each start (`true`) and stop (`false`) of Android's keyboard detection, in order. */
	readonly keyboardDetection: readonly boolean[];
}

/** The emitter, how the background's `lynx` hands it out, and what a test reads of it. */
export function createHostEvents(): {
	emitter: TestEmitter;
	getJSModule(name: string): TestEmitter;
	log: HostEventsLog;
} {
	const events = new Map<string, { listener: Listener; context: object | undefined }[]>();
	const keyboardDetection: boolean[] = [];
	let asked = 0;
	const KEYBOARD = "keyboardstatuschanged";
	const emitter: TestEmitter = {
		addListener(name, listener, context) {
			if (name === KEYBOARD) keyboardDetection.push(true);
			const list = events.get(name) ?? [];
			list.push({ listener, context });
			events.set(name, list);
		},
		removeListener(name, listener) {
			if (typeof listener !== "function")
				throw new Error("removeListener only takes instances of Function");
			const list = events.get(name);
			const at = list?.findIndex((entry) => entry.listener === listener) ?? -1;
			if (at !== -1) list!.splice(at, 1);
			if (name === KEYBOARD) keyboardDetection.push(false);
		},
		emit(name, args) {
			// lynx-core walks the list itself: a listener removed meanwhile may shift the walk.
			for (const { listener, context } of events.get(name) ?? []) listener.apply(context, args);
		},
	};
	return {
		emitter,
		getJSModule(name) {
			if (name !== "GlobalEventEmitter")
				throw new Error(
					`The test page's lynx.getJSModule knows GlobalEventEmitter only, not ${name}: ` +
						"what lynx-core answers for another module is not checked.",
				);
			asked++;
			return emitter;
		},
		log: {
			get asked() {
				return asked;
			},
			listeners: (name) => events.get(name)?.length ?? 0,
			keyboardDetection,
		},
	};
}
