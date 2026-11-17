// The engine's own side of events (the dispatch order, the stop bits, main-thread functions, handler
// names and plain listeners): what it calls, with what, and what it reads back, as Lynx's event
// dispatcher does with `enableEventHandleRefactor`, which every page the plugin builds turns on.
// The tests that run real main-thread functions rest on this; here the global `runWorklet` is a
// recorder, so no runtime is involved.

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
		engine().fire(inner, { type: "tap", detail: { x: 1 } });
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
		engine().dispatch(inner, { type: "tap" });
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
		engine().fire(inner, { type: "tap" });
		const target = { id: "inner", uid: 3, dataset: { row: 3 } };
		expect(seen).toEqual([{ type: "tap", target, currentTarget: target }]);
	});

	it("keeps one function per event name and type, and removes it with an empty value", () => {
		const { inner, bind } = bindable();
		const first = { n: 1 };
		const second = { n: 2 };
		bind(inner, "bindEvent", "tap", first);
		bind(inner, "bindEvent", "tap", second);
		engine().fire(inner, { type: "tap" });
		expect(worklets.calls.map((call) => call.value)).toEqual([second]);
		bind(inner, "bindEvent", "tap", undefined);
		expect(() => engine().fire(inner, { type: "tap" })).toThrow("no tap listener");
		expect(worklets.calls).toHaveLength(1);
	});

	it("logs each binding, and a handler name as a filing, which binds no main-thread function", () => {
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
		expect(engine().state(inner).filedEvents).toEqual(
			new Set(["bindEvent:tap", "bindEvent:touchstart"]),
		);
		expect(
			engine()
				.state(inner)
				.mainThreadEvents.map((bound) => bound.eventName),
		).toEqual(["tap"]);
	});

	it("runs capture from the page down, then the target, then bubble up", () => {
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
		engine().dispatch(inner, { type: "tap" });
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
		engine().dispatch(inner, { type: "tap" });
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
		engine().dispatch(inner, { type: "tap" });
		expect(ran(labels)).toEqual(["outer capture"]);
	});

	it("runs nothing when there is no global runWorklet", () => {
		const { inner, bind } = bindable();
		worklets.remove();
		bind(inner, "bindEvent", "tap", {});
		expect(() => engine().fire(inner, { type: "tap" })).not.toThrow();
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
		f.__FlushElementTree();
		bind(inner, "bindEvent", "tap", own);
		engine().dispatch(inner, { type: "tap" });
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
		engine().dispatch(inner, { type: "tap" });
		expect(heard).toEqual([]);
		f.__AddEvent(watcher, "global-bindEvent", "tap", "onTap");
		f.__FlushElementTree();
		engine().dispatch(inner, { type: "tap" });
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
		engine().dispatch(inner, { type: "tap" });
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
		engine().dispatch(inner, { type: "tap" });
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
		engine().dispatch(inner, { type: "tap" });
		expect(ran(labels)).toEqual(["inner"]);
		expect(listeners).toEqual(["inner listener"]);
		expect(engine().mainThreadRuns.map((run) => run.eventReturnResult)).toEqual([1]);
	});

	it("bit 2 stops it at once", () => {
		const { inner, labels, first, listeners } = chain();
		worklets.returns.set(first, { eventReturnResult: 2 });
		engine().dispatch(inner, { type: "tap" });
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
		engine().dispatch(inner, { type: "tap" });
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
		engine().fire(inner, { type: "scroll", detail: { scrollTop: 10 } });
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
		engine().fire(inner, { type: "scroll" });
		expect(heard).toEqual([]);
	});
});

