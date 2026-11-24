// `EventSource`, against HTML's server-sent events, on a `fetch` whose responses the tests write
// chunk by chunk.

import { afterEach, describe, expect, it, rs } from "@rstest/core";

import {
	createEventSource,
	fillEventSource,
	MAX_EVENT_SIZE,
} from "../../src/fills/web/event-source.ts";

afterEach(() => {
	rs.useRealTimers();
});

/** One connection the server took: what it was asked, and how the test answers. */
interface Connection {
	url: string;
	headers: Headers;
	signal: AbortSignal;
	/** Sends text, or bytes, as one chunk of the body. */
	send(chunk: string | Uint8Array): void;
	/** Ends the body. */
	end(): void;
	/** Fails the body as a network error would. */
	fail(): void;
}

/** What the server answers each connection with. */
interface Answer {
	status?: number;
	contentType?: string;
	/** Rejects the fetch, as a network error does. */
	refuse?: boolean;
}

/** A thread with a `fetch` the test answers, and the connections it was asked for. */
function thread(
	answer: (index: number) => Answer = () => ({}),
	extra: Record<string, unknown> = {},
) {
	const connections: Connection[] = [];
	const waiting: ((connection: Connection) => void)[] = [];
	const encoder = new TextEncoder();
	const fetch = (url: string, init: RequestInit): Promise<Response> => {
		const index = connections.length;
		const { status = 200, contentType = "text/event-stream", refuse } = answer(index);
		let controller!: ReadableStreamDefaultController<Uint8Array>;
		const body = new ReadableStream<Uint8Array>({
			start(given) {
				controller = given;
			},
		});
		const signal = init.signal!;
		signal.addEventListener("abort", () => {
			try {
				controller.error(signal.reason);
			} catch {
				// Already closed.
			}
		});
		const connection: Connection = {
			url,
			headers: new Headers(init.headers),
			signal,
			send: (chunk) =>
				controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk),
			end: () => controller.close(),
			fail: () => controller.error(new TypeError("network error")),
		};
		connections.push(connection);
		waiting.shift()?.(connection);
		if (refuse) return Promise.reject(new TypeError("network error"));
		// A 204's response has no body.
		return Promise.resolve(
			new Response(status === 204 ? null : body, {
				status,
				headers: { "content-type": contentType },
			}),
		);
	};
	const scope: Record<string, unknown> = {
		EventTarget,
		Event,
		MessageEvent,
		AbortController,
		URL,
		TextDecoder,
		DOMException,
		fetch,
		...extra,
	};
	/** The next connection: one already made and not yet taken, or the next one made. */
	let taken = 0;
	const connection = (): Promise<Connection> =>
		taken < connections.length
			? Promise.resolve(connections[taken++]!)
			: new Promise((resolve) => {
					taken++;
					waiting.push(resolve);
				});
	return { scope, connections, connection };
}

/** What a source fires, in order, as `type: data` or the type alone. */
function heard(source: EventSource, types: string[]): string[] {
	const log: string[] = [];
	for (const type of types)
		source.addEventListener(type, (event) => {
			const data = (event as MessageEvent).data;
			log.push(data === undefined ? type : `${type}: ${data}`);
		});
	return log;
}

