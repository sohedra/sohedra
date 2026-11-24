// The binding hears a polyfill's `error` events on the global object, once per realm.

import { describe, expect, it } from "@rstest/core";

import { hearErrorEvents } from "../../../src/wire/index.ts";

/** A global object that is an `EventTarget`, as `@sohedra/lynx-polyfill` makes it. */
function eventTargetScope() {
	const target = new EventTarget();
	return {
		addEventListener: target.addEventListener.bind(target),
		dispatchEvent: target.dispatchEvent.bind(target),
	};
}

/** An `error` event for `error`, as the polyfill fires one. */
function errorEvent(error: unknown): Event {
	return Object.assign(new Event("error", { cancelable: true }), { error, message: String(error) });
}

describe("hearing a polyfill's errors", () => {
	it("reports each error event's error, and keeps the polyfill from reporting it again", () => {
		const scope = eventTargetScope();
		const heard: unknown[] = [];
		hearErrorEvents(scope, (error) => heard.push(error));
		const thrown = new Error("from a listener");
		const event = errorEvent(thrown);
		scope.dispatchEvent(event);
		expect(heard).toEqual([thrown]);
		expect(event.defaultPrevented).toBe(true);
	});

	it("leaves an event the app's own listener prevented", () => {
		const scope = eventTargetScope();
		scope.addEventListener("error", (event: Event) => event.preventDefault());
		const heard: unknown[] = [];
		hearErrorEvents(scope, (error) => heard.push(error));
		scope.dispatchEvent(errorEvent(new Error("handled by the app")));
		expect(heard).toEqual([]);
	});

	it("listens once in a realm that pages share: the first page's report hears them", () => {
		const scope = eventTargetScope();
		const first: unknown[] = [];
		const second: unknown[] = [];
		hearErrorEvents(scope, (error) => first.push(error));
		hearErrorEvents(scope, (error) => second.push(error));
		scope.dispatchEvent(errorEvent("once"));
		expect(first).toEqual(["once"]);
		expect(second).toEqual([]);
	});

	it("does nothing on a global object that is no EventTarget: no polyfill was imported", () => {
		const scope: Record<string, unknown> = {};
		expect(() => hearErrorEvents(scope, () => {})).not.toThrow();
		expect(Object.getOwnPropertySymbols(scope)).toEqual([]);
	});
});
