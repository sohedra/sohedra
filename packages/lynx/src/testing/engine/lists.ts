// A `<list>`: Lynx asks it for cells through the callbacks the page gave, and the page sends it
// updates as the `update-list-info` attribute (core/runtime/lepus/bindings/renderer_functions.cc,
// FiberCreateList, FiberUpdateListCallbacks).

import { argumentError, elementName, stateOf } from "./state.ts";
import type { ElementState, EngineState, ListState } from "./state.ts";
import { makeElement } from "./tree.ts";
import type {
	ComponentAtIndex,
	ComponentAtIndexes,
	EnqueueComponent,
	ListUpdate,
	LynxElement,
} from "./types.ts";

/** The functions that make and change lists. */
export interface ListFunctions {
	__CreateList(
		parentComponentUniqueId: number,
		componentAtIndex: ComponentAtIndex,
		enqueueComponent: EnqueueComponent,
		info?: unknown,
		componentAtIndexes?: ComponentAtIndexes,
	): LynxElement;
	__UpdateListCallbacks(
		list: LynxElement,
		componentAtIndex: ComponentAtIndex,
		enqueueComponent: EnqueueComponent,
		componentAtIndexes?: ComponentAtIndexes,
	): void;
}

/** What a test sees of a list, and does for Lynx: it asks for cells, and hands them back. */
export interface ListHandle {
	readonly componentAtIndex: ComponentAtIndex;
	readonly componentAtIndexes: ComponentAtIndexes | undefined;
	readonly enqueueComponent: EnqueueComponent;
	/** Every `update-list-info` the page sent. */
	readonly updates: ListUpdate[];
	/** Called inside each update, as iOS asks for cells right away. */
	onUpdate: ((update: ListUpdate) => void) | undefined;
	/**
	 * Lynx shows the cell at `index` (componentAtIndex); returns its element. On the async list
	 * (`custom-list-name="list-container"`), a cell the page answers later throws until it came:
	 * ask for it with `ask`, let the threads settle, and show it then.
	 */
	show(index: number): LynxElement;
	/**
	 * Lynx asks for the cell at `index`: its element, or, on the async list, `undefined` while the
	 * page has not flushed it yet with the request's operation id. Asked again, it is asked again.
	 */
	ask(index: number): LynxElement | undefined;
	/**
	 * Lynx asks for the cells at `indexes` at once (componentAtIndexes), as its batch rendering
	 * does; returns the requests' operation ids, in order.
	 */
	askMany(indexes: number[]): number[];
	/** The element of a cell asked for with `ask`, once the page flushed it with its operation id. */
	given(operation: number): LynxElement | undefined;
	/** The operation id of the last request for a cell. */
	readonly operation: number;
	/**
	 * Lynx hands the cell back (enqueueComponent), to reuse it for another item. Throws for the cell
	 * of an item it was told is not recyclable, which Lynx never hands back
	 * (core/renderer/ui_component/list/list_layout_manager.cc).
	 */
	hide(cell: LynxElement): void;
}

/** The functions that make and change lists, over the engine's records. */
export function listFunctions(engine: EngineState): ListFunctions {
	return {
		__CreateList(parent, componentAtIndex, enqueueComponent, info, componentAtIndexes) {
			if (typeof parent !== "number")
				throw argumentError({ fn: "__CreateList", index: 0, expected: "a number" });
			if (typeof componentAtIndex !== "function") {
				throw argumentError({ fn: "__CreateList", index: 1, expected: "a function" });
			}
			if (typeof enqueueComponent !== "function") {
				throw argumentError({ fn: "__CreateList", index: 2, expected: "a function" });
			}
			// The info may name another tag for the list.
			const tag = typeof info === "object" && info !== null ? Reflect.get(info, "tag") : undefined;
			const state = makeElement(engine, typeof tag === "string" ? tag : "list");
			state.list = {
				componentAtIndex,
				componentAtIndexes,
				enqueueComponent,
				updates: [],
				operations: 0,
				binding: new Map(),
				newest: new Map(),
				bound: new Map(),
				items: 0,
			};
			return state.node;
		},
		__UpdateListCallbacks(element, componentAtIndex, enqueueComponent, componentAtIndexes) {
			const state = stateOf(engine, { value: element, fn: "__UpdateListCallbacks", index: 0 });
			if (!state.list)
				throw argumentError({ fn: "__UpdateListCallbacks", index: 0, expected: "a list" });
			state.list.componentAtIndex = componentAtIndex;
			state.list.enqueueComponent = enqueueComponent;
			state.list.componentAtIndexes = componentAtIndexes;
		},
	};
}

/** Whether `value` has the three lists of a list update that Lynx reads. */
function isListUpdate(value: unknown): value is ListUpdate {
	if (typeof value !== "object" || value === null) return false;
	return ["insertAction", "removeAction", "updateAction"].every((key) =>
		Array.isArray(Reflect.get(value, key)),
	);
}

/**
 * A list receives an update the page set as `update-list-info`; it is not an attribute. Lynx reads
 * the three lists of items inserted, removed and updated (core/renderer/ui_component/list/list_adapter.cc).
 */
export function receiveListUpdate(state: ElementState, value: unknown): boolean {
	if (!state.list) return false;
	if (!isListUpdate(value)) {
		throw new Error(
			`update-list-info should be { insertAction, removeAction, updateAction } on ${elementName(state)}: ` +
				"three lists, which Lynx reads to know the list's items.",
		);
	}
	state.list.items += value.insertAction.length - value.removeAction.length;
	state.list.updates.push(value);
	state.list.onUpdate?.(value);
	return true;
}

