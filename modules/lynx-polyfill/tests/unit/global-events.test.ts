// The global object as an `EventTarget`: WinterTC § 6, with HTML's `ErrorEvent`, "report an
// exception", `reportError` and `PromiseRejectionEvent`. Each error a fill catches is an `error`
// event first; a listener's `preventDefault()`, or `true` from `onerror`, keeps it from the hook.

import { afterEach, describe, expect, it } from "@rstest/core";

import { reportCaught, setErrorDispatch } from "../../src/fills/errors.ts";
import { fillEvents } from "../../src/fills/web/events.ts";
import { fillGlobalEvents } from "../../src/fills/web/global-events.ts";
import { hearReports, stopHearing } from "./reports.ts";

afterEach(() => {
	stopHearing();
	setErrorDispatch(undefined);
});

/** A thread without events, filled, whose caught errors land in `caught`. */
function filled() {
	const scope: Record<string, unknown> = {};
	fillEvents(scope);
	fillGlobalEvents(scope);
	const caught: unknown[] = [];
	hearReports(caught);
	return {
		scope,
		caught,
		on: scope as unknown as typeof globalThis,
		ErrorEvent: scope["ErrorEvent"] as typeof ErrorEvent,
		PromiseRejectionEvent: scope["PromiseRejectionEvent"] as typeof PromiseRejectionEvent,
		Event: scope["Event"] as typeof Event,
		reportError: scope["reportError"] as (error: unknown) => void,
	};
}

describe("ErrorEvent", () => {
	it("is an Event with HTML's fields and their defaults", () => {
		const { ErrorEvent, Event } = filled();
		const empty = new ErrorEvent("error");
		expect(empty).toBeInstanceOf(Event);
		expect([empty.message, empty.filename, empty.lineno, empty.colno, empty.error]).toEqual([
			"",
			"",
			0,
			0,
			undefined,
		]);
		const error = new Error("x");
		const full = new ErrorEvent("error", {
			message: "m",
			filename: "f.js",
			lineno: 3,
			colno: 4,
			error,
			cancelable: true,
		});
		expect([full.message, full.filename, full.lineno, full.colno, full.error]).toEqual([
			"m",
			"f.js",
			3,
			4,
			error,
		]);
		expect(full.cancelable).toBe(true);
		expect(ErrorEvent.name).toBe("ErrorEvent");
	});
});

describe("PromiseRejectionEvent", () => {
	it("has its promise and reason, and refuses an init without a promise", () => {
		const { PromiseRejectionEvent, Event } = filled();
		const promise = Promise.resolve();
		const event = new PromiseRejectionEvent("unhandledrejection", { promise, reason: 1 });
		expect(event).toBeInstanceOf(Event);
		expect([event.promise, event.reason]).toEqual([promise, 1]);
		expect(
			() => new PromiseRejectionEvent("x", undefined as unknown as PromiseRejectionEventInit),
		).toThrow(TypeError);
	});
});

describe("the global object", () => {
	it("is an EventTarget: its listeners hear what it dispatches", () => {
		const { on, Event } = filled();
		const heard: string[] = [];
		const listener = (event: Event) => heard.push(event.type);
		on.addEventListener("ping", listener);
		on.dispatchEvent(new Event("ping"));
		on.removeEventListener("ping", listener);
		on.dispatchEvent(new Event("ping"));
		expect(heard).toEqual(["ping"]);
	});

	it("fires reportError's error as an error event, then sends it to the hook", () => {
		const { on, caught, reportError } = filled();
		const failure = new Error("reported");
		const heard: ErrorEvent[] = [];
		on.addEventListener("error", (event) => heard.push(event as ErrorEvent));
		reportError(failure);
		expect(heard.length).toBe(1);
		expect([heard[0]!.error, heard[0]!.message, heard[0]!.cancelable]).toEqual([
			failure,
			"Uncaught Error: reported",
			true,
		]);
		expect(caught).toEqual([failure]);
	});

	it("fires what a fill catches, a value that is not an Error too", () => {
		const { on, caught } = filled();
		const messages: string[] = [];
		on.addEventListener("error", (event) => messages.push((event as ErrorEvent).message));
		reportCaught("plain");
		expect(messages).toEqual(["Uncaught plain"]);
		expect(caught).toEqual(["plain"]);
	});

	it("keeps an error from the hook when a listener cancels its event", () => {
		const { on, caught, reportError } = filled();
		on.addEventListener("error", (event) => event.preventDefault());
		reportError(new Error("handled"));
		expect(caught).toEqual([]);
	});

	it("gives onerror HTML's five arguments, and keeps the error from the hook when it answers true", () => {
		const { on, caught, reportError } = filled();
		const failure = new Error("boom");
		const given: unknown[][] = [];
		on.onerror = (...args: unknown[]) => {
			given.push(args);
			return true;
		};
		reportError(failure);
		expect(given).toEqual([["Uncaught Error: boom", "", 0, 0, failure]]);
		expect(caught).toEqual([]);
		on.onerror = () => false;
		reportError(failure);
		expect(caught).toEqual([failure]);
		on.onerror = null;
		expect(on.onerror).toBeNull();
	});

	it("reports what a listener of the error event throws, and fires no event for it", () => {
		const { on, caught, reportError } = filled();
		const original = new Error("original");
		const thrown = new Error("from the listener");
		let fired = 0;
		on.addEventListener("error", () => {
			fired++;
			throw thrown;
		});
		reportError(original);
		expect(fired).toBe(1);
		expect(caught).toEqual([thrown, original]);
	});

	it("has no onunhandledrejection or onrejectionhandled: Lynx never fires them", () => {
		const { on } = filled();
		expect("onunhandledrejection" in on).toBe(false);
		expect("onrejectionhandled" in on).toBe(false);
	});

	it("refuses reportError with no argument", () => {
		const { reportError } = filled();
		expect(() => (reportError as () => void)()).toThrow(TypeError);
	});

	it("runs a handler set after listeners in the order it was first set, as on the web", () => {
		const { on, Event } = filled();
		const order: string[] = [];
		on.onerror = () => order.push("handler");
		on.addEventListener("error", () => order.push("listener"));
		on.onerror = () => order.push("handler again");
		on.dispatchEvent(new Event("error"));
		expect(order).toEqual(["handler again", "listener"]);
	});
});

describe("the fill", () => {
	it("leaves a global object that is already an EventTarget", () => {
		const addEventListener = () => {};
		const scope: Record<string, unknown> = { addEventListener };
		fillEvents(scope);
		fillGlobalEvents(scope);
		expect(scope["addEventListener"]).toBe(addEventListener);
		expect(scope["onerror"]).toBeUndefined();
	});
});

describe("an error event's message", () => {
	it("names the error without running its getters, as HTML's report of an exception", () => {
		const { on, reportError } = filled();
		const messages: string[] = [];
		on.addEventListener("error", (event) => messages.push((event as ErrorEvent).message));
		let read = false;
		reportError({
			get message() {
				read = true;
				return "no";
			},
		});
		reportError(new TypeError());
		expect(read).toBe(false);
		expect(messages).toEqual(["Uncaught exception", "Uncaught TypeError"]);
	});
});