describe("the order of an element's bindings", () => {
	/** Labels for the values of main-thread functions, and a runWorklet that records them in order. */
	function labeled(order: string[]) {
		const labels = new Map<unknown, string>();
		worklets.use((made) => void order.push(labels.get(made) ?? "?"));
		return (label: string) => {
			const made = { label };
			labels.set(made, label);
			return made;
		};
	}

	it("runs functions and listeners in the order they were bound, not functions first", () => {
		const { inner, bind } = bindable();
		const order: string[] = [];
		const value = labeled(order);
		engine().functions.__AddEventListener(inner, "tap", () => order.push("listener"), {});
		bind(inner, "bindEvent", "tap", value("function"));
		engine().dispatch(inner, { type: "tap" });
		expect(order).toEqual(["listener", "function"]);
	});

	it("moves a function bound again to the end of its element's bindings", () => {
		const { inner, bind } = bindable();
		const order: string[] = [];
		const value = labeled(order);
		bind(inner, "bindEvent", "tap", value("first"));
		engine().functions.__AddEventListener(inner, "tap", () => order.push("listener"), {});
		bind(inner, "bindEvent", "tap", value("again"));
		engine().dispatch(inner, { type: "tap" });
		expect(order).toEqual(["listener", "again"]);
	});

	it("runs the target's capture bindings first, then the rest of its bindings in their order", () => {
		const { outer, inner, bind } = bindable();
		const order: string[] = [];
		const value = labeled(order);
		const f = engine().functions;
		bind(inner, "bindEvent", "tap", value("inner"));
		f.__AddEventListener(inner, "tap", () => order.push("inner listener"), {});
		bind(inner, "capture-bind", "tap", value("inner capture"));
		bind(outer, "capture-bind", "tap", value("outer capture"));
		bind(outer, "bindEvent", "tap", value("outer"));
		engine().dispatch(inner, { type: "tap" });
		expect(order).toEqual(["outer capture", "inner capture", "inner", "inner listener", "outer"]);
	});

	it("runs the rest of the target's bindings after a capture-catch or a stop there, then ends", () => {
		const { outer, inner, bind } = bindable();
		const order: string[] = [];
		const value = labeled(order);
		const stopper = value("inner capture");
		worklets.use((made) => {
			order.push((made as { label: string }).label);
			return made === stopper ? { eventReturnResult: 1 } : undefined;
		});
		bind(inner, "capture-bind", "tap", stopper);
		bind(inner, "bindEvent", "tap", value("inner"));
		bind(outer, "bindEvent", "tap", value("outer"));
		engine().dispatch(inner, { type: "tap" });
		expect(order).toEqual(["inner capture", "inner"]);

		order.length = 0;
		bind(inner, "capture-bind", "tap", undefined);
		bind(inner, "capture-catch", "tap", value("inner catch"));
		engine().dispatch(inner, { type: "tap" });
		expect(order).toEqual(["inner catch", "inner"]);
	});
});

describe("a handler name", () => {
	it("is a binding of its own that sends the event to the background, and catches as its type says", () => {
		const { page, outer, inner, bind } = bindable();
		const f = engine().functions;
		const heard: string[] = [];
		f.__AddEventListener(page, "tap", () => heard.push("page"), {});
		bind(inner, "bindEvent", "tap", { n: 1 });
		f.__AddEvent(outer, "catchEvent", "tap", "onOuterTap");
		engine().dispatch(inner, { type: "tap" });
		expect(heard).toEqual([]);
		expect(
			engine().backgroundEvents.map((sent) => [sent.element, sent.eventType, sent.handler]),
		).toEqual([[outer, "catchEvent", "onOuterTap"]]);
	});

	it("leaves a main-thread function of the same name and type bound, and is removed with none", () => {
		const { inner, bind } = bindable();
		const f = engine().functions;
		bind(inner, "bindEvent", "tap", { n: 1 });
		f.__AddEvent(inner, "bindEvent", "tap", "onTap");
		engine().dispatch(inner, { type: "tap" });
		expect(worklets.calls).toHaveLength(1);
		expect(engine().backgroundEvents).toHaveLength(1);
		f.__AddEvent(inner, "bindEvent", "tap", undefined);
		engine().dispatch(inner, { type: "tap" });
		expect(worklets.calls).toHaveLength(1);
		expect(engine().backgroundEvents).toHaveLength(1);
	});

	it("files the type and sends nothing when it is empty", () => {
		const { inner } = bindable();
		engine().functions.__AddEvent(inner, "bindEvent", "tap", "");
		engine().dispatch(inner, { type: "tap" });
		expect(engine().backgroundEvents).toEqual([]);
		expect(engine().state(inner).filedEvents).toEqual(new Set(["bindEvent:tap"]));
	});
});

