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

/** What a test sees of a list. */
export function listHandle(engine: EngineState, element: LynxElement): ListHandle {
	const state = stateOf(engine, { value: element, fn: "list", index: 0 });
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
			if (index < 0 || index >= list.items) {
				throw new Error(
					`The list has ${list.items} items, so Lynx asks for no cell at index ${index}.`,
				);
			}
			engine.enter();
			const uid = list.componentAtIndex(state.node, state.uid, index, ++list.operations);
			const cell = engine.made.get(uid)?.node;
			if (!cell) {
				throw new Error(`The list has no cell for the unique id ${uid} at index ${index}.`);
			}
			return cell;
		},
		hide(cell) {
			engine.enter();
			list.enqueueComponent(
				state.node,
				state.uid,
				stateOf(engine, { value: cell, fn: "hide", index: 0 }).uid,
			);
		},
	};
}
