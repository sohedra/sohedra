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
	/**
	 * `[SetStyles, id, styles]`: inline styles set from code (`setStyleProperty`), which a write of
	 * `style` keeps; a value of `null` or `""` gives the property back to `style`.
	 */
	SetStyles: 10,
	/** `[Animate, id, args]`: Lynx's `__ElementAnimate` arguments, `[operation, name, …]`. */
	Animate: 11,
	/**
	 * `[Branch, parentId, key, count, at]`: written only among a page's rendered items, for
	 * hydration. A block of Svelte's took the branch `key` (an `{#if}`'s number, as Svelte's server
	 * writes it in the block's marker, or a `BranchKey`); its content is the last `count` of
	 * `parentId`'s entries once its first `at` children are entries, an inner block being one. An
	 * `at` of -1 is a mark that cannot be read: the background lost track of a block there, and
	 * hydration makes that parent's children again.
	 */
	Branch: 12,
} as const;

/** The key of a branch mark whose block is not one of an `{#if}`'s branches. */
export const BranchKey = {
	/** A second state: a list's `{:else}`, an `{#await}` given a value, a boundary's `pending`. */
	Second: -2,
	/** An `{#await}` given a promise: the background draws its content after the rendered items. */
	Await: -3,
	/**
	 * A boundary's `failed`. Neither the background nor a synchronous first frame writes it among
	 * the rendered items: it is here for the first frame's parser, which reads `<!--[?-->`.
	 */
	Failed: -4,
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
	| [typeof OpCode.ListUpdate, number, ListUpdateInfo, number[], number[], number[]]
	| [typeof OpCode.SetStyles, number, Record<string, string | number | null>]
	| [typeof OpCode.Animate, number, unknown[]]
	| [typeof OpCode.Branch, number, number, number, number];
