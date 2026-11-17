// Event handlers by handler id. One id per element, event type and event name: Lynx binds one
// handler per such slot, so the listeners Svelte adds to one slot share its id and all run.

/** A handler of an event, as Svelte gives it. */
export type Handler = (event: unknown) => unknown;

/** The handlers of the page's events. */
export class HandlerRegistry {
	next: number = 1;
	slots: Map<number, Handler[]> = new Map();

	/** A new, empty slot's id. */
	create(): number {
		const id = this.next++;
		this.slots.set(id, []);
		return id;
	}

	add(id: number, handler: Handler): void {
		this.slots.get(id)?.push(handler);
	}

	/** Whether `handler` is in the slot. */
	has(id: number, handler: Handler): boolean {
		return this.slots.get(id)?.includes(handler) ?? false;
	}

	/** Takes one handler out; whether the slot is empty now. */
	remove(id: number, handler: Handler): boolean {
		const list = this.slots.get(id);
		if (!list) return true;
		const index = list.indexOf(handler);
		if (index !== -1) list.splice(index, 1);
		return list.length === 0;
	}

	release(id: number): void {
		this.slots.delete(id);
	}

	/** Runs the slot's handlers, in the order they were added. */
	dispatch(id: number, event: unknown): void {
		const list = this.slots.get(id);
		if (!list) return;
		for (const handler of list.slice()) handler(event);
	}

	get size(): number {
		return this.slots.size;
	}
}
