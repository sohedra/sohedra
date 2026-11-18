// What the binding counts on Lynx's engine to do, written once as cases that a runner applies to a
// target: the engine fake here, and a device. A case uses only what a page's main thread has
// (Lynx's element functions, `lynx.getEngine()`, the global `runWorklet`) and what a device can be
// made to do (tap, pan, show a list's cell, update the page's data); it returns a plain
// observation, and the runner compares it with the case's `expected`. Nothing here may need what
// only the fake has, nor a built-in a device's main thread lacks, such as `toSorted` or `at`.
//
// Every case but those marked `sourceOnly` has run on Lynx 4.2 on iOS and Android, in Lynx
// Explorer, with real taps and pans, and expects what the device answered. A `sourceOnly` case
// rests on Lynx's source alone until a device runs it.

import type { ElementFunctions, LifecycleProxy, LynxElement } from "../../../src/testing/index.ts";

/** How the engine runs a main-thread function: the main thread's global `runWorklet`. */
export type RunWorklet = (value: unknown, params: unknown[], options: unknown) => unknown;

/** What a case can use and do on its target. */
export interface EngineTarget {
	/** Lynx's element functions, as the main thread has them. A page element is already there. */
	readonly functions: ElementFunctions;
	/** What `lynx.getEngine()` answers on the main thread. */
	readonly engineEvents: LifecycleProxy;
	/** Sets the main thread's global `runWorklet`, through which the engine runs functions. */
	useRunWorklet(run: RunWorklet): void;
	/** A finger taps the element. */
	tap(element: LynxElement): Promise<void>;
	/** A gesture on the element, for which the engine calls the detector's callback by that name. */
	gesture(element: LynxElement, id: number, callback: string): Promise<void>;
	/** The list shows the cell at `index`, as when it scrolls into view. */
	showCell(list: LynxElement, index: number): Promise<void>;
	/** The host updates the page's data. */
	updatePage(data: Record<string, unknown>): Promise<void>;
	/** Waits until what the engine answers from other threads has come. */
	settle(): Promise<void>;
}

/** One behavior, as a case with the observation the engine gives. */
export interface Behavior {
	/** What the engine does, in a sentence. */
	name: string;
	/** Where Lynx does it, as a path in lynx-family/lynx. */
	source: string;
	run(target: EngineTarget): Promise<unknown>;
	expected: unknown;
	/** The case rests on Lynx's source alone: no device has run it yet. */
	sourceOnly?: true;
}

/** A view in the page, with a size a finger can tap and an id. */
function view(target: EngineTarget, id: string, parent?: LynxElement): LynxElement {
	const f = target.functions;
	const element = f.__CreateView(0);
	f.__SetID(element, id);
	f.__SetInlineStyles(element, "width: 100px; height: 100px; margin: 20px");
	f.__AppendElement(parent ?? f.__GetPageElement()!, element);
	return element;
}

/** Calls a UI method and waits for its answer. */
async function invoke(
	target: EngineTarget,
	element: LynxElement,
	method: string,
): Promise<{ code: number; data?: unknown }> {
	let answer: { code: number; data?: unknown } | undefined;
	target.functions.__InvokeUIMethod(element, method, {}, (result) => {
		answer = result;
	});
	await target.settle();
	return answer ?? { code: -1 };
}

/** Records the labels of the main-thread functions the engine runs, and what each returns. */
function recordRuns(target: EngineTarget, returns: Map<string, unknown> = new Map()) {
	const ran: string[] = [];
	const calls: { params: unknown[]; options: unknown }[] = [];
	target.useRunWorklet((value, params, options) => {
		const label = (value as { label: string }).label;
		ran.push(label);
		calls.push({ params, options });
		return returns.get(label);
	});
	return { ran, calls };
}

/** A main-thread function's value as the engine holds it: anything; here a label. */
const fn = (label: string) => ({ type: "worklet", value: { label } });

