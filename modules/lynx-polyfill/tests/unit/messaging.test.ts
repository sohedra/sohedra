// `MessageChannel`, `MessagePort` and `MessageEvent`, against HTML's channel messaging, with Node's
// own as the reference for each scenario: what arrives, in what order, and what is refused.

import { describe, expect, it } from "@rstest/core";

import {
	Event as ShimEvent,
	EventTarget as ShimEventTarget,
} from "../../src/fills/vendor/events.js";
import { createMessaging, fillMessaging } from "../../src/fills/web/messaging.ts";

/** The three classes, as a thread has them. */
interface Messaging {
	MessageChannel: typeof MessageChannel;
	MessagePort: typeof MessagePort;
	MessageEvent: typeof MessageEvent;
}

const NODE: Messaging = { MessageChannel, MessagePort, MessageEvent };

/** The fill over Node's events and copy, and over the vendored events the events fill installs. */
const FILLS: [string, Messaging][] = [
	["Node's events", createMessaging({ Event, EventTarget, structuredClone, DOMException })],
	[
		"the events fill's",
		createMessaging({
			Event: ShimEvent,
			EventTarget: ShimEventTarget,
			structuredClone,
			DOMException,
		}),
	],
];

/** Waits for the tasks queued so far, and those they queue, to run. */
const tasks = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

/** What `run` throws, by name, or `"none"`. */
function thrownName(run: () => unknown): string {
	try {
		run();
	} catch (error) {
		return (error as Error).name;
	}
	return "none";
}

/** Each scenario logs what it sees, and closes every port it opens, so Node's let the process end. */
const SCENARIOS: Record<string, (classes: Messaging, log: unknown[]) => Promise<void>> = {
	"delivers in order, as tasks, after the posting code": async ({ MessageChannel }, log) => {
		const { port1, port2 } = new MessageChannel();
		port2.onmessage = (event) => log.push(event.data);
		port1.postMessage(1);
		port1.postMessage(2);
		log.push("sync");
		await Promise.resolve();
		log.push("microtask");
		await tasks();
		port1.close();
		port2.close();
	},
	"sends both ways": async ({ MessageChannel }, log) => {
		const { port1, port2 } = new MessageChannel();
		port1.onmessage = (event) => log.push(`1 got ${event.data}`);
		port2.onmessage = (event) => {
			log.push(`2 got ${event.data}`);
			port2.postMessage("pong");
		};
		port1.postMessage("ping");
		await tasks();
		port1.close();
		port2.close();
	},
	"copies the data: the receiver's is its own": async ({ MessageChannel }, log) => {
		const { port1, port2 } = new MessageChannel();
		const sent = { list: [1], when: new Date(0) };
		port2.onmessage = (event) => {
			log.push(event.data !== sent, event.data.list, event.data.when instanceof Date);
		};
		port1.postMessage(sent);
		sent.list.push(2);
		await tasks();
		port1.close();
		port2.close();
	},
	"delivers what was posted before the sender closed": async ({ MessageChannel }, log) => {
		const { port1, port2 } = new MessageChannel();
		port2.onmessage = (event) => log.push(event.data);
		port1.postMessage("last");
		port1.close();
		port1.postMessage("after close");
		await tasks();
		port2.close();
	},
	"drops what a closed receiver had not delivered": async ({ MessageChannel }, log) => {
		const { port1, port2 } = new MessageChannel();
		port2.onmessage = (event) => log.push(event.data);
		port1.postMessage("dropped");
		port2.close();
		await tasks();
		port1.close();
		log.push("done");
	},
	"stops when the handler is set to null": async ({ MessageChannel }, log) => {
		const { port1, port2 } = new MessageChannel();
		port2.onmessage = (event) => log.push(event.data);
		port2.onmessage = null;
		port1.postMessage("unheard");
		await tasks();
		log.push(port2.onmessage);
		port1.close();
		port2.close();
	},
	"moves a port through another, with the event's ports": async (
		{ MessageChannel, MessagePort },
		log,
	) => {
		const { port1, port2 } = new MessageChannel();
		const other = new MessageChannel();
		port2.onmessage = (event) => {
			const [moved] = event.ports;
			log.push(event.data, event.ports.length, moved instanceof MessagePort, moved === other.port1);
			moved!.onmessage = (inner) => {
				log.push(inner.data);
				moved!.close();
			};
		};
		port1.postMessage("port", [other.port1]);
		other.port2.postMessage("through the moved port");
		other.port1.postMessage("from the old one, which is gone");
		await tasks();
		port1.close();
		port2.close();
		other.port2.close();
	},
	"takes the transfer list as options": async ({ MessageChannel }, log) => {
		const { port1, port2 } = new MessageChannel();
		const other = new MessageChannel();
		port2.onmessage = (event) => {
			log.push(event.ports.length);
			event.ports[0]!.close();
		};
		port1.postMessage(null, { transfer: [other.port1] });
		await tasks();
		port1.close();
		port2.close();
		other.port2.close();
	},
	"refuses what can't be copied or moved with a DataCloneError": async (
		{ MessageChannel },
		log,
	) => {
		const { port1, port2 } = new MessageChannel();
		log.push(thrownName(() => port1.postMessage(() => 1)));
		log.push(thrownName(() => port1.postMessage(Symbol("s"))));
		log.push(thrownName(() => port1.postMessage(1, [port1])));
		log.push(thrownName(() => port1.postMessage(1, [{} as Transferable])));
		const other = new MessageChannel();
		log.push(thrownName(() => port1.postMessage(1, [other.port1, other.port1])));
		port1.close();
		port2.close();
		other.port1.close();
		other.port2.close();
	},
	"makes no port with new, and makes events with defaults": async (
		{ MessagePort, MessageEvent },
		log,
	) => {
		log.push(thrownName(() => new (MessagePort as unknown as new () => unknown)()));
		const event = new MessageEvent("message");
		log.push(event.data, event.origin, event.lastEventId, event.source, event.ports);
		log.push(event.type, event.bubbles);
		const given = new MessageEvent("message", { data: { a: 1 }, origin: "o", lastEventId: "7" });
		log.push(given.data, given.origin, given.lastEventId);
	},
};

