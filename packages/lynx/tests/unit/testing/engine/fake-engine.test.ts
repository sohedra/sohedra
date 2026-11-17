// The engine's own side of events (the dispatch order, the stop bits, main-thread functions and
// plain listeners): what it calls, with what, and what it reads back, as Lynx does. The tests
// that run real main-thread functions rest on this; here the global `runWorklet` is a recorder,
// so no runtime is involved.

import { describe, expect, it } from "@rstest/core";

import { engineForEach, runWorkletRecorder, smallPage } from "./engine-fixture.ts";
import type { SmallPage } from "./engine-fixture.ts";

const engine = engineForEach();
const worklets = runWorkletRecorder();

/** `smallPage` and a function to bind a main-thread function (or none) to an event. */
function bindable(): SmallPage & {
	bind(element: SmallPage["page"], type: string, name: string, value: unknown): void;
} {
	const made = smallPage(engine());
	engine().functions.__SetDataset(made.inner, { row: 3 });
	return {
		...made,
		bind: (element, type, name, value) =>
			engine().functions.__AddEvent(
				element,
				type,
				name,
				value === undefined ? undefined : { type: "worklet", value },
			),
	};
}

/** The labels of the functions that ran, in order. */
const ran = (labels: Map<unknown, string>) => worklets.calls.map((call) => labels.get(call.value));

describe("an event bound with __AddEvent", () => {
	it("runs runWorklet(value, [event], { source: 1 }) with the value it was given", () => {
		const { inner, bind } = bindable();
		const value = { any: "thing" };
		bind(inner, "bindEvent", "tap", value);
		engine().fire(inner, "tap", { detail: { x: 1 } });
		expect(worklets.calls).toHaveLength(1);
		expect(worklets.calls[0]!.value).toBe(value);
		expect(worklets.calls[0]!.options).toEqual({ source: 1 });
		const target = { id: "inner", uid: 3, dataset: { row: 3 }, elementRefptr: inner };
		expect(worklets.calls[0]!.params).toEqual([
			{ type: "tap", detail: { x: 1 }, target, currentTarget: target },
		]);
	});

	it("gives each function its own event, with the element it runs on as currentTarget", () => {
		const { outer, inner, bind } = bindable();
		bind(inner, "bindEvent", "tap", { at: "inner" });
		bind(outer, "bindEvent", "tap", { at: "outer" });
		engine().dispatch(inner, "tap");
		const events = worklets.calls.map(
			(call) => call.params[0] as Record<string, { elementRefptr: unknown }>,
		);
		expect(events.map((event) => event["currentTarget"]!.elementRefptr)).toEqual([inner, outer]);
		expect(events.map((event) => event["target"]!.elementRefptr)).toEqual([inner, inner]);
		expect(events[0]).not.toBe(events[1]);
	});

	it("does not give a listener's event the element", () => {
		const { inner } = bindable();
		const seen: unknown[] = [];
		engine().functions.__AddEventListener(inner, "tap", (event) => seen.push(event), {});
		engine().fire(inner, "tap");
		const target = { id: "inner", uid: 3, dataset: { row: 3 } };
		expect(seen).toEqual([{ type: "tap", target, currentTarget: target }]);
	});

	it("keeps one function per event name and type, and removes it with an empty value", () => {
		const { inner, bind } = bindable();
		const first = { n: 1 };
		const second = { n: 2 };
		bind(inner, "bindEvent", "tap", first);
		bind(inner, "bindEvent", "tap", second);
		engine().fire(inner, "tap");
		expect(worklets.calls.map((call) => call.value)).toEqual([second]);
		bind(inner, "bindEvent", "tap", undefined);
		expect(() => engine().fire(inner, "tap")).toThrow("no tap listener");
		expect(worklets.calls).toHaveLength(1);
	});

	it("logs each binding, and a handler name as a filing, which binds no function", () => {
		const { inner, bind } = bindable();
		bind(inner, "bindEvent", "tap", { n: 1 });
		engine().functions.__AddEvent(inner, "bindEvent", "touchstart", "onTouch");
		engine().functions.__AddEvent(inner, "bindEvent", "touchend", undefined);
		expect(engine().workletEvents.map((entry) => [entry.eventName, entry.value])).toEqual([
			["tap", { type: "worklet", value: { n: 1 } }],
			["touchend", undefined],
		]);
		expect(engine().filings.map((entry) => [entry.eventName, entry.value])).toEqual([
			["touchstart", "onTouch"],
			["touchend", undefined],
		]);
		expect(engine().state(inner).filedEvents).toEqual(new Set(["bindEvent:touchstart"]));
		expect(
			engine()
				.state(inner)
				.mainThreadEvents.map((bound) => bound.eventName),
		).toEqual(["tap"]);
	});

	it("runs a function before a listener, and capture from the page down, then bubble up", () => {
		const { outer, inner, bind } = bindable();
		const labels = new Map<unknown, string>();
		const value = (label: string) => {
			const made = { label };
			labels.set(made, label);
			return made;
		};
		const order: (string | undefined)[] = [];
		worklets.use((made) => void order.push(labels.get(made)));
		bind(outer, "capture-bind", "tap", value("outer capture"));
		bind(inner, "capture-bind", "tap", value("inner capture"));
		bind(inner, "bindEvent", "tap", value("inner"));
		bind(outer, "bindEvent", "tap", value("outer"));
		engine().functions.__AddEventListener(inner, "tap", () => order.push("inner listener"), {});
		engine().dispatch(inner, "tap");
		expect(order).toEqual(["outer capture", "inner capture", "inner", "inner listener", "outer"]);
	});

	it("ends the chain at a catch", () => {
		const { outer, inner, bind } = bindable();
		const caught = { label: "inner" };
		const above = { label: "outer" };
		const labels = new Map<unknown, string>([
			[caught, "inner"],
			[above, "outer"],
		]);
		bind(inner, "catchEvent", "tap", caught);
		bind(outer, "bindEvent", "tap", above);
		engine().dispatch(inner, "tap");
		expect(ran(labels)).toEqual(["inner"]);
	});

	it("ends the chain at a capture-catch, before the target", () => {
		const { outer, inner, bind } = bindable();
		const top = { label: "outer capture" };
		const target = { label: "inner" };
		const labels = new Map<unknown, string>([
			[top, "outer capture"],
			[target, "inner"],
		]);
		bind(outer, "capture-catch", "tap", top);
		bind(inner, "bindEvent", "tap", target);
		engine().dispatch(inner, "tap");
		expect(ran(labels)).toEqual(["outer capture"]);
	});

	it("runs nothing when there is no global runWorklet", () => {
		const { inner, bind } = bindable();
		worklets.remove();
		bind(inner, "bindEvent", "tap", {});
		expect(() => engine().fire(inner, "tap")).not.toThrow();
		expect(engine().mainThreadRuns).toEqual([]);
	});

	it("refuses a handler that is not a main-thread function, a name or none", () => {
		const { inner } = bindable();
		expect(() => engine().functions.__AddEvent(inner, "bindEvent", "tap", { type: "js" })).toThrow(
			'__AddEvent was given a handler for bindEvent tap that is not { type: "worklet", value }',
		);
		expect(() => engine().functions.__AddEvent(inner, "bindEvent", "tap", 4)).toThrow(
			"__AddEvent param 3 should be a main-thread function, a handler name or none",
		);
	});
});

