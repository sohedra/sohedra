// The event grammar: how an attribute written in a component names a Lynx event.
// A component writes `ontap`, `ontapcapture`, `oncatchtap` or `oncatchtapcapture`; Lynx's own
// spellings are `bindtap`, `capture-bindtap`, `catchtap` and `capture-catchtap`.

/**
 * Lynx's spelling of an event attribute: `ontap` is `bindtap`, `ontapcapture` is
 * `capture-bindtap`, `oncatchtap` is `catchtap` and `oncatchtapcapture` is `capture-catchtap`.
 * Svelte's rule decides what is the capture phase, so `ongotpointercapture` is an event with
 * `capture` in its name, not a capture listener. A name that does not start with `on` comes back
 * as it is.
 */
export function lynxEventName(name: string): string {
	if (!name.startsWith("on")) return name;
	let event = name.slice(2);
	const capture =
		event.endsWith("capture") && event !== "gotpointercapture" && event !== "lostpointercapture";
	if (capture) event = event.slice(0, -"capture".length);
	if (event.startsWith("catch") && event.length > "catch".length) {
		return `${capture ? "capture-catch" : "catch"}${event.slice("catch".length)}`;
	}
	return `${capture ? "capture-bind" : "bind"}${event}`;
}

/** An event attribute written in Lynx's own spelling, which a component no longer writes. */
export interface RemovedEventSpelling {
	/** The event's name, as written after the prefix. */
	event: string;
	/** What to write instead, or `undefined` when no attribute replaces it. */
	replacement: string | undefined;
}

const LYNX_SPELLING = /^(capture-bind|capture-catch|global-bind|bind|catch)(.+)$/;

/** What replaces `prefix` followed by `event`: the spelling of the grammar above. */
function replacement(prefix: string, event: string): string | undefined {
	switch (prefix) {
		case "bind":
			return `on${event}`;
		case "catch":
			return `oncatch${event}`;
		case "capture-bind":
			return `on${event}capture`;
		case "capture-catch":
			return `oncatch${event}capture`;
		default:
			// `global-bind`: a listener on the page's root is `on(root, …)`.
			return undefined;
	}
}

/**
 * What a component writes in place of an attribute in Lynx's own spelling: `bindtap` is `ontap`,
 * `catchtap` is `oncatchtap`, `capture-bindtap` is `ontapcapture`, `capture-catchtap` is
 * `oncatchtapcapture`, and `global-bindtap` has no attribute. `undefined` for any other name.
 */
export function removedEventSpelling(name: string): RemovedEventSpelling | undefined {
	const match = LYNX_SPELLING.exec(name);
	if (match === null) return undefined;
	// Boundary: a match of this pattern always has both groups, which the type calls optional.
	const [, prefix, event] = match as unknown as [string, string, string];
	return { event, replacement: replacement(prefix, event) };
}
