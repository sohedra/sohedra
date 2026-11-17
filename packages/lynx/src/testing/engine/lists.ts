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
	/** Lynx shows the cell at `index` (componentAtIndex); returns its element. */
	show(index: number): LynxElement;
	/** Lynx hands the cell back (enqueueComponent), to reuse it for another item. */
	hide(cell: LynxElement): void;
}

/** The functions that make and change lists, over the engine's records. */
export function listFunctions(engine: EngineState): ListFunctions {
	return {
		__CreateList(parent, componentAtIndex, enqueueComponent, _info, componentAtIndexes) {
			if (typeof parent !== "number") throw argumentError("__CreateList", 0, "a number");
			if (typeof componentAtIndex !== "function") {
				throw argumentError("__CreateList", 1, "a function");
			}
			if (typeof enqueueComponent !== "function") {
				throw argumentError("__CreateList", 2, "a function");
			}
			const state = makeElement(engine, "list");
			state.list = {
				componentAtIndex,
				componentAtIndexes,
				enqueueComponent,
				updates: [],
				operations: 0,
			};
			return state.node;
		},
		__UpdateListCallbacks(element, componentAtIndex, enqueueComponent, componentAtIndexes) {
			const state = stateOf(engine, element, "__UpdateListCallbacks", 0);
			if (!state.list) throw argumentError("__UpdateListCallbacks", 0, "a list");
			state.list.componentAtIndex = componentAtIndex;
			state.list.enqueueComponent = enqueueComponent;
			state.list.componentAtIndexes = componentAtIndexes;
		},
	};
}

/** A list receives an update the page set as `update-list-info`; it is not an attribute. */
export function receiveListUpdate(state: ElementState, update: ListUpdate): boolean {
	if (!state.list) return false;
	state.list.updates.push(update);
	state.list.onUpdate?.(update);
	return true;
}

/** What a test sees of a list. */
export function listHandle(engine: EngineState, element: LynxElement): ListHandle {
	const state = stateOf(engine, element, "list", 0);
	const list: ListState | undefined = state.list;
	if (!list) throw new Error(`${elementName(state)} is not a list.`);
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
		show(index) {
			const uid = list.componentAtIndex(state.node, state.uid, index, ++list.operations);
			const cell = engine.made.get(uid)?.node;
			if (!cell) {
				throw new Error(`The list has no cell for the unique id ${uid} at index ${index}.`);
			}
			return cell;
		},
		hide(cell) {
			list.enqueueComponent(state.node, state.uid, stateOf(engine, cell, "hide", 0).uid);
		},
	};
}
