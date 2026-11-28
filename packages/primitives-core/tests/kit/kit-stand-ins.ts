// Stand-ins for a platform's elements and events: core compares them by identity, hands them back
// and never reads them, so a named object is enough.

/** An element of the platform, named for the test's messages. */
export function element(name: string): Element {
	return { name } as unknown as Element;
}

/** An event of the platform: its type, and any field a decision reads (a click's `detail`). */
export function event(type = "click", fields: object = {}): Event {
	return { type, ...fields } as unknown as Event;
}
