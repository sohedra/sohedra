// A small typed event emitter: a popup's own events, which its interactions follow.

type Listener = (data: never) => void;

/** A small typed event emitter. */
export class EventEmitter<Events extends Record<string, unknown>> {
	#map = new Map<keyof Events, Set<Listener>>();

	/** Calls every listener of `event` with `data`. */
	emit<K extends keyof Events>(event: K, data: Events[K]): void {
		this.#map.get(event)?.forEach((listener) => (listener as (data: Events[K]) => void)(data));
	}

	/** Adds `listener` for `event`. */
	on<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): void {
		let listeners = this.#map.get(event);
		if (!listeners) {
			listeners = new Set();
			this.#map.set(event, listeners);
		}
		listeners.add(listener as Listener);
	}

	/** Removes `listener` for `event`. */
	off<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): void {
		this.#map.get(event)?.delete(listener as Listener);
	}
}
