// `MessageChannel`, `MessagePort` and `MessageEvent`: HTML § 9.3.1 "The MessageEvent interface",
// § 9.4 "Channel messaging" and § 9.5 its ports. Both threads lack them. Experimental, and not in
// the baseline: `@sohedra/lynx-polyfill/messaging` installs it. Over the thread's `Event`, `EventTarget` and `structuredClone`.
//
// A channel's two ports live on one thread: a message is copied as it is posted (a `DataCloneError`
// then, as the standard throws it) and delivered as a task of that thread, in order, once the
// receiving port is started (`start()`, or setting `onmessage`). Ports given in the transfer list
// move to the receiver, as new ports in `event.ports`; the ones given go dead.
//
// Leaves out: ports across threads, which Lynx's threads can't share (cross-thread code calls
// `runOnBackground` and `runOnMainThread`); transferring anything but a port (an `ArrayBuffer` is a
// `DataCloneError`); a port inside the message's data, which arrives as a plain copy (the moved
// port is in `event.ports`); and `messageerror`, whose handler is there and never called: the copy
// is made as the message is posted, so receiving it can't fail.

import { experimental } from "../experimental.ts";
import type { Scope } from "../globals.ts";
import { readTimers } from "../globals.ts";
import { installLazy, named } from "../install.ts";
import { domException } from "./dom-exception.ts";
import { eventHandlerProperty } from "./event-handlers.ts";
import type {
	EventClass,
	EventTargetClass,
	MessageChannelClass,
	MessageEventClass,
	MessagePortClass,
} from "./standard-classes.ts";

/** @workaround web-messaging kind=lynx-gap delete-when="Lynx's threads have MessageChannel, MessagePort and MessageEvent" */
export function fillMessaging(scope: Scope): void {
	let made: ReturnType<typeof createMessaging> | undefined;
	const make = () => (made ??= createMessaging(scope));
	for (const name of ["MessageChannel", "MessagePort", "MessageEvent"] as const)
		installLazy(
			scope,
			name,
			experimental(MODULE, name, () => make()[name]),
			isFunction,
		);
}

/** The import that installs this fill. */
const MODULE = "@sohedra/lynx-polyfill/messaging";

const isFunction = (existing: unknown): boolean => typeof existing === "function";

/** A message waiting in a port's queue: its copied data and the ports moved with it. */
interface Message {
	data: unknown;
	ports: MessagePort[];
}

/** What a port holds. */
interface PortState {
	/** The other port of its channel; `null` once either is closed or this one moved. */
	entangled: MessagePort | null;
	/** Whether its queue delivers: `start()` or `onmessage` turns it on. */
	enabled: boolean;
	/** Whether it moved to another port in a transfer list: it neither sends nor can move again. */
	detached: boolean;
	closed: boolean;
	queue: Message[];
	/** Whether a task to deliver the queue's first message is waiting. */
	scheduled: boolean;
}

/** What an event holds. */
interface EventFields {
	data: unknown;
	origin: string;
	lastEventId: string;
	source: unknown;
	ports: readonly MessagePort[];
}