describe("a global-bind event", () => {
	it("runs a function for an event on any element, first", () => {
		const { page, inner, bind } = bindable();
		const f = engine().functions;
		const elsewhere = f.__CreateView(0);
		f.__AppendElement(page, elsewhere);
		const everywhere = { label: "global" };
		const own = { label: "inner" };
		const labels = new Map<unknown, string>([
			[everywhere, "global"],
			[own, "inner"],
		]);
		bind(elsewhere, "global-bindEvent", "tap", everywhere);
		bind(inner, "bindEvent", "tap", own);
		engine().dispatch(inner, "tap");
		expect(ran(labels)).toEqual(["global", "inner"]);
		const event = worklets.calls[0]!.params[0] as Record<string, { elementRefptr: unknown }>;
		expect(event["currentTarget"]!.elementRefptr).toBe(elsewhere);
		expect(event["target"]!.elementRefptr).toBe(inner);
	});

	const GLOBAL = { closure_type: 2, bind_type: 5 };

	it("reaches a listener only when its element has the type filed with a handler name", () => {
		const { page, inner } = bindable();
		const f = engine().functions;
		const watcher = f.__CreateView(0);
		f.__AppendElement(page, watcher);
		const heard: string[] = [];
		f.__AddEventListener(watcher, "tap", () => heard.push("global"), GLOBAL);
		engine().dispatch(inner, "tap");
		expect(heard).toEqual([]);
		f.__AddEvent(watcher, "global-bindEvent", "tap", "onTap");
		engine().dispatch(inner, "tap");
		expect(heard).toEqual(["global"]);
	});
});