export const BEHAVIORS: Behavior[] = [
	{
		name: "the tree: append, insert before and remove children",
		source: "core/renderer/dom/fiber/fiber_element.cc (Element::InsertNode, RemoveNode)",
		async run(target) {
			const f = target.functions;
			const box = view(target, "box");
			const [a, b, c] = ["a", "b", "c"].map((id) => {
				const child = f.__CreateView(0);
				f.__SetID(child, id);
				return child;
			}) as [LynxElement, LynxElement, LynxElement];
			f.__AppendElement(box, a);
			f.__AppendElement(box, c);
			f.__InsertElementBefore(box, b, c);
			f.__RemoveElement(box, a);
			const labels = new Map([
				[b, "b"],
				[c, "c"],
			]);
			return {
				children: f.__QuerySelectorAll(box, "#box > view", {}).map((child) => labels.get(child)),
				removedFound: f.__QuerySelector(f.__GetPageElement()!, "#a", {}) !== null,
			};
		},
		expected: { children: ["b", "c"], removedFound: false },
	},
	{
		name: "an element has no UI until the tree is flushed: a UI method answers code 6",
		source: "core/renderer/template_assembler.cc (LepusInvokeUIMethod)",
		async run(target) {
			const f = target.functions;
			const element = view(target, "fresh");
			f.__SetAttribute(element, "flatten", false);
			const before = (await invoke(target, element, "boundingClientRect")).code;
			f.__FlushElementTree();
			const after = (await invoke(target, element, "boundingClientRect")).code;
			return { before, after };
		},
		expected: { before: 6, after: 0 },
	},
	{
		name: "a view with an id answers a UI method with code 0 and its box, flattened or not",
		source:
			"core/renderer/template_assembler.cc (LepusInvokeUIMethod), which the platform answers from the element's UI; a flattened view keeps one (Android: LynxFlattenUI)",
		async run(target) {
			const f = target.functions;
			const plain = view(target, "plain");
			const kept = view(target, "kept");
			f.__SetAttribute(kept, "flatten", false);
			f.__FlushElementTree();
			const answer = await invoke(target, plain, "boundingClientRect");
			return {
				plain: answer.code,
				plainHasBox: (answer.data as Rect).width > 0 && (answer.data as Rect).height > 0,
				kept: (await invoke(target, kept, "boundingClientRect")).code,
			};
		},
		expected: { plain: 0, plainHasBox: true, kept: 0 },
	},
	{
		name: "a view that stops being flattened answers at its place before the next flush",
		source: "core/renderer/dom/element.cc (Element::CheckFlattenRelatedProp)",
		async run(target) {
			const f = target.functions;
			const element = view(target, "stale");
			f.__FlushElementTree();
			f.__SetAttribute(element, "flatten", false);
			const before = (await invoke(target, element, "boundingClientRect")).data as Rect;
			f.__FlushElementTree();
			const after = (await invoke(target, element, "boundingClientRect")).data as Rect;
			return {
				placedBefore: before.left !== 0 || before.top !== 0,
				sameAfter: JSON.stringify(before) === JSON.stringify(after),
			};
		},
		expected: { placedBefore: true, sameAfter: true },
	},
	{
		name: "a view with no attribute, id or event, and only layout styles, has no UI (code 6) until the flush after it gains an attribute",
		source:
			"core/renderer/dom/element_container.cc (ElementContainer::CreatePaintingNode returns for a layout-only element); core/renderer/dom/fiber/fiber_element.cc (Element::CanBeLayoutOnly, MarkHasLayoutOnlyPropsIfNecessary)",
		async run(target) {
			const f = target.functions;
			const element = f.__CreateView(0);
			f.__SetInlineStyles(element, "width: 100px; height: 100px; margin: 20px");
			f.__AppendElement(f.__GetPageElement()!, element);
			f.__FlushElementTree();
			const flushed = (await invoke(target, element, "boundingClientRect")).code;
			f.__SetAttribute(element, "accessibility-label", "box");
			const given = (await invoke(target, element, "boundingClientRect")).code;
			f.__FlushElementTree();
			const flushedAgain = (await invoke(target, element, "boundingClientRect")).code;
			return { flushed, given, flushedAgain };
		},
		expected: { flushed: 6, given: 6, flushedAgain: 0 },
	},
	{
		name: "a class, an empty dataset or a custom property leaves a view with no UI; an id of none, or a scroll view as its parent, gives it one",
		source:
			"core/renderer/dom/fiber/fiber_element.cc (Element::ParseRawInlineStyles keeps a custom property out of the styles); core/runtime/lepus/bindings/renderer_functions.cc (FiberSetID writes an empty id for none); core/renderer/dom/fiber/scroll_element.cc (ScrollElement::OnNodeAdded)",
		async run(target) {
			const f = target.functions;
			const page = f.__GetPageElement()!;
			const scroller = f.__CreateScrollView(0);
			f.__SetInlineStyles(scroller, "width: 100px; height: 100px");
			f.__AppendElement(page, scroller);
			const inner = f.__CreateView(0);
			f.__SetInlineStyles(inner, "width: 100px; height: 40px");
			f.__AppendElement(scroller, inner);
			const shapes: [string, LynxElement, (element: LynxElement) => void][] = [
				["unmatchedClass", page, (element) => f.__SetClasses(element, "no-such-class")],
				["emptyDataset", page, (element) => f.__SetDataset(element, {})],
				[
					"customPropertyInText",
					page,
					(element) => f.__SetInlineStyles(element, "width: 100px; height: 20px; --x: red"),
				],
				["customPropertyAdded", page, (element) => f.__AddInlineStyle(element, "--x", "red")],
				["customPropertyObject", page, (element) => f.__SetInlineStyles(element, { "--x": "red" })],
				["idSetToNone", page, (element) => f.__SetID(element, null)],
				["inScrollView", scroller, () => {}],
				["inViewInScrollView", inner, () => {}],
			];
			const made = shapes.map(([name, parent, shape]) => {
				const element = f.__CreateView(0);
				f.__SetInlineStyles(element, "width: 100px; height: 20px");
				shape(element);
				f.__AppendElement(parent, element);
				return [name, element] as const;
			});
			f.__FlushElementTree();
			const codes: Record<string, number> = {};
			for (const [name, element] of made)
				codes[name] = (await invoke(target, element, "boundingClientRect")).code;
			return codes;
		},
		expected: {
			unmatchedClass: 6,
			emptyDataset: 6,
			customPropertyInText: 6,
			customPropertyAdded: 6,
			customPropertyObject: 6,
			idSetToNone: 0,
			inScrollView: 0,
			inViewInScrollView: 6,
		},
	},
	{
		name: "__SetInlineStyles wipes the styles added one by one",
		source: "core/runtime/lepus/bindings/renderer_functions.cc (FiberSetInlineStyles)",
		async run(target) {
			const f = target.functions;
			const element = view(target, "styled");
			f.__FlushElementTree();
			// Compared with the element's own value before, which a device spells its own way.
			const before = f.__GetComputedStyleByKey(element, "opacity");
			f.__AddInlineStyle(element, "opacity", "0.5");
			f.__FlushElementTree();
			const added = f.__GetComputedStyleByKey(element, "opacity");
			f.__SetInlineStyles(element, "width: 100px; height: 100px");
			f.__FlushElementTree();
			return {
				changedByAdd: added !== before,
				backAfterSet: f.__GetComputedStyleByKey(element, "opacity") === before,
			};
		},
		expected: { changedByAdd: true, backAfterSet: true },
	},
	{
		name: "__AddEvent keeps one function per event name and type; none removes it",
		source: "core/renderer/dom/fiber/fiber_element.cc (Element::FiberAddEvent)",
		async run(target) {
			const f = target.functions;
			const element = view(target, "button");
			const { ran } = recordRuns(target);
			f.__AddEvent(element, "bindEvent", "tap", fn("first"));
			f.__AddEvent(element, "bindEvent", "tap", fn("second"));
			f.__FlushElementTree();
			await target.tap(element);
			const bound = [...ran];
			f.__AddEvent(element, "bindEvent", "tap", undefined);
			f.__AddEventListener(element, "tap", () => {}, {});
			f.__FlushElementTree();
			await target.tap(element);
			return { bound, afterRemoval: ran.slice(bound.length) };
		},
		expected: { bound: ["second"], afterRemoval: [] },
	},
	{
		name: "a main-thread function runs through runWorklet, and its result's bits stop the event",
		source:
			"core/renderer/dom/fiber/fiber_element.cc (Element::FiberAddEvent); core/event/event_target.cc",
		async run(target) {
			const f = target.functions;
			const outer = view(target, "outer");
			const inner = view(target, "inner", outer);
			const listened: string[] = [];
			const returns = new Map<string, unknown>([["inner", { eventReturnResult: 1 }]]);
			const { ran, calls } = recordRuns(target, returns);
			f.__AddEvent(inner, "bindEvent", "tap", fn("inner"));
			f.__AddEventListener(inner, "tap", () => listened.push("inner"), {});
			f.__AddEvent(outer, "bindEvent", "tap", fn("outer"));
			f.__FlushElementTree();
			await target.tap(inner);
			const stopped = [...ran];
			returns.set("inner", { eventReturnResult: 2 });
			await target.tap(inner);
			return {
				source: calls.map((call) => (call.options as { source: number }).source)[0],
				stopPropagation: { ran: stopped, listened: listened.slice(0, 1) },
				stopImmediatePropagation: { ran: ran.slice(stopped.length), listened: listened.slice(1) },
			};
		},
		expected: {
			source: 1,
			stopPropagation: { ran: ["inner"], listened: ["inner"] },
			stopImmediatePropagation: { ran: ["inner"], listened: [] },
		},
	},
	{
		name: "a main-thread function's event carries its elements as elementRefptr, and the dataset as given",
		source: "core/renderer/dom/element.cc (Element::GetEventTargetInfo)",
		async run(target) {
			const f = target.functions;
			const outer = view(target, "outer");
			const inner = view(target, "inner", outer);
			f.__SetDataset(inner, { "drag-handle": "yes" });
			const { calls } = recordRuns(target);
			f.__AddEvent(outer, "bindEvent", "tap", fn("outer"));
			f.__FlushElementTree();
			await target.tap(inner);
			const event = calls[0]?.params[0] as {
				target: { elementRefptr: unknown; uid: number; id: string; dataset: unknown };
				currentTarget: { elementRefptr: unknown };
			};
			return {
				target: event.target.elementRefptr === inner,
				currentTarget: event.currentTarget.elementRefptr === outer,
				uid: event.target.uid === f.__GetElementUniqueID(inner),
				id: event.target.id,
				dataset: event.target.dataset,
			};
		},
		expected: {
			target: true,
			currentTarget: true,
			uid: true,
			id: "inner",
			dataset: { "drag-handle": "yes" },
		},
	},
	{
		name: "an event goes capture down, the target's capture bindings first, bubble up, and ends at a catch",
		source:
			"core/event/event_dispatcher.cc (EventDispatcher::Dispatch); core/event/event_target.cc",
		async run(target) {
			const f = target.functions;
			const page = f.__GetPageElement()!;
			const outer = view(target, "outer");
			const inner = view(target, "inner", outer);
			const order: string[] = [];
			target.useRunWorklet((value) => void order.push((value as { label: string }).label));
			f.__AddEvent(page, "bindEvent", "tap", fn("page"));
			f.__AddEvent(outer, "catchEvent", "tap", fn("outer catch"));
			f.__AddEventListener(inner, "tap", () => order.push("inner listener"), {});
			f.__AddEvent(inner, "bindEvent", "tap", fn("inner"));
			f.__AddEvent(inner, "capture-bind", "tap", fn("inner capture"));
			f.__AddEvent(outer, "capture-bind", "tap", fn("outer capture"));
			f.__FlushElementTree();
			await target.tap(inner);
			return order;
		},
		expected: ["outer capture", "inner capture", "inner listener", "inner", "outer catch"],
	},
	{
		name: "a global-bind listener hears an event elsewhere only once its element has the type filed",
		source: "core/renderer/dom/element.cc (Element::HandleGlobalEvent)",
		async run(target) {
			const f = target.functions;
			const watcher = view(target, "watcher");
			const button = view(target, "button");
			const heard: string[] = [];
			f.__AddEventListener(button, "tap", () => {}, {});
			f.__AddEventListener(watcher, "tap", () => heard.push("watcher"), {
				closure_type: 2,
				bind_type: 5,
			});
			f.__FlushElementTree();
			await target.tap(button);
			const before = heard.length;
			f.__AddEvent(watcher, "global-bindEvent", "tap", "");
			f.__FlushElementTree();
			await target.tap(button);
			return { beforeFiling: before, afterFiling: heard.length - before };
		},
		expected: { beforeFiling: 0, afterFiling: 1 },
	},
	{
		name: "a gesture detector's callbacks run while it is set, and not once it is removed",
		source:
			"core/runtime/lepus/bindings/renderer_functions.cc (FiberSetGestureDetector, FiberRemoveGestureDetector)",
		async run(target) {
			const f = target.functions;
			const element = view(target, "pan");
			const { ran } = recordRuns(target);
			const relations = { waitFor: [], simultaneous: [], continueWith: [] };
			const callbacks = [{ name: "onBegin", callback: { label: "begin" } }];
			f.__SetGestureDetector(element, 1, 0, { callbacks }, relations);
			f.__FlushElementTree();
			await target.gesture(element, 1, "onBegin");
			const whileSet = [...ran];
			f.__RemoveGestureDetector(element, 1);
			f.__FlushElementTree();
			await target.gesture(element, 1, "onBegin");
			return { whileSet, afterRemoval: ran.slice(whileSet.length) };
		},
		expected: { whileSet: ["begin"], afterRemoval: [] },
	},
	{
		name: "a gesture callback runs with source 2, its event and the gesture manager",
		source:
			"core/renderer/events/touch_event_handler.cc (HandleGestureEvent, TriggerFiberElementWorklet)",
		async run(target) {
			const f = target.functions;
			const element = view(target, "pan");
			const { calls } = recordRuns(target);
			const relations = { waitFor: [], simultaneous: [], continueWith: [] };
			f.__SetGestureDetector(
				element,
				2,
				0,
				{ callbacks: [{ name: "onUpdate", callback: { label: "update" } }] },
				relations,
			);
			f.__FlushElementTree();
			await target.gesture(element, 2, "onUpdate");
			const [event, manager] = calls[0]!.params as [
				{ params: unknown; detail: unknown; target: { elementRefptr: unknown } },
				Record<string, unknown>,
			];
			return {
				source: (calls[0]!.options as { source: number }).source,
				detailIsParams: JSON.stringify(event.detail) === JSON.stringify(event.params),
				target: event.target.elementRefptr === element,
				manager: Object.keys(manager)
					.filter((key) => typeof manager[key] === "function")
					.sort(),
			};
		},
		expected: {
			source: 2,
			detailIsParams: true,
			target: true,
			manager: ["__ConsumeGesture", "__SetGestureState"],
		},
	},
	{
		// A device shows no more than this: what the state and consumption do is the gesture's own
		// recognition, which no observation of the page reaches.
		name: "a gesture callback can call the gesture manager's two functions on its element",
		source: "core/runtime/lepusng/bindings/renderer_ng.cc (Utils::CreateGestureManager)",
		async run(target) {
			const f = target.functions;
			const element = view(target, "pan");
			const results: string[] = [];
			target.useRunWorklet((_value, params) => {
				const manager = params[1] as {
					__SetGestureState(element: unknown, id: number, state: number): void;
					__ConsumeGesture(element: unknown, id: number, params: unknown): void;
				};
				try {
					manager.__SetGestureState(element, 3, 1);
					manager.__ConsumeGesture(element, 3, { consume: true, inner: true });
					results.push("taken");
				} catch {
					results.push("refused");
				}
			});
			const relations = { waitFor: [], simultaneous: [], continueWith: [] };
			f.__SetGestureDetector(
				element,
				3,
				0,
				{ callbacks: [{ name: "onBegin", callback: { label: "begin" } }] },
				relations,
			);
			f.__FlushElementTree();
			await target.gesture(element, 3, "onBegin");
			return results;
		},
		expected: ["taken"],
	},
	{
		name: "a list asks for a cell with componentAtIndex: the list, its id, the index and an operation id",
		source: "core/runtime/lepus/bindings/renderer_functions.cc (FiberCreateList)",
		async run(target) {
			const f = target.functions;
			const asked: unknown[] = [];
			const list = f.__CreateList(
				0,
				(listElement, listId, index, operationId) => {
					asked.push({
						list: listElement === list,
						listId: listId === f.__GetElementUniqueID(list),
						index,
						operationId: typeof operationId === "number",
					});
					const cell = f.__CreateElement("list-item", 0);
					f.__AppendElement(list, cell);
					const uid = f.__GetElementUniqueID(cell);
					f.__FlushElementTree(cell, {
						triggerLayout: true,
						operationID: operationId,
						elementID: uid,
						listID: listId,
					});
					return uid;
				},
				() => {},
			);
			f.__SetInlineStyles(list, "width: 100px; height: 300px");
			f.__AppendElement(f.__GetPageElement()!, list);
			f.__SetAttribute(list, "update-list-info", {
				insertAction: [{ position: 0, type: "item", "item-key": "a" }],
				removeAction: [],
				updateAction: [],
			});
			f.__FlushElementTree();
			await target.showCell(list, 0);
			return asked[0];
		},
		expected: { list: true, listId: true, index: 0, operationId: true },
	},
	{
		name: "canceling a running animation sends animationcancel to a listener, with its name",
		source: "core/animation/animation.cc (Animation::Destroy, CreateEventAndSend)",
		async run(target) {
			const f = target.functions;
			const element = view(target, "fading");
			const heard: unknown[] = [];
			f.__AddEventListener(element, "animationcancel", (event) => heard.push(event), {});
			f.__FlushElementTree();
			f.__ElementAnimate(element, [
				0,
				"fade",
				[{ opacity: 0 }, { opacity: 1 }],
				{ duration: 5000 },
			]);
			f.__FlushElementTree();
			f.__ElementAnimate(element, [3, "fade"]);
			f.__FlushElementTree();
			await target.settle();
			return heard.map(
				(event) => (event as { params: { animation_name: string } }).params.animation_name,
			);
		},
		expected: ["fade"],
	},
	{
		name: "attributes read back as they were set, and a missing one is null",
		source:
			"core/runtime/lepus/bindings/renderer_functions.cc (FiberGetAttributeByName, FiberGetAttributeNames)",
		async run(target) {
			const f = target.functions;
			const element = f.__CreateView(0);
			f.__SetAttribute(element, "options", { a: [1] });
			f.__SetAttribute(element, "count", 3);
			f.__SetAttribute(element, "gone", "x");
			f.__SetAttribute(element, "gone", null);
			return {
				options: f.__GetAttributeByName(element, "options"),
				count: f.__GetAttributeByName(element, "count"),
				gone: f.__GetAttributeByName(element, "gone") === null,
				neverSet: f.__GetAttributeByName(element, "never") === null,
				names: [...f.__GetAttributeNames(element)].sort(),
			};
		},
		expected: {
			options: { a: [1] },
			count: 3,
			gone: true,
			neverSet: true,
			names: ["count", "options"],
		},
	},
	{
		name: "the engine tells the main thread of a data update through lynx.getEngine()",
		source: "core/renderer/template_assembler.h (DispatchEventFromEngineToCoreContext)",
		async run(target) {
			const heard: unknown[] = [];
			const listener = (event: { type: string; data: unknown; origin: string }) =>
				heard.push({ type: event.type, data: (event.data as unknown[])[0], origin: event.origin });
			target.engineEvents.addEventListener("__UpdatePage", listener);
			await target.updatePage({ count: 2 });
			target.engineEvents.removeEventListener("__UpdatePage", listener);
			return heard;
		},
		expected: [{ type: "__UpdatePage", data: { count: 2 }, origin: "Engine" }],
	},
];

/** What a UI method answers for `boundingClientRect`. */
interface Rect {
	left: number;
	top: number;
	width: number;
	height: number;
}