/** The thread's `MessageChannel`, `MessagePort` and `MessageEvent`, over its own events. */
export function createMessaging(scope: Scope): {
	MessageChannel: MessageChannelClass;
	MessagePort: MessagePortClass;
	MessageEvent: MessageEventClass;
} {
	// Boundary: the thread's `Event` and `EventTarget`, this folder's or an engine's.
	const EventBase = scope["Event"] as EventClass;
	const TargetBase = scope["EventTarget"] as EventTargetClass;
	const eventFields = new WeakMap<object, EventFields>();
	const states = new WeakMap<object, PortState>();
	let creating = false;

	const fieldsOf = (event: unknown): EventFields => {
		const found = typeof event === "object" && event !== null ? eventFields.get(event) : undefined;
		if (!found) throw new TypeError("Illegal invocation: not a MessageEvent.");
		return found;
	};
	const stateOf = (port: unknown): PortState => {
		const found = typeof port === "object" && port !== null ? states.get(port) : undefined;
		if (!found) throw new TypeError("Illegal invocation: not a MessagePort.");
		return found;
	};

	class MessageEventFill extends EventBase {
		constructor(type: string, init: MessageEventInit = {}) {
			super(type, init);
			eventFields.set(this, {
				data: init.data === undefined ? null : init.data,
				origin: init.origin === undefined ? "" : `${init.origin}`,
				lastEventId: init.lastEventId === undefined ? "" : `${init.lastEventId}`,
				source: init.source ?? null,
				ports: Object.freeze([...(init.ports ?? [])]),
			});
		}

		get data(): unknown {
			return fieldsOf(this).data;
		}

		get origin(): string {
			return fieldsOf(this).origin;
		}

		get lastEventId(): string {
			return fieldsOf(this).lastEventId;
		}

		get source(): unknown {
			return fieldsOf(this).source;
		}

		get ports(): readonly MessagePort[] {
			return fieldsOf(this).ports;
		}

		initMessageEvent(
			...args: [
				type?: string,
				bubbles?: boolean,
				cancelable?: boolean,
				data?: unknown,
				origin?: string,
				lastEventId?: string,
				source?: unknown,
				ports?: MessagePort[],
			]
		): void {
			if (args.length === 0)
				throw new TypeError("initMessageEvent takes a type, and none was given.");
			const [
				type,
				bubbles = false,
				cancelable = false,
				data = null,
				origin = "",
				lastEventId = "",
				source = null,
				ports = [],
			] = args;
			// Boundary: DOM's legacy initializer, which every thread's `Event` has.
			(this as unknown as { initEvent: (...args: unknown[]) => void }).initEvent(
				type,
				bubbles,
				cancelable,
			);
			eventFields.set(this, {
				data,
				origin: `${origin}`,
				lastEventId: `${lastEventId}`,
				source,
				ports: Object.freeze([...ports]),
			});
		}
	}
	// Boundary: the class above, as TypeScript's DOM library types it.
	const MessageEventClass = named(MessageEventFill, "MessageEvent") as unknown as MessageEventClass;

	const newPort = (): MessagePort => {
		creating = true;
		try {
			// Boundary: the class below, as TypeScript's DOM library types it.
			return new MessagePortFill() as unknown as MessagePort;
		} finally {
			creating = false;
		}
	};

	/** Queues a task to deliver `port`'s first message, unless one waits or the port is off. */
	const schedule = (port: MessagePort): void => {
		const state = stateOf(port);
		if (state.scheduled || !state.enabled || state.closed || state.queue.length === 0) return;
		state.scheduled = true;
		readTimers().setTimeout(() => {
			state.scheduled = false;
			if (!state.enabled || state.closed) return;
			const message = state.queue.shift();
			if (!message) return;
			schedule(port);
			port.dispatchEvent(new MessageEventClass("message", message));
		}, 0);
	};

	/** HTML's transfer of a port: a new port takes its place in the channel and its queue. */
	const transfer = (port: MessagePort): MessagePort => {
		const from = stateOf(port);
		const moved = newPort();
		const to = stateOf(moved);
		to.entangled = from.entangled;
		to.queue = from.queue;
		if (from.entangled) stateOf(from.entangled).entangled = moved;
		Object.assign(from, { entangled: null, detached: true, queue: [], enabled: false });
		return moved;
	};

	/** The ports of a transfer list, checked as HTML checks them before anything is copied. */
	const portsOf = (list: Iterable<unknown>, sender: MessagePort): MessagePort[] => {
		const ports: MessagePort[] = [];
		for (const each of list) {
			const state = typeof each === "object" && each !== null ? states.get(each) : undefined;
			const refuse = (why: string) =>
				domException(scope, `MessagePort.postMessage can't transfer ${why}.`, "DataCloneError");
			if (!state) throw refuse("anything but a MessagePort on Lynx");
			// Boundary: a member of the list, now known to be a port.
			const port = each as MessagePort;
			if (port === sender) throw refuse("the port it is called on");
			if (ports.includes(port)) throw refuse("the same port twice");
			if (state.detached) throw refuse("a port that was already transferred");
			ports.push(port);
		}
		return ports;
	};

	class MessagePortFill extends TargetBase {
		constructor() {
			if (!creating)
				throw new TypeError("MessagePort can't be constructed: make one with a MessageChannel.");
			super();
			states.set(this, {
				entangled: null,
				enabled: false,
				detached: false,
				closed: false,
				queue: [],
				scheduled: false,
			});
		}

		postMessage(message: unknown, options: Transferable[] | StructuredSerializeOptions = []): void {
			// Boundary: the class itself, as TypeScript's DOM library types it.
			const self = this as unknown as MessagePort;
			const state = stateOf(self);
			const list = Array.isArray(options) ? options : (options?.transfer ?? []);
			const ports = portsOf(list, self);
			// Boundary: the thread's `structuredClone`, which this folder fills on both threads.
			const data = (scope["structuredClone"] as (value: unknown) => unknown)(message);
			const target = state.detached || state.closed ? null : state.entangled;
			const moved = ports.map(transfer);
			if (!target) return;
			stateOf(target).queue.push({ data, ports: moved });
			schedule(target);
		}

		start(): void {
			const state = stateOf(this);
			if (state.detached) return;
			state.enabled = true;
			// Boundary: the class itself, as TypeScript's DOM library types it.
			schedule(this as unknown as MessagePort);
		}

		close(): void {
			const state = stateOf(this);
			state.closed = true;
			state.queue = [];
			if (state.entangled) stateOf(state.entangled).entangled = null;
			state.entangled = null;
		}
	}
	const onmessage = eventHandlerProperty("message");
	Object.defineProperty(MessagePortFill.prototype, "onmessage", {
		...onmessage,
		// Setting `onmessage` starts the port, as HTML says.
		set(this: MessagePortFill, value: unknown) {
			onmessage.set!.call(this, value);
			if (typeof value === "function" || (typeof value === "object" && value !== null))
				this.start();
		},
	});
	Object.defineProperty(
		MessagePortFill.prototype,
		"onmessageerror",
		eventHandlerProperty("messageerror"),
	);

	const channels = new WeakMap<object, [MessagePort, MessagePort]>();
	const portsOfChannel = (channel: unknown): [MessagePort, MessagePort] => {
		const found =
			typeof channel === "object" && channel !== null ? channels.get(channel) : undefined;
		if (!found) throw new TypeError("Illegal invocation: not a MessageChannel.");
		return found;
	};

	class MessageChannelFill {
		constructor() {
			const port1 = newPort();
			const port2 = newPort();
			stateOf(port1).entangled = port2;
			stateOf(port2).entangled = port1;
			channels.set(this, [port1, port2]);
		}

		get port1(): MessagePort {
			return portsOfChannel(this)[0];
		}

		get port2(): MessagePort {
			return portsOfChannel(this)[1];
		}
	}

	return {
		// Boundary: the classes above, as TypeScript's DOM library types them.
		MessageChannel: named(MessageChannelFill, "MessageChannel") as unknown as MessageChannelClass,
		MessagePort: named(MessagePortFill, "MessagePort") as unknown as MessagePortClass,
		MessageEvent: MessageEventClass,
	};
}
