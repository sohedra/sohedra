// `EventSource`: HTML § 9.2 "Server-sent events", over the thread's `fetch` (streaming, so each
// event comes as it arrives), its `TextDecoder` and `URL`, with eventsource-parser reading the
// `text/event-stream` format (§ 9.2.6). Background only, with `fetch`. Experimental, and not in the
// baseline: `@sohedra/lynx-polyfill/event-source` installs it.
//
// Untrusted data is held to a maximum size (`MAX_EVENT_SIZE`, in characters) of what the parser
// holds at once: a line it has not seen the end of, and the data of the event it has not finished.
// Past it the connection fails, as for a response that is not an event stream: the source closes
// and fires `error`, and is not tried again.
//
// Leaves out: a relative URL, as a thread has no document to resolve it against; `withCredentials`
// changes nothing, as Lynx's `fetch` sends no cookies of its own. On a thread without
// `MessageEvent` an event is an `Event` with the message's `data`, `origin` and `lastEventId`.

import { experimental } from "../experimental.ts";
import type { Scope } from "../globals.ts";
import { readTimers } from "../globals.ts";
import { installLazy, named } from "../install.ts";
import { createParser } from "../vendor/event-source-parser.js";
import type { EventSourceParser } from "../vendor/event-source-parser.js";
import { domException } from "./dom-exception.ts";
import { eventHandlerProperty } from "./event-handlers.ts";
import type {
	AbortControllerClass,
	EventClass,
	EventSourceClass,
	EventTargetClass,
	FetchFunction,
	MessageEventClass,
	TextDecoderClass,
	URLClass,
} from "./standard-classes.ts";

/**
 * The most characters a source holds of an event or a line before it fails its connection: 4 Mi
 * (8 MB as the engine's strings hold them). Far above what a streaming API sends as one event, as
 * an AI model's tokens or a JSON update; it keeps a hostile or broken server from growing the
 * background thread's memory without end.
 */
export const MAX_EVENT_SIZE: number = 4 * 1024 * 1024;

/** The limits a thread's `EventSource` holds untrusted data to. */
interface EventSourceLimits {
	/** The most characters of an unfinished event or line: `MAX_EVENT_SIZE` when left out. */
	maxEventSize?: number;
}

/**
 * Lynx's own `lynx.EventSource` delivers no events on Android, and is not on the global object.
 *
 * @workaround web-event-source kind=lynx-bug delete-when="lynx.EventSource delivers events on Android, follows the standard and is on the global object"
 */
export function fillEventSource(scope: Scope): void {
	installLazy(
		scope,
		"EventSource",
		experimental(MODULE, "EventSource", () => createEventSource(scope)),
		isFunction,
	);
}

/** The import that installs this fill. */
const MODULE = "@sohedra/lynx-polyfill/event-source";

const isFunction = (existing: unknown): boolean => typeof existing === "function";

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 2;

/** The reconnection time a source starts with (§ 9.2.2), in milliseconds. */
const RECONNECTION_TIME = 3000;

/** What a source holds. */
interface SourceState {
	url: string;
	origin: string;
	withCredentials: boolean;
	readyState: number;
	reconnectionTime: number;
	lastEventId: string;
	/** The fetch of the current connection, aborted by `close`. */
	controller: AbortController | undefined;
	/** The timer of a reconnection waiting to start. */
	timer: unknown;
}

