// The renderer's output: element operations as plain data, which the background sends and the main
// thread applies with Lynx's element functions. Elements are named by ids the background gives;
// event handlers by handler ids, the functions staying on the background.

import type { LynxEventType } from "./events.ts";
import type { ListUpdateInfo } from "./list-diff.ts";

/** The id of the page's root, which the main thread binds to Lynx's page element. */
export const ROOT_ID = 1;

/** What each op does: its first member. */
export const OpCode = {
	/** `[Create, id, tag]` */
	Create: 1,
	/** `[CreateText, id, text]`: a `raw-text` element. */
	CreateText: 2,
	/** `[SetText, id, text]` */
	SetText: 3,
	/** `[SetAttr, id, name, value]`: a value of `null` removes the attribute. */
	SetAttr: 4,
	/** `[Insert, parentId, id, anchorId]`: an anchor of 0 appends. */
	Insert: 5,
	/** `[Remove, parentId, id]` */
	Remove: 6,
	/** `[SetEvent, id, type, name, handlerId]`: a handler of 0 removes the event. */
	SetEvent: 7,
	/** `[Release, id]`: the element is gone for good. */
	Release: 8,
	/**
	 * `[ListUpdate, listId, info, items, added, removed]`: a `<list>` whose items the background
	 * tracks. `items` are the cells' ids in order, `added` and `removed` those that joined or left.
	 */
	ListUpdate: 9,
} as const;

/**
 * An attribute's value. Objects and arrays go as they are: Lynx reads them as values
 * (`accessibility-actions`, an object `data-*`, a gesture).
 */
export type AttrValue = string | number | boolean | null | object;

/** One element operation. */
export type Op =
	| [typeof OpCode.Create, number, string]
	| [typeof OpCode.CreateText, number, string]
	| [typeof OpCode.SetText, number, string]
	| [typeof OpCode.SetAttr, number, string, AttrValue]
	| [typeof OpCode.Insert, number, number, number]
	| [typeof OpCode.Remove, number, number]
	| [typeof OpCode.SetEvent, number, LynxEventType, string, number]
	| [typeof OpCode.Release, number]
	| [typeof OpCode.ListUpdate, number, ListUpdateInfo, number[], number[], number[]];