describe("a listener's options", () => {
	it("honors capture when it is a plain listener, which never catches", () => {
		const { outer, inner } = bindable();
		const f = engine().functions;
		const order: string[] = [];
		f.__AddEventListener(outer, "tap", () => order.push("outer"), {});
		f.__AddEventListener(outer, "tap", () => order.push("outer capture"), { capture: true });
		f.__AddEventListener(inner, "tap", () => order.push("inner"), { bind_type: 3 });
		engine().dispatch(inner, "tap");
		expect(order).toEqual(["outer capture", "inner", "outer"]);
	});

	it("reads bind_type only with closure_type 2: capture, capture-catch, catch", () => {
		const { outer, inner } = bindable();
		const f = engine().functions;
		const order: string[] = [];
		f.__AddEventListener(outer, "tap", () => order.push("outer"), {
			closure_type: 2,
			bind_type: 1,
		});
		f.__AddEventListener(inner, "tap", () => order.push("inner"), {
			closure_type: 2,
			bind_type: 4,
		});
		engine().dispatch(inner, "tap");
		expect(order).toEqual(["inner"]);
	});

	it("removes a listener by its name, function and options, and throws for one that is not there", () => {
		const { inner } = bindable();
		const f = engine().functions;
		const listener = () => {};
		f.__AddEventListener(inner, "tap", listener, {});
		expect(engine().listenerCount()).toBe(1);
		expect(() => f.__RemoveEventListener(inner, "tap", listener, { capture: true })).toThrow(
			"__RemoveEventListener found no tap listener on <view> 3",
		);
		f.__RemoveEventListener(inner, "tap", listener, {});
		expect(engine().listenerCount()).toBe(0);
	});
});

describe("eventReturnResult", () => {
	function chain() {
		const made = bindable();
		const labels = new Map<unknown, string>();
		const value = (label: string) => {
			const object = { label };
			labels.set(object, label);
			return object;
		};
		const first = value("inner");
		const second = value("outer");
		made.bind(made.inner, "bindEvent", "tap", first);
		made.bind(made.outer, "bindEvent", "tap", second);
		const listeners: string[] = [];
		const f = engine().functions;
		f.__AddEventListener(made.inner, "tap", () => listeners.push("inner listener"), {});
		f.__AddEventListener(made.outer, "tap", () => listeners.push("outer listener"), {});
		return { ...made, labels, first, listeners };
	}

	it("bit 1 stops the event after the listeners of the same element and phase", () => {
		const { inner, labels, first, listeners } = chain();
		worklets.returns.set(first, { eventReturnResult: 1 });
		engine().dispatch(inner, "tap");
		expect(ran(labels)).toEqual(["inner"]);
		expect(listeners).toEqual(["inner listener"]);
		expect(engine().mainThreadRuns.map((run) => run.eventReturnResult)).toEqual([1]);
	});

	it("bit 2 stops it at once", () => {
		const { inner, labels, first, listeners } = chain();
		worklets.returns.set(first, { eventReturnResult: 2 });
		engine().dispatch(inner, "tap");
		expect(ran(labels)).toEqual(["inner"]);
		expect(listeners).toEqual([]);
	});

	it.each([
		["nothing", undefined],
		["an object without it", { returnValue: 1 }],
		["a number", 1],
		["true", true],
	])("is read from an object only: %s stops nothing", (_name, returned) => {
		const { inner, labels, first, listeners } = chain();
		worklets.returns.set(first, returned);
		engine().dispatch(inner, "tap");
		expect(ran(labels)).toEqual(["inner", "outer"]);
		expect(listeners).toEqual(["inner listener", "outer listener"]);
	});
});

describe("firing on one element", () => {
	it("goes to that element's functions and listeners only, as a custom event does", () => {
		const { outer, inner, bind } = bindable();
		const heard: string[] = [];
		bind(inner, "bindEvent", "scroll", { n: 1 });
		engine().functions.__AddEventListener(inner, "scroll", () => heard.push("inner"), {});
		engine().functions.__AddEventListener(outer, "scroll", () => heard.push("outer"), {});
		engine().fire(inner, "scroll", { detail: { scrollTop: 10 } });
		expect(worklets.calls).toHaveLength(1);
		expect(heard).toEqual(["inner"]);
	});

	it("stops at stopImmediatePropagation, before the listeners", () => {
		const { inner, bind } = bindable();
		const first = { n: 1 };
		const heard: string[] = [];
		bind(inner, "bindEvent", "scroll", first);
		engine().functions.__AddEventListener(inner, "scroll", () => heard.push("inner"), {});
		worklets.returns.set(first, { eventReturnResult: 2 });
		engine().fire(inner, "scroll");
		expect(heard).toEqual([]);
	});
});
