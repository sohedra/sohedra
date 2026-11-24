// `AbortController` and `AbortSignal`, as DOM § 3.1 and § 3.2 define them, over the thread's
// `EventTarget`; and lynx-core's `fetch`, which reads only a signal's `aborted`, `reason` and
// `abort` listeners, rejecting with these signals' reasons.

import v8 from "node:v8";
import vm from "node:vm";

import { afterEach, describe, expect, it, rs } from "@rstest/core";

import { createAbort, fillAbort } from "../../src/fills/web/abort.ts";
import {
	DOMException as DOMExceptionFill,
	fillDOMException,
} from "../../src/fills/web/dom-exception.ts";
import { fillEvents } from "../../src/fills/web/events.ts";

afterEach(() => {
	rs.useRealTimers();
});

/** A thread with this folder's events and `DOMException`, and the pair. */
function filled() {
	const scope: Record<string, unknown> = {};
	fillDOMException(scope);
	fillEvents(scope);
	fillAbort(scope);
	return {
		scope,
		AbortController: scope["AbortController"] as typeof AbortController,
		AbortSignal: scope["AbortSignal"] as typeof AbortSignal,
		EventTarget: scope["EventTarget"] as typeof EventTarget,
	};
}

/** What `run` throws. */
function thrown(run: () => unknown): unknown {
	try {
		run();
	} catch (error) {
		return error;
	}
	return undefined;
}

describe("AbortController", () => {
	it("aborts its signal once, with an AbortError DOMException by default, and fires abort once", () => {
		const { AbortController, EventTarget } = filled();
		const controller = new AbortController();
		const { signal } = controller;
		expect(signal).toBeInstanceOf(EventTarget);
		expect([signal.aborted, signal.reason]).toEqual([false, undefined]);
		const heard: string[] = [];
		signal.addEventListener("abort", (event) => heard.push(`listener ${event.type}`));
		signal.onabort = () => heard.push("onabort");
		controller.abort();
		controller.abort("again");
		expect(heard).toEqual(["listener abort", "onabort"]);
		expect(signal.aborted).toBe(true);
		expect(signal.reason).toBeInstanceOf(DOMExceptionFill);
		expect((signal.reason as DOMException).name).toBe("AbortError");
		expect(controller.signal).toBe(signal);
	});

	it("keeps the reason it is given, and its signal sees it while the event fires", () => {
		const { AbortController } = filled();
		const controller = new AbortController();
		let seen: unknown;
		controller.signal.addEventListener("abort", () => (seen = controller.signal.reason));
		controller.abort("why");
		expect(seen).toBe("why");
		expect(thrown(() => controller.signal.throwIfAborted())).toBe("why");
	});

	it("is named as the standard's", () => {
		const { AbortController, AbortSignal } = filled();
		expect(AbortController.name).toBe("AbortController");
		expect(Object.prototype.toString.call(new AbortController().signal)).toBe(
			"[object AbortSignal]",
		);
		expect(AbortSignal.name).toBe("AbortSignal");
	});
});

describe("AbortSignal", () => {
	it("can't be constructed", () => {
		const { AbortSignal } = filled();
		expect(() => new (AbortSignal as unknown as new () => unknown)()).toThrow(TypeError);
	});

	it("throwIfAborted throws nothing until aborted", () => {
		const { AbortController } = filled();
		expect(() => new AbortController().signal.throwIfAborted()).not.toThrow();
	});

	it("abort() makes a signal already aborted, with the reason or an AbortError", () => {
		const { AbortSignal } = filled();
		expect(AbortSignal.abort("r").reason).toBe("r");
		const signal = AbortSignal.abort();
		expect(signal.aborted).toBe(true);
		expect((signal.reason as DOMException).name).toBe("AbortError");
	});

	it("timeout() aborts after the time with a TimeoutError, and refuses a bad time", () => {
		rs.useFakeTimers();
		const { AbortSignal } = filled();
		const signal = AbortSignal.timeout(100);
		let fired = 0;
		signal.addEventListener("abort", () => fired++);
		rs.advanceTimersByTime(99);
		expect(signal.aborted).toBe(false);
		rs.advanceTimersByTime(1);
		expect(signal.aborted).toBe(true);
		expect(fired).toBe(1);
		expect((signal.reason as DOMException).name).toBe("TimeoutError");
		expect(() => AbortSignal.timeout(-1)).toThrow(TypeError);
		expect(() => AbortSignal.timeout(Number.NaN)).toThrow(TypeError);
	});

	it("any() follows its sources: aborted at once by an aborted one, with its reason", () => {
		const { AbortSignal, AbortController } = filled();
		const signal = AbortSignal.any([new AbortController().signal, AbortSignal.abort("first")]);
		expect([signal.aborted, signal.reason]).toEqual([true, "first"]);
		expect(AbortSignal.any([]).aborted).toBe(false);
	});

	it("any() aborts when a source does, after the source's own event, each once", () => {
		const { AbortSignal, AbortController } = filled();
		const a = new AbortController();
		const b = new AbortController();
		const any = AbortSignal.any([a.signal, b.signal]);
		const order: string[] = [];
		a.signal.addEventListener("abort", () => order.push(`a ${any.aborted}`));
		any.addEventListener("abort", () => order.push("any"));
		a.abort("from a");
		b.abort("from b");
		expect(order).toEqual(["a true", "any"]);
		expect(any.reason).toBe("from a");
	});

	it("any() of an any() follows the first's sources", () => {
		const { AbortSignal, AbortController } = filled();
		const root = new AbortController();
		const inner = AbortSignal.any([root.signal]);
		const outer = AbortSignal.any([inner]);
		root.abort("r");
		expect([inner.reason, outer.reason]).toEqual(["r", "r"]);
	});

	it("any() holds its signals weakly from their sources, as DOM's weak sets do", async () => {
		v8.setFlagsFromString("--expose-gc");
		const collect = vm.runInNewContext("gc") as () => void;
		const { AbortSignal, AbortController } = filled();
		const root = new AbortController();
		const made: WeakRef<AbortSignal>[] = [];
		const make = () => {
			for (let index = 0; index < 100; index++) {
				const dependent = AbortSignal.any([root.signal]);
				dependent.addEventListener("abort", () => {});
				made.push(new WeakRef(dependent));
			}
		};
		make();
		for (let round = 0; round < 3; round++) {
			await new Promise((resolve) => setTimeout(resolve, 0));
			collect();
		}
		// The engine may keep the last one it made a little longer; the rest are gone.
		expect(made.filter((each) => each.deref() !== undefined).length).toBeLessThanOrEqual(1);
		const kept = AbortSignal.any([root.signal]);
		root.abort("r");
		expect(kept.reason).toBe("r");
	});

	it("any() refuses what is not a signal", () => {
		const { AbortSignal } = filled();
		expect(() => AbortSignal.any([{} as AbortSignal])).toThrow(TypeError);
	});

	it("removes a listener added with a signal when that signal aborts", () => {
		const { AbortController, EventTarget, scope } = filled();
		const Event = scope["Event"] as typeof globalThis.Event;
		const target = new EventTarget();
		const controller = new AbortController();
		let heard = 0;
		target.addEventListener("go", () => heard++, { signal: controller.signal });
		target.dispatchEvent(new Event("go"));
		controller.abort();
		target.dispatchEvent(new Event("go"));
		expect(heard).toBe(1);
	});
});