describe("the global phase", () => {
	it("goes to the elements with the type filed in the order they were made, not the tree's", () => {
		const { page, inner, bind } = bindable();
		const f = engine().functions;
		const made = f.__CreateView(0);
		const later = f.__CreateView(0);
		f.__AppendElement(page, later);
		f.__AppendElement(page, made);
		const first = { label: "made first" };
		const second = { label: "made second" };
		const labels = new Map<unknown, string>([
			[first, "made first"],
			[second, "made second"],
		]);
		bind(later, "global-bindEvent", "tap", second);
		f.__FlushElementTree();
		bind(made, "global-bindEvent", "tap", first);
		f.__FlushElementTree();
		engine().dispatch(inner, { type: "tap" });
		expect(ran(labels)).toEqual(["made first", "made second"]);
	});

	it("takes a plain listener with bind_type 5 as global, as the engine does whatever closure_type says", () => {
		const { page, inner } = bindable();
		const f = engine().functions;
		const watcher = f.__CreateView(0);
		f.__AppendElement(page, watcher);
		const heard: string[] = [];
		f.__AddEventListener(inner, "tap", () => heard.push("plain global"), { bind_type: 5 });
		f.__AddEventListener(watcher, "tap", () => heard.push("watcher"), { bind_type: 5 });
		engine().dispatch(inner, { type: "tap" });
		expect(heard).toEqual([]);
		f.__AddEvent(watcher, "global-bindEvent", "tap", "onTap");
		f.__FlushElementTree();
		engine().dispatch(inner, { type: "tap" });
		expect(heard).toEqual(["watcher"]);
	});

	it("is filed by a global-bind main-thread function too, for a listener of the same element", () => {
		const { page, inner, bind } = bindable();
		const f = engine().functions;
		const watcher = f.__CreateView(0);
		f.__AppendElement(page, watcher);
		const heard: string[] = [];
		f.__AddEventListener(watcher, "tap", () => heard.push("listener"), {
			closure_type: 2,
			bind_type: 5,
		});
		bind(watcher, "global-bindEvent", "tap", { n: 1 });
		f.__FlushElementTree();
		engine().dispatch(inner, { type: "tap" });
		expect(heard).toEqual(["listener"]);
		expect(worklets.calls).toHaveLength(1);
	});

	it("throws for a stop returned there: what Lynx does with it is not verified", () => {
		const { page, inner, bind } = bindable();
		const f = engine().functions;
		const watcher = f.__CreateView(0);
		f.__AppendElement(page, watcher);
		const everywhere = { n: 1 };
		bind(watcher, "global-bindEvent", "tap", everywhere);
		f.__FlushElementTree();
		worklets.returns.set(everywhere, { eventReturnResult: 1 });
		expect(() => engine().dispatch(inner, { type: "tap" })).toThrow(
			"A global-bind function stopped the tap event",
		);
	});
});

describe("a custom event", () => {
	it("has no capture phase, so the target's capture bindings do not hear it", () => {
		const { inner, bind } = bindable();
		const heard: string[] = [];
		const f = engine().functions;
		bind(inner, "capture-bind", "scroll", { n: 1 });
		f.__AddEventListener(inner, "scroll", () => heard.push("capture"), { capture: true });
		f.__AddEventListener(inner, "scroll", () => heard.push("plain"), {});
		engine().fire(inner, { type: "scroll" });
		expect(heard).toEqual(["plain"]);
		expect(worklets.calls).toEqual([]);
	});

	it("goes through the global phase first", () => {
		const { page, inner, bind } = bindable();
		const f = engine().functions;
		const watcher = f.__CreateView(0);
		f.__AppendElement(page, watcher);
		const heard: string[] = [];
		bind(watcher, "global-bindEvent", "scroll", { n: 1 });
		f.__FlushElementTree();
		worklets.use(() => void heard.push("global"));
		f.__AddEventListener(inner, "scroll", () => heard.push("inner"), {});
		engine().fire(inner, { type: "scroll" });
		expect(heard).toEqual(["global", "inner"]);
	});
});

