// `Event`, `EventTarget` and `CustomEvent`, as DOM § 2 defines them: event-target-shim's, with what
// a listener throws reported as HTML reports an exception, and the package's warnings routed.

import { afterEach, describe, expect, it, rs } from "@rstest/core";

import { fillEvents } from "../../src/fills/web/events.ts";
import { hearReports, stopHearing } from "./reports.ts";

afterEach(() => {
	stopHearing();
	rs.restoreAllMocks();
});

/** A thread without events, filled. */
function filled() {
	const scope: Record<string, unknown> = {};
	fillEvents(scope);
	return {
		scope,
		Event: scope["Event"] as typeof Event,
		EventTarget: scope["EventTarget"] as typeof EventTarget,
		CustomEvent: scope["CustomEvent"] as typeof CustomEvent,
	};
}

describe("the fill", () => {
	it("puts the three on a thread that lacks them, each made on first read, not enumerable", () => {
		const scope: Record<string, unknown> = {};
		fillEvents(scope);
		for (const name of ["Event", "EventTarget", "CustomEvent"])
			expect(Object.getOwnPropertyDescriptor(scope, name)?.get, name).toBeTypeOf("function");
		expect(Object.keys(scope)).toEqual([]);
		expect((scope["CustomEvent"] as typeof CustomEvent).name).toBe("CustomEvent");
	});

	it("leaves a thread's own", () => {
		const own = { Event, EventTarget, CustomEvent };
		const scope: Record<string, unknown> = { ...own };
		fillEvents(scope);
		expect(scope).toEqual(own);
	});
});

describe("EventTarget and Event", () => {
	it("calls listeners in order, with the event's target, and once only for once", () => {
		const { Event, EventTarget } = filled();
		const target = new EventTarget();
		const heard: string[] = [];
		const first = (event: Event) => heard.push(`first ${event.type} ${event.target === target}`);
		target.addEventListener("ping", first);
		target.addEventListener("ping", first);
		target.addEventListener("ping", () => heard.push("once"), { once: true });
		target.addEventListener("ping", { handleEvent: () => heard.push("object") });
		target.dispatchEvent(new Event("ping"));
		target.dispatchEvent(new Event("ping"));
		expect(heard).toEqual(["first ping true", "once", "object", "first ping true", "object"]);
	});

	it("answers false from dispatchEvent when a listener cancels a cancelable event", () => {
		const { Event, EventTarget } = filled();
		const target = new EventTarget();
		target.addEventListener("go", (event) => event.preventDefault());
		expect(target.dispatchEvent(new Event("go", { cancelable: true }))).toBe(false);
		expect(target.dispatchEvent(new Event("go"))).toBe(true);
	});

	it("stops at stopImmediatePropagation", () => {
		const { Event, EventTarget } = filled();
		const target = new EventTarget();
		const heard: string[] = [];
		target.addEventListener("go", (event) => {
			heard.push("a");
			event.stopImmediatePropagation();
		});
		target.addEventListener("go", () => heard.push("b"));
		target.dispatchEvent(new Event("go"));
		expect(heard).toEqual(["a"]);
	});

	it("sends what a listener throws to the error hook, and calls the next listener", () => {
		const caught: unknown[] = [];
		hearReports(caught);
		const { Event, EventTarget } = filled();
		const target = new EventTarget();
		const failure = new Error("a listener threw");
		let ran = 0;
		target.addEventListener("go", () => {
			throw failure;
		});
		target.addEventListener("go", () => ran++);
		expect(() => target.dispatchEvent(new Event("go"))).not.toThrow();
		expect(caught).toEqual([failure]);
		expect(ran).toBe(1);
	});

	it("adds a listener twice quietly, and sends the package's other warnings to the console", () => {
		const warn = rs.spyOn(console, "warn").mockImplementation(() => {});
		const { Event, EventTarget } = filled();
		const target = new EventTarget();
		const listener = () => {};
		target.addEventListener("go", listener);
		target.addEventListener("go", listener, { once: true });
		expect(warn).not.toHaveBeenCalled();
		target.addEventListener("go", null);
		new Event("go").preventDefault();
		expect(warn).toHaveBeenCalled();
	});
});

describe("CustomEvent", () => {
	it("is an Event of the thread's with its detail, null by default", () => {
		const { Event, CustomEvent } = filled();
		const event = new CustomEvent("note", { detail: { n: 1 }, cancelable: true });
		expect(event).toBeInstanceOf(Event);
		expect(event.detail).toEqual({ n: 1 });
		expect(event.cancelable).toBe(true);
		expect(new CustomEvent("note").detail).toBeNull();
		expect(Object.prototype.toString.call(event)).toBe("[object CustomEvent]");
	});

	it("is set again by initCustomEvent", () => {
		const { CustomEvent } = filled();
		const event = new CustomEvent("a");
		event.initCustomEvent("b", true, true, 7);
		expect([event.type, event.bubbles, event.cancelable, event.detail]).toEqual([
			"b",
			true,
			true,
			7,
		]);
	});

	it("reaches a listener of the thread's EventTarget", () => {
		const { EventTarget, CustomEvent } = filled();
		const target = new EventTarget();
		let detail: unknown;
		target.addEventListener("note", (event) => (detail = (event as CustomEvent).detail));
		target.dispatchEvent(new CustomEvent("note", { detail: "hi" }));
		expect(detail).toBe("hi");
	});
});