/** Until the events queued so far are fired. */
async function settle(): Promise<void> {
	for (let turn = 0; turn < 5; turn++) await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("a connection", () => {
	it("asks for the stream with the standard's headers, and opens on a 200 of text/event-stream", async () => {
		const { scope, connection } = thread(() => ({
			contentType: "text/event-stream; charset=utf-8",
		}));
		const Source = createEventSource(scope);
		const source = new Source("https://api.example/stream?a=1");
		const log = heard(source, ["open"]);
		expect(source.readyState).toBe(Source.CONNECTING);
		expect(source.url).toBe("https://api.example/stream?a=1");
		expect(source.withCredentials).toBe(false);
		const first = await connection();
		expect(first.url).toBe("https://api.example/stream?a=1");
		expect(first.headers.get("accept")).toBe("text/event-stream");
		expect(first.headers.get("cache-control")).toBe("no-store");
		expect(first.headers.has("last-event-id")).toBe(false);
		await settle();
		expect(log).toEqual(["open"]);
		expect(source.readyState).toBe(Source.OPEN);
		source.close();
	});

	it("dispatches each event, whatever the chunks split: lines, line ends and characters", async () => {
		const { scope, connection } = thread();
		const source = new (createEventSource(scope))("https://api.example/stream");
		const log = heard(source, ["message", "update"]);
		const stream = await connection();
		const bytes = new TextEncoder().encode(
			': a comment\r\ndata: café\r\ndata:second line\r\n\r\nevent: update\ndata: {"n":1}\n\ndata: cr\r\rdata\n\ndata:  two spaces\n\n',
		);
		for (let index = 0; index < bytes.length; index += 3)
			stream.send(bytes.slice(index, index + 3));
		await settle();
		expect(log).toEqual([
			"message: café\nsecond line",
			'update: {"n":1}',
			"message: cr",
			"message: ",
			"message:  two spaces",
		]);
		source.close();
	});

	it("gives each event its origin and the last event ID, which an id field keeps until another", async () => {
		const { scope, connection } = thread();
		const source = new (createEventSource(scope))("https://api.example:8443/stream");
		const events: MessageEvent[] = [];
		source.onmessage = (event) => events.push(event);
		const stream = await connection();
		stream.send("id: 1\ndata: a\n\ndata: b\n\nid\ndata: c\n\nid: 2\u0000\ndata: d\n\n");
		await settle();
		expect(events.map((event) => [event.data, event.lastEventId, event.origin])).toEqual([
			["a", "1", "https://api.example:8443"],
			["b", "1", "https://api.example:8443"],
			["c", "", "https://api.example:8443"],
			["d", "", "https://api.example:8443"],
		]);
		expect(events[0]).toBeInstanceOf(MessageEvent);
		expect(events[0]!.type).toBe("message");
		source.close();
	});

	it("drops an event the stream ends in the middle of", async () => {
		const { scope, connection } = thread();
		const source = new (createEventSource(scope))("https://api.example/stream");
		const log = heard(source, ["message"]);
		const stream = await connection();
		stream.send("data: whole\n\ndata: half");
		stream.end();
		await settle();
		expect(log).toEqual(["message: whole"]);
		source.close();
	});
});

describe("reconnection", () => {
	it("sends an ID past Latin-1 as its UTF-8 bytes, as browsers do", async () => {
		const { scope, connection } = thread();
		const source = new (createEventSource(scope))("https://api.example/stream");
		const first = await connection();
		first.send("retry: 10\nid: 日本\ndata: one\n\n");
		first.end();
		const second = await connection();
		expect(second.headers.get("last-event-id")).toBe(Buffer.from("日本").toString("latin1"));
		source.close();
	});

	it("follows the end of the stream after the retry time, sending the last event ID", async () => {
		const { scope, connection } = thread();
		const source = new (createEventSource(scope))("https://api.example/stream");
		const log = heard(source, ["open", "message", "error"]);
		const first = await connection();
		first.send("retry: 100\nid: 7\ndata: one\n\n");
		first.end();
		await settle();
		expect(log).toEqual(["open", "message: one", "error"]);
		expect(source.readyState).toBe(source.CONNECTING);
		const second = await connection();
		expect(second.headers.get("last-event-id")).toBe("7");
		second.send("data: two\n\n");
		await settle();
		expect(log).toEqual(["open", "message: one", "error", "open", "message: two"]);
		expect(source.readyState).toBe(source.OPEN);
		source.close();
	});

	it("waits 3 seconds by default, and follows a network error the same way", async () => {
		rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		const { scope, connections } = thread((index) => ({ refuse: index === 0 }));
		const source = new (createEventSource(scope))("https://api.example/stream");
		const log = heard(source, ["open", "error"]);
		await rs.advanceTimersByTimeAsync(0);
		expect(log).toEqual(["error"]);
		expect(source.readyState).toBe(source.CONNECTING);
		await rs.advanceTimersByTimeAsync(2_999);
		expect(connections).toHaveLength(1);
		await rs.advanceTimersByTimeAsync(1);
		expect(connections).toHaveLength(2);
		await rs.advanceTimersByTimeAsync(0);
		expect(log).toEqual(["error", "open"]);
		source.close();
	});

	it("follows a body that fails midway", async () => {
		const { scope, connection } = thread();
		const source = new (createEventSource(scope))("https://api.example/stream");
		const log = heard(source, ["open", "message", "error"]);
		const first = await connection();
		first.send("retry: 1\ndata: one\n\n");
		await settle();
		first.fail();
		await connection();
		await settle();
		expect(log).toEqual(["open", "message: one", "error", "open"]);
		source.close();
	});

	it.each([
		["a status other than 200", { status: 204 }],
		["a server error", { status: 500 }],
		["another content type", { contentType: "application/json" }],
	])("is not tried after %s: the source closes", async (_name, answer) => {
		const { scope, connections } = thread(() => answer);
		const source = new (createEventSource(scope))("https://api.example/stream");
		const log = heard(source, ["open", "error"]);
		await settle();
		expect(log).toEqual(["error"]);
		expect(source.readyState).toBe(source.CLOSED);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(connections).toHaveLength(1);
	});
});

describe("close", () => {
	it("closes the source, aborts its fetch, and fires nothing more", async () => {
		const { scope, connection, connections } = thread();
		const source = new (createEventSource(scope))("https://api.example/stream");
		const log = heard(source, ["open", "message", "error"]);
		const stream = await connection();
		stream.send("retry: 1\ndata: one\n\n");
		await settle();
		source.close();
		expect(source.readyState).toBe(source.CLOSED);
		expect(stream.signal.aborted).toBe(true);
		await settle();
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(log).toEqual(["open", "message: one"]);
		expect(connections).toHaveLength(1);
	});

	it("before the response comes, keeps the open from firing", async () => {
		const { scope } = thread();
		const source = new (createEventSource(scope))("https://api.example/stream");
		const log = heard(source, ["open", "error"]);
		source.close();
		await settle();
		expect(log).toEqual([]);
	});
});

describe("the untrusted-input limit", () => {
	it("is 4 Mi characters by default", () => {
		expect(MAX_EVENT_SIZE).toBe(4 * 1024 * 1024);
	});

	it.each([
		["an event's data", "data: 0123456789\n".repeat(20)],
		["a line", `data: ${"x".repeat(200)}`],
	])("fails the connection when %s passes it", async (_name, text) => {
		const { scope, connection, connections } = thread();
		const source = new (createEventSource(scope, { maxEventSize: 100 }))(
			"https://api.example/stream",
		);
		const log = heard(source, ["open", "message", "error"]);
		const stream = await connection();
		stream.send("retry: 1\ndata: small\n\n");
		for (let index = 0; index < text.length; index += 10)
			stream.send(text.slice(index, index + 10));
		await settle();
		expect(log).toEqual(["open", "message: small", "error"]);
		expect(source.readyState).toBe(source.CLOSED);
		expect(stream.signal.aborted).toBe(true);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(connections).toHaveLength(1);
	});
});

describe("the class", () => {
	it("has the standard's constants, name and handlers", () => {
		const { scope } = thread();
		const Source = createEventSource(scope);
		expect(Source.name).toBe("EventSource");
		expect([Source.CONNECTING, Source.OPEN, Source.CLOSED]).toEqual([0, 1, 2]);
		expect(Source.prototype.CLOSED).toBe(2);
		const source = new Source("https://api.example/stream", { withCredentials: true });
		expect(source).toBeInstanceOf(EventTarget);
		expect(source.withCredentials).toBe(true);
		expect(Object.prototype.toString.call(source)).toBe("[object EventSource]");
		expect([source.onopen, source.onmessage, source.onerror]).toEqual([null, null, null]);
		source.close();
	});

	it("refuses a URL it can't parse with a SyntaxError DOMException", () => {
		const { scope } = thread();
		const Source = createEventSource(scope);
		expect(() => new Source("not a url")).toThrow(
			expect.objectContaining({ name: "SyntaxError", constructor: DOMException }),
		);
	});

	it("gives an Event with the message's fields on a thread without MessageEvent", async () => {
		const { scope, connection } = thread(() => ({}), { MessageEvent: undefined });
		const source = new (createEventSource(scope))("https://api.example/stream");
		const events: MessageEvent[] = [];
		source.addEventListener("message", (event) => events.push(event as MessageEvent));
		(await connection()).send("id: 3\ndata: hi\n\n");
		await settle();
		expect(events[0]).toBeInstanceOf(Event);
		expect([events[0]!.data, events[0]!.lastEventId, events[0]!.origin]).toEqual([
			"hi",
			"3",
			"https://api.example",
		]);
		source.close();
	});

	it("goes on the background's global object, made on first read, and leaves a thread's own", () => {
		const { scope } = thread();
		fillEventSource(scope);
		expect(Object.getOwnPropertyDescriptor(scope, "EventSource")?.get).toBeTypeOf("function");
		expect((scope["EventSource"] as typeof EventSource).name).toBe("EventSource");
		const own = { EventSource: class EventSource {} };
		const other: Record<string, unknown> = { ...own };
		fillEventSource(other);
		expect(other).toEqual(own);
	});
});