describe("the engine's side, given what is not one of its elements", () => {
	it("says which call was given it", () => {
		const foreign = document.createElement("div");
		expect(() => engine().fire(foreign, { type: "tap" })).toThrow(
			"fire param 0 should be an element",
		);
		expect(() => engine().dispatch(foreign, { type: "tap" })).toThrow(
			"dispatch param 0 should be an element",
		);
	});
});

describe("removing a listener", () => {
	it("matches the options by what they say to the engine, not by every field", () => {
		const { inner } = bindable();
		const f = engine().functions;
		const listener = () => {};
		f.__AddEventListener(inner, "tap", listener, { capture: true });
		f.__RemoveEventListener(inner, "tap", listener, { capture: true, bind_type: 1 });
		expect(engine().listenerCount()).toBe(0);
	});
});

describe("a binding removed while the event is on its way", () => {
	it("does not run, even on the element whose bindings are running", () => {
		const { inner } = bindable();
		const f = engine().functions;
		const heard: string[] = [];
		const second = () => heard.push("second");
		f.__AddEventListener(
			inner,
			"tap",
			() => {
				heard.push("first");
				f.__RemoveEventListener(inner, "tap", second, {});
			},
			{},
		);
		f.__AddEventListener(inner, "tap", second, {});
		engine().dispatch(inner, { type: "tap" });
		expect(heard).toEqual(["first"]);
	});

	it("does not run when an earlier binding unbinds a main-thread function", () => {
		const { inner, bind } = bindable();
		const f = engine().functions;
		f.__AddEventListener(inner, "tap", () => bind(inner, "bindEvent", "tap", undefined), {});
		bind(inner, "bindEvent", "tap", { n: 1 });
		engine().dispatch(inner, { type: "tap" });
		expect(worklets.calls).toEqual([]);
	});
});

describe("a global-bind filing", () => {
	it("takes effect at the next flush, when the engine resolves the element's events", () => {
		const { page, inner } = bindable();
		const f = engine().functions;
		const watcher = f.__CreateView(0);
		f.__AppendElement(page, watcher);
		const heard: string[] = [];
		f.__AddEventListener(watcher, "tap", () => heard.push("watcher"), { bind_type: 5 });
		f.__AddEvent(watcher, "global-bindEvent", "tap", "");
		engine().dispatch(inner, { type: "tap" });
		expect(heard).toEqual([]);
		f.__FlushElementTree();
		engine().dispatch(inner, { type: "tap" });
		expect(heard).toEqual(["watcher"]);
	});

	it("stays when it is removed: the element hears the global phase until it is gone", () => {
		const { page, inner } = bindable();
		const f = engine().functions;
		const watcher = f.__CreateView(0);
		f.__AppendElement(page, watcher);
		const heard: string[] = [];
		f.__AddEventListener(watcher, "tap", () => heard.push("watcher"), { bind_type: 5 });
		f.__AddEvent(watcher, "global-bindEvent", "tap", "");
		f.__FlushElementTree();
		f.__AddEvent(watcher, "global-bindEvent", "tap", undefined);
		f.__FlushElementTree();
		engine().dispatch(inner, { type: "tap" });
		expect(heard).toEqual(["watcher"]);
		f.__RemoveElement(page, watcher);
		engine().forget(f.__GetElementUniqueID(watcher));
		engine().dispatch(inner, { type: "tap" });
		expect(heard).toEqual(["watcher"]);
	});

	it("is not resolved for an element that is not in the page at the flush", () => {
		const { inner } = bindable();
		const f = engine().functions;
		const loose = f.__CreateView(0);
		const heard: string[] = [];
		f.__AddEventListener(loose, "tap", () => heard.push("loose"), { bind_type: 5 });
		f.__AddEvent(loose, "global-bindEvent", "tap", "");
		f.__FlushElementTree();
		engine().dispatch(inner, { type: "tap" });
		expect(heard).toEqual([]);
	});
});

describe("an __AddEvent type", () => {
	it("is one of the five Lynx knows; any other throws, where Lynx would take it as bubble", () => {
		const { inner } = bindable();
		expect(() =>
			engine().functions.__AddEvent(inner, "bindtap", "tap", { type: "worklet", value: {} }),
		).toThrow("__AddEvent was given the type bindtap");
	});
});