/** lynx-core's background pair: no statics, a plain `Error`, not an `EventTarget` (modules/fetch/AbortController.ts). */
function lynxCorePair() {
	class AbortSignal {
		aborted = false;
		reason: unknown;
		private listeners: (() => void)[] = [];
		addEventListener(_type: string, listener: () => void) {
			this.listeners.push(listener);
		}
		dispatch(reason: unknown) {
			this.aborted = true;
			this.reason = reason;
			for (const listener of this.listeners) listener();
		}
	}
	class AbortController {
		signal = new AbortSignal();
		abort(reason?: unknown) {
			const error = new Error("This operation was aborted");
			error.name = "AbortError";
			this.signal.dispatch(reason ?? error);
		}
	}
	return { AbortSignal, AbortController };
}

describe("the fill", () => {
	it("puts the pair on a thread that lacks it, made on first read", () => {
		const scope: Record<string, unknown> = {};
		fillDOMException(scope);
		fillEvents(scope);
		fillAbort(scope);
		expect(Object.getOwnPropertyDescriptor(scope, "AbortController")?.get).toBeTypeOf("function");
		expect(new (scope["AbortController"] as typeof AbortController)().signal.aborted).toBe(false);
	});

	it("replaces lynx-core's pair, which fails the check", () => {
		const core = lynxCorePair();
		const scope: Record<string, unknown> = { ...core };
		fillDOMException(scope);
		fillEvents(scope);
		fillAbort(scope);
		expect(scope["AbortController"]).not.toBe(core.AbortController);
		expect(typeof (scope["AbortSignal"] as typeof AbortSignal).any).toBe("function");
	});

	it("leaves a thread's own pair that works", () => {
		// One realm's pair: the test page's globals mix jsdom's events with Node's pair.
		const own = createAbort({ EventTarget, Event, DOMException });
		const scope: Record<string, unknown> = { ...own, DOMException, EventTarget, Event };
		fillAbort(scope);
		expect(scope["AbortController"]).toBe(own.AbortController);
		expect(scope["AbortSignal"]).toBe(own.AbortSignal);
	});

	it("makes the pair over the thread's own EventTarget", () => {
		const { AbortController } = createAbort({ EventTarget, Event, DOMException });
		const signal = new AbortController().signal;
		expect(signal).toBeInstanceOf(EventTarget);
	});
});

/**
 * lynx-core's background `fetch`, as far as it reads the signal (lynx/lynx.ts, `fetch`): rejects at
 * once when aborted, and on the signal's `abort` event; `respond` stands in for the network.
 */
function lynxCoreFetch(signal: AbortSignal): { response: Promise<string>; respond: () => void } {
	let respond = () => {};
	const response = new Promise<string>((resolve, reject) => {
		if (signal.aborted) return reject(signal.reason);
		signal.addEventListener("abort", () => reject(signal.reason));
		respond = () => {
			if (!signal.aborted) resolve("response");
		};
	});
	return { response, respond: () => respond() };
}

describe("lynx-core's fetch, given these signals", () => {
	it("rejects with the reason of a signal aborted before the request", async () => {
		const { AbortSignal } = filled();
		await expect(lynxCoreFetch(AbortSignal.abort("before")).response).rejects.toBe("before");
	});

	it("rejects with an AbortError when the request is aborted while it runs", async () => {
		const { AbortController } = filled();
		const controller = new AbortController();
		const { response, respond } = lynxCoreFetch(controller.signal);
		controller.abort();
		respond();
		await expect(response).rejects.toMatchObject({ name: "AbortError" });
	});

	it("resolves when nothing aborts", async () => {
		const { AbortController } = filled();
		const { response, respond } = lynxCoreFetch(new AbortController().signal);
		respond();
		await expect(response).resolves.toBe("response");
	});
});
