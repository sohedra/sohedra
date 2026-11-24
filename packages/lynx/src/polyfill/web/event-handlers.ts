// Event handler attributes (`onabort`, `onmessage`, the global object's `onerror`): HTML § 8.1.8.1
// "Event handlers". The first handler set adds a listener, which calls whatever handler is set when
// the event comes; setting `null` removes it, so a later handler runs after the listeners added in
// between, as on the web.

/** What an event handler attribute listens on. */
export interface Listening {
	addEventListener(type: string, listener: (event: Event) => void): void;
	removeEventListener(type: string, listener: (event: Event) => void): void;
}

/** What the handler is given: the event, or for `"error"` HTML's five arguments of an `onerror`. */
export type HandlerKind = "event" | "error";

/** Each object's handlers, by event type. */
const handlers = new WeakMap<
	object,
	Map<string, { value: unknown; listener: (event: Event) => void }>
>();

/**
 * The accessor of the attribute `on${type}`, for a prototype (`targetOf` the object itself) or for
 * an object whose events go to another target, as the global object's do.
 */
export function eventHandlerProperty(
	type: string,
	{
		targetOf = (self) => self as Listening,
		kind = "event",
	}: { targetOf?: (self: object) => Listening; kind?: HandlerKind } = {},
): PropertyDescriptor {
	return {
		get(this: object): unknown {
			return handlers.get(this)?.get(type)?.value ?? null;
		},
		set(this: object, value: unknown): void {
			let own = handlers.get(this);
			if (!own) handlers.set(this, (own = new Map()));
			const current = own.get(type);
			if (typeof value !== "function" && (typeof value !== "object" || value === null)) {
				if (current) targetOf(this).removeEventListener(type, current.listener);
				own.delete(type);
				return;
			}
			if (current) {
				current.value = value;
				return;
			}
			const entry = {
				value,
				listener: (event: Event) => {
					call(entry.value, this, event, kind);
				},
			};
			own.set(type, entry);
			targetOf(this).addEventListener(type, entry.listener);
		},
		enumerable: true,
		configurable: true,
	};
}

/** Calls a handler as HTML does, and cancels the event when its answer says to. */
function call(handler: unknown, owner: object, event: Event, kind: HandlerKind): void {
	if (typeof handler !== "function") return;
	if (kind === "error" && isErrorEvent(event)) {
		const { message, filename, lineno, colno, error } = event;
		if (handler.call(owner, message, filename, lineno, colno, error) === true)
			event.preventDefault();
		return;
	}
	if (handler.call(owner, event) === false) event.preventDefault();
}

/** Whether `event` is an `ErrorEvent`, read by its fields: the thread's class may be any. */
function isErrorEvent(event: Event): event is ErrorEvent {
	return "message" in event && "error" in event && "lineno" in event;
}