/** Whether the list was told last that the item with this key is not recyclable. */
function heldForGood(list: ListState, key: unknown): boolean {
	for (let index = list.updates.length - 1; index >= 0; index--) {
		const { insertAction, updateAction } = list.updates[index]!;
		const told = [...updateAction, ...insertAction].find((info) => info["item-key"] === key);
		if (told) return told["recyclable"] === false;
	}
	return false;
}

/**
 * Lynx binds the cells a flush names (`operationID` and `elementID`, or `operationIDs` and
 * `elementIDs`) to the requests of a list it is waiting for. Only the newest request of an index
 * binds, once: a cell flushed for an older one, or again for one already bound, is handed back
 * (`enqueueComponent`), while Lynx shows the cell of the newest
 * (core/renderer/ui_component/list/default_list_adapter.cc, BindItemHolder and
 * OnFinishBindItemHolder; batch_list_adapter.cc, OnFinishBindInternal). An id of -1 names no cell.
 */
export function bindFlushed(engine: EngineState, options: unknown): void {
	if (typeof options !== "object" || options === null) return;
	const listId: unknown = Reflect.get(options, "listID");
	const list = typeof listId === "number" ? engine.made.get(listId) : undefined;
	if (!list?.list) return;
	const pairs: [unknown, unknown][] = [];
	const operations: unknown = Reflect.get(options, "operationIDs");
	const elements: unknown = Reflect.get(options, "elementIDs");
	if (Array.isArray(operations) && Array.isArray(elements))
		for (const [at, operation] of operations.entries()) pairs.push([operation, elements[at]]);
	else pairs.push([Reflect.get(options, "operationID"), Reflect.get(options, "elementID")]);
	const state = list.list;
	for (const [operation, uid] of pairs) {
		if (typeof operation !== "number" || typeof uid !== "number" || uid === -1) continue;
		const index = state.binding.get(operation);
		state.binding.delete(operation);
		if (index !== undefined && state.newest.get(index) === operation) {
			state.bound.set(operation, uid);
			continue;
		}
		state.enqueueComponent(list.node, list.uid, uid);
	}
}

/** The cell request `operation` of a list bound, once the page flushed it. */
function given(
	engine: EngineState,
	list: ElementState,
	operation: number,
): LynxElement | undefined {
	const uid = list.list?.bound.get(operation);
	return uid === undefined ? undefined : engine.made.get(uid)?.node;
}

/** A new request of the list for the cell at `index`. */
function newRequest(state: ListState, index: number): number {
	const operation = ++state.operations;
	state.binding.set(operation, index);
	state.newest.set(index, operation);
	return operation;
}

/** What a test sees of a list. */
export function listHandle(engine: EngineState, element: LynxElement): ListHandle {
	const state = stateOf(engine, { value: element, fn: "list", index: 0 });
	const found: ListState | undefined = state.list;
	if (!found) throw new Error(`${elementName(state)} is not a list.`);
	const list: ListState = found;
	function ask(index: number): LynxElement | undefined {
		if (index < 0 || index >= list.items) {
			throw new Error(
				`The list has ${list.items} items, so Lynx asks for no cell at index ${index}.`,
			);
		}
		engine.enter();
		const operation = newRequest(list, index);
		const uid = list.componentAtIndex(state.node, state.uid, index, operation);
		// The engine reads the answer as a number, and anything else as 0
		// (core/renderer/dom/fiber/list_element.cc, ComponentAtIndex). The async list takes the cell
		// from a flush that names the request, now or later, as a device showed.
		if (typeof uid !== "number" && state.attrs["custom-list-name"] === "list-container")
			return given(engine, state, operation);
		const cell = typeof uid === "number" ? engine.made.get(uid)?.node : undefined;
		if (!cell) {
			throw new Error(`The list has no cell for the unique id ${String(uid)} at index ${index}.`);
		}
		return cell;
	}

	return {
		get componentAtIndex() {
			return list.componentAtIndex;
		},
		get componentAtIndexes() {
			return list.componentAtIndexes;
		},
		get enqueueComponent() {
			return list.enqueueComponent;
		},
		updates: list.updates,
		get onUpdate() {
			return list.onUpdate;
		},
		set onUpdate(listener) {
			list.onUpdate = listener;
		},
		get operation() {
			return list.operations;
		},
		given: (operation) => given(engine, state, operation),
		askMany(indexes) {
			if (!list.componentAtIndexes) throw new Error("The list was given no componentAtIndexes.");
			const operations = indexes.map((index) => newRequest(list, index));
			engine.enter();
			list.componentAtIndexes(state.node, state.uid, indexes, operations, false, false);
			return operations;
		},
		ask,
		show(index) {
			const cell = ask(index);
			if (!cell) {
				throw new Error(
					`The list's cell at index ${index} comes later, with a flush of its request ${list.operations}: let the threads settle and show it again.`,
				);
			}
			return cell;
		},
		hide(cell) {
			const cellState = stateOf(engine, { value: cell, fn: "hide", index: 0 });
			const key = cellState.attrs["item-key"];
			if (key !== undefined && heldForGood(list, key)) {
				throw new Error(
					`Lynx never hands back the cell of an item that is not recyclable: ${JSON.stringify(key)}.`,
				);
			}
			engine.enter();
			list.enqueueComponent(state.node, state.uid, cellState.uid);
		},
	};
}