describe.each(FILLS)("the fill over %s", (_name, fill) => {
	it.each(Object.keys(SCENARIOS))("%s, as Node's", async (scenario) => {
		const run = SCENARIOS[scenario]!;
		const expected: unknown[] = [];
		const actual: unknown[] = [];
		await run(NODE, expected);
		await run(fill, actual);
		expect(actual).toEqual(expected);
	});

	// Node starts a port as a "message" listener is added; HTML holds its messages until `start()`.
	it("holds messages until start(), with addEventListener", async () => {
		const { port1, port2 } = new fill.MessageChannel();
		const log: unknown[] = [];
		port2.addEventListener("message", (event) => log.push(event.data));
		port1.postMessage("held");
		await tasks();
		log.push("before start");
		port2.start();
		await tasks();
		expect(log).toEqual(["before start", "held"]);
		port1.close();
		port2.close();
	});

	it("gives an event's ports as a frozen list", () => {
		expect(Object.isFrozen(new fill.MessageEvent("message").ports)).toBe(true);
	});

	it("names its classes as the standard's", () => {
		for (const name of ["MessageChannel", "MessagePort", "MessageEvent"] as const) {
			expect(fill[name].name).toBe(name);
			expect(Object.prototype.toString.call(fill[name].prototype)).toBe(`[object ${name}]`);
		}
	});

	it("re-initializes an event with initMessageEvent", () => {
		const event = new fill.MessageEvent("x");
		event.initMessageEvent("message", false, true, 5, "origin", "id", null, []);
		expect([event.type, event.cancelable, event.data, event.origin, event.lastEventId]).toEqual([
			"message",
			true,
			5,
			"origin",
			"id",
		]);
	});

	it("has an onmessageerror handler", () => {
		const { port1, port2 } = new fill.MessageChannel();
		const handler = () => {};
		port1.onmessageerror = handler;
		expect(port1.onmessageerror).toBe(handler);
		port1.close();
		port2.close();
	});
});

describe("the fill", () => {
	it("puts the three on a thread that lacks them, made on first read", () => {
		const scope: Record<string, unknown> = { Event, EventTarget, structuredClone };
		fillMessaging(scope);
		for (const name of ["MessageChannel", "MessagePort", "MessageEvent"])
			expect(Object.getOwnPropertyDescriptor(scope, name)?.get, name).toBeTypeOf("function");
		const Channel = scope["MessageChannel"] as typeof MessageChannel;
		const { port1, port2 } = new Channel();
		expect(port1).toBeInstanceOf(scope["MessagePort"] as typeof MessagePort);
		expect(port1).toBeInstanceOf(EventTarget);
		port1.close();
		port2.close();
	});

	it("leaves a thread's own", () => {
		const scope: Record<string, unknown> = { ...NODE };
		fillMessaging(scope);
		expect(scope).toEqual(NODE);
	});
});

describe("MessageEvent's initMessageEvent", () => {
	it("needs a type, as Web IDL's required argument", () => {
		const { MessageEvent: Fill } = createMessaging({
			Event,
			EventTarget,
			structuredClone,
			DOMException,
		});
		const event = new Fill("message");
		expect(() => (event.initMessageEvent as () => void)()).toThrow(TypeError);
		event.initMessageEvent("other", false, false, 1);
		expect([event.type, event.data]).toEqual(["other", 1]);
	});
});
