// Every element function the main thread calls exists on the engine, the build keeps it to the
// main thread, and a page's globals carry them.

import { describe, expect, it } from "@rstest/core";

import { ELEMENT_FUNCTIONS } from "../../../../src/build/checks/element-functions.ts";
import { engineForEach } from "./engine-fixture.ts";

const engine = engineForEach();

// The functions the main-thread runtime calls on Lynx, by the names it calls them with.
const CALLED_BY_THE_MAIN_THREAD = [
	"__AddEvent",
	"__AddEventListener",
	"__AddInlineStyle",
	"__AdoptStyleSheet",
	"__AppendElement",
	"__CreateElement",
	"__CreateImage",
	"__CreateList",
	"__CreatePage",
	"__CreateScrollView",
	"__CreateText",
	"__CreateView",
	"__ElementAnimate",
	"__FlushElementTree",
	"__GetAttributeByName",
	"__GetAttributeNames",
	"__GetComputedStyleByKey",
	"__GetDataset",
	"__GetElementUniqueID",
	"__GetID",
	"__GetPageElement",
	"__GetParent",
	"__InsertElementBefore",
	"__InvokeUIMethod",
	"__LoadStyleSheet",
	"__QuerySelector",
	"__QuerySelectorAll",
	"__RemoveElement",
	"__RemoveEventListener",
	"__RemoveGestureDetector",
	"__SetAttribute",
	"__SetClasses",
	"__SetDataset",
	"__SetGestureDetector",
	"__SetID",
	"__SetInlineStyles",
	"__UpdateListCallbacks",
	"requestAnimationFrame",
];

describe("the engine's element functions", () => {
	it("have every function the main thread calls", () => {
		const functions = engine().functions as unknown as Record<string, unknown>;
		const missing = CALLED_BY_THE_MAIN_THREAD.filter(
			(name) => typeof functions[name] !== "function",
		);
		expect(missing).toEqual([]);
	});

	it("have nothing else: a function Lynx has no use for here is not a stand-in", () => {
		const names = Object.keys(engine().functions).toSorted();
		expect(names).toEqual(CALLED_BY_THE_MAIN_THREAD.toSorted());
	});

	it("are each one the build keeps to the main thread", () => {
		const unknown = Object.keys(engine().functions).filter(
			(name) => name.startsWith("__") && !ELEMENT_FUNCTIONS.has(name),
		);
		expect(unknown).toEqual([]);
	});
});
