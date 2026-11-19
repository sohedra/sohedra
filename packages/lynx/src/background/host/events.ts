// `host`: the target for the host's events, which reach the background through lynx-core's
// `GlobalEventEmitter`, for Svelte's `on()`. The emitter has one listener of ours per event name
// while anything listens to it, which runs the page's listeners itself:
//   - a listener that throws is reported, and the others still run;
//   - a listener removed while another of its name is left never reaches the emitter, as lynx-core
//     stops Android's keyboard detection at any removal of a `keyboardstatuschanged` listener;
//   - the page's end removes what is left.
// A page that never listens never asks lynx-core for the emitter.

import { background } from "../globals.ts";
import type { EmitterListener, GlobalEventEmitter } from "../globals.ts";
import { reportError } from "../report.ts";

/**
 * The host's events and their arguments, for `on(host, …)`. Add the events your host sends to type
 * them:
 *
 * ```ts
 * declare module "@sohedra/lynx/host" {
 *   interface HostEvents {
 *     cartchanged: [count: number];
 *   }
 * }
 * ```
 */
export interface HostEvents {
	/**
	 * The on-screen keyboard opened or closed, with its height in Lynx's layout units: iOS sends
	 * `("on", height)` and `("off", 0)`; Android `("on" | "off", height, height)`, again as the
	 * height changes. `keyboard` reads it for you.
	 */
	keyboardstatuschanged: [status: "on" | "off", height: number, sameHeight?: number];
	/** The Lynx view's size changed, in Lynx's layout units. */
	onWindowResize: [width: number, height: number];
	/** The device's font scale changed. */
	onFontScaleChanged: [change: { scale: number }];
	/** A bundle Lynx was asked for did not load; Lynx has already reported it. */
	onDynamicComponentEvent: [
		event: {
			code: number;
			data: { url: string; sync: boolean; error_msg: string; mode: string };
		},
	];
}

/** A listener of the host's events: it gets the event's arguments. */
export type HostListener = (...args: never[]) => unknown;

/** What `host` is: a target for Svelte's `on()`. */
export interface Host {
	/** Listens to the host's event `type`; the listener gets the event's arguments. */
	addEventListener(type: string, listener: HostListener): void;
	removeEventListener(type: string, listener: HostListener): void;
}

/** The listeners of one event name, and the one listener the emitter has for them. */
interface Channel {
	emitter: GlobalEventEmitter;
	listener: EmitterListener;
	listeners: HostListener[];
}

const channels = new Map<string, Channel>();
/** Whether the page has ended: nothing listens until the next one starts. */
let ended = false;

function openChannel(type: string): Channel {
	const emitter = background.lynx.getJSModule("GlobalEventEmitter");
	const channel: Channel = {
		emitter,
		listeners: [],
		listener: (...args) => {
			// oxlint-disable-next-line unicorn/no-useless-spread -- copied: a listener may remove itself while the event runs
			for (const listener of [...channel.listeners]) {
				try {
					// Boundary: the host sends what it sends; the listener's types are the app's.
					(listener as (...args: unknown[]) => unknown)(...args);
				} catch (error) {
					reportError(error);
				}
			}
		},
	};
	emitter.addListener(type, channel.listener);
	channels.set(type, channel);
	return channel;
}

/**
 * The target for the host's events, for Svelte's `on()`: in an effect or an attachment, which stops
 * listening when they end. The listener gets the event's arguments.
 *
 * ```svelte
 * <script lang="ts">
 *   import { on } from "svelte/events";
 *   import { host } from "@sohedra/lynx/host";
 *
 *   $effect(() => on(host, "onWindowResize", (width, height) => resize(width, height)));
 * </script>
 * ```
 *
 * The host's events reach the background thread only: on the main thread, its listeners throw. A
 * listener that throws is reported into Lynx, and the others still run. When the page ends, its
 * listeners are dropped.
 */
export const host: Host = {
	addEventListener(type, listener) {
		if (ended) return;
		const channel = channels.get(type) ?? openChannel(type);
		if (!channel.listeners.includes(listener)) channel.listeners.push(listener);
	},
	removeEventListener(type, listener) {
		const channel = channels.get(type);
		if (!channel) return;
		const at = channel.listeners.indexOf(listener);
		if (at === -1) return;
		channel.listeners.splice(at, 1);
		if (channel.listeners.length > 0) return;
		channels.delete(type);
		channel.emitter.removeListener(type, channel.listener);
	},
};

/** A page starts: the host's events can be heard. */
export function openHostEvents(): void {
	ended = false;
}

/** The page has ended: the emitter's listeners go, and nothing listens until the next page. */
export function closeHostEvents(): void {
	ended = true;
	const open = [...channels];
	channels.clear();
	for (const [type, channel] of open) channel.emitter.removeListener(type, channel.listener);
}

declare module "svelte/events" {
	/**
	 * Listens to the host's event `type`, and returns a function that stops. The listener gets the
	 * event's arguments. Call it in an effect or an attachment, which stops it when they end.
	 */
	export function on<Type extends keyof HostEvents>(
		host: Host,
		type: Type,
		handler: (...args: HostEvents[Type]) => unknown,
	): () => void;
	/**
	 * Listens to an event the host sends that `HostEvents` does not name: its arguments are
	 * `unknown` until `HostEvents` names it.
	 */
	export function on(
		host: Host,
		type: string,
		handler: (...args: unknown[]) => unknown,
	): () => void;
}