/** The thread's `EventSource`, over its `fetch`, `EventTarget` and `URL`. */
export function createEventSource(
	scope: Scope,
	{ maxEventSize = MAX_EVENT_SIZE }: EventSourceLimits = {},
): EventSourceClass {
	// Boundary: the thread's classes, this folder's or an engine's.
	const Base = scope["EventTarget"] as EventTargetClass;
	const states = new WeakMap<object, SourceState>();
	const stateOf = (source: unknown): SourceState => {
		const state = typeof source === "object" && source !== null ? states.get(source) : undefined;
		if (!state) throw new TypeError("Illegal invocation: not an EventSource.");
		return state;
	};

	/** A message event of the thread's: a `MessageEvent`, or an `Event` with its fields. */
	const messageEvent = (type: string, data: string, state: SourceState): Event => {
		const fields = { data, origin: state.origin, lastEventId: state.lastEventId };
		// Boundary: the thread's `MessageEvent` and `Event`, which it may lack.
		const Message = scope["MessageEvent"] as MessageEventClass | undefined;
		if (typeof Message === "function") return new Message(type, fields);
		const event = new (scope["Event"] as EventClass)(type);
		for (const [key, value] of Object.entries({ ...fields, source: null, ports: [] }))
			Object.defineProperty(event, key, { value, enumerable: true });
		return event;
	};

	const fire = (source: EventSourceFill, type: string): void => {
		source.dispatchEvent(new (scope["Event"] as EventClass)(type));
	};

	/** § 9.2.3 "Fail the connection": closed for good. */
	const failConnection = (source: EventSourceFill, state: SourceState): void => {
		if (state.readyState === CLOSED) return;
		state.readyState = CLOSED;
		state.controller?.abort();
		fire(source, "error");
	};

	/** § 9.2.3 "Reestablish the connection": `error`, then a new connection after the wait. */
	const reestablish = (source: EventSourceFill, state: SourceState): void => {
		if (state.readyState === CLOSED) return;
		state.readyState = CONNECTING;
		state.controller = undefined;
		fire(source, "error");
		if (state.readyState !== CONNECTING) return;
		state.timer = readTimers().setTimeout(() => {
			state.timer = undefined;
			if (state.readyState === CONNECTING) connect(source, state);
		}, state.reconnectionTime);
	};

	/** § 9.2.2 the fetch of a connection, and § 9.2.5 reading its body. */
	const connect = (source: EventSourceFill, state: SourceState): void => {
		// Boundary: the thread's `AbortController` and `fetch`, this folder's or an engine's.
		const controller = new (scope["AbortController"] as AbortControllerClass)();
		state.controller = controller;
		const current = (): boolean => state.controller === controller && state.readyState !== CLOSED;
		const headers: Record<string, string> = {
			Accept: "text/event-stream",
			"Cache-Control": "no-store",
		};
		if (state.lastEventId !== "") headers["Last-Event-ID"] = headerValueOf(state.lastEventId);
		const parser = createParser({
			maxBufferSize: maxEventSize,
			onId: (id) => {
				state.lastEventId = id;
			},
			onRetry: (milliseconds) => {
				state.reconnectionTime = milliseconds;
			},
			onEvent: ({ event, data }) => {
				if (current()) source.dispatchEvent(messageEvent(event ?? "message", data, state));
			},
			onError: (error) => {
				if (error.type === "max-buffer-size-exceeded" && current()) failConnection(source, state);
			},
		});
		void Promise.resolve()
			.then(() =>
				(scope["fetch"] as FetchFunction)(state.url, {
					headers,
					signal: controller.signal,
					cache: "no-store",
					credentials: state.withCredentials ? "include" : "same-origin",
				}),
			)
			.then(
				async (response) => {
					if (!current()) return;
					const type = (response.headers.get("content-type") ?? "").split(";")[0]!.trim();
					if (response.status !== 200 || type.toLowerCase() !== "text/event-stream") {
						failConnection(source, state);
						return;
					}
					state.readyState = OPEN;
					fire(source, "open");
					if (!current()) return;
					try {
						await read(response, parser, current);
					} catch {
						// A network error midway: the connection is tried again, as at its end.
					}
					if (current()) reestablish(source, state);
				},
				() => {
					if (current()) reestablish(source, state);
				},
			);
	};

	/** Feeds the body's text to the parser as it arrives, while the connection is `current`. */
	const read = async (
		response: Response,
		parser: EventSourceParser,
		current: () => boolean,
	): Promise<void> => {
		// Boundary: the thread's `TextDecoder`, this folder's or an engine's.
		const decoder = new (scope["TextDecoder"] as TextDecoderClass)("utf-8");
		if (!response.body) {
			const text = await response.text();
			if (current()) parser.feed(text);
			return;
		}
		const reader = response.body.getReader();
		for (;;) {
			const { done, value } = await reader.read();
			if (!current()) {
				void reader.cancel().catch(() => {});
				return;
			}
			if (done) break;
			parser.feed(decoder.decode(value, { stream: true }));
		}
		parser.feed(decoder.decode());
	};

	class EventSourceFill extends Base {
		constructor(url: string | URL, init?: EventSourceInit) {
			super();
			let parsed: URL;
			try {
				// Boundary: the thread's `URL`, this folder's or an engine's.
				parsed = new (scope["URL"] as URLClass)(`${url as string}`);
			} catch {
				throw domException(
					scope,
					`EventSource can't connect to "${url as string}": it is not a URL.`,
					"SyntaxError",
				);
			}
			const state: SourceState = {
				url: parsed.href,
				origin: parsed.origin,
				withCredentials: Boolean(init?.withCredentials),
				readyState: CONNECTING,
				reconnectionTime: RECONNECTION_TIME,
				lastEventId: "",
				controller: undefined,
				timer: undefined,
			};
			states.set(this, state);
			connect(this, state);
		}

		get url(): string {
			return stateOf(this).url;
		}

		get withCredentials(): boolean {
			return stateOf(this).withCredentials;
		}

		get readyState(): number {
			return stateOf(this).readyState;
		}

		close(): void {
			const state = stateOf(this);
			state.readyState = CLOSED;
			if (state.timer !== undefined) readTimers().clearTimeout(state.timer);
			state.timer = undefined;
			const { controller } = state;
			state.controller = undefined;
			controller?.abort();
		}
	}

	// The ready states, as Web IDL's constants: on the class and its prototype, enumerable, fixed.
	for (const [name, value] of Object.entries({ CONNECTING, OPEN, CLOSED })) {
		const constant = { value, enumerable: true, writable: false, configurable: false };
		Object.defineProperty(EventSourceFill, name, constant);
		Object.defineProperty(EventSourceFill.prototype, name, constant);
	}
	for (const type of ["open", "message", "error"])
		Object.defineProperty(EventSourceFill.prototype, `on${type}`, eventHandlerProperty(type));
	// Boundary: the class above, as TypeScript's DOM library types it.
	return named(EventSourceFill, "EventSource") as unknown as EventSourceClass;
}

/**
 * `text` as a header's value: its UTF-8 bytes, one character each, as browsers send an event ID
 * (HTML § 9.2.4 "Last-Event-ID" is UTF-8 encoded). A header's value holds only Latin-1.
 */
function headerValueOf(text: string): string {
	let value = "";
	for (const character of text) {
		const point = character.codePointAt(0)!;
		if (point < 0x80) value += character;
		else if (point < 0x800) value += String.fromCharCode(0xc0 | (point >> 6), 0x80 | (point & 63));
		else if (point < 0x10000)
			value += String.fromCharCode(
				0xe0 | (point >> 12),
				0x80 | ((point >> 6) & 63),
				0x80 | (point & 63),
			);
		else
			value += String.fromCharCode(
				0xf0 | (point >> 18),
				0x80 | ((point >> 12) & 63),
				0x80 | ((point >> 6) & 63),
				0x80 | (point & 63),
			);
	}
	return value;
}
