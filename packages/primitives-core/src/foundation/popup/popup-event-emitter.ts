// A small typed event emitter: a popup's own events, which its interactions follow.

type Listener = (data: never) => void;

/** A small typed event emitter. */
export class EventEmitter<Events extends Record<string, unknown>> {
	#map = new Map<keyof Events, Set<Listener>>();

	emit<K extends keyof Events>(event: K, data: Events[K]): void {
		this.#map.get(event)?.forEach((listener) => (listener as (data: Events[K]) => void)(data));
	}

	on<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): void {
		let listeners = this.#map.get(event);
		if (!listeners) {
			listeners = new Set();
			this.#map.set(event, listeners);
		}
		listeners.add(listener as Listener);
	}

	off<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): void {
		this.#map.get(event)?.delete(listener as Listener);
	}
}
