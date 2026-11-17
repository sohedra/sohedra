// Applies the background's ops with Lynx's element functions.
//
// Events use plain listeners (`__AddEventListener`, which the `enableEventHandleRefactor` page
// config the plugin sets turns on): each element's event slot (`type:name`) gets one listener,
// which sends its handler id to the background.
//
// A `<list>`'s cells do not go into the tree here: the list takes each one when Lynx asks for it
// (./lists.ts).

import { LIST_ITEM_INFO, OpCode, ROOT_ID } from "../wire/index.ts";
import type { LynxEventType, Op } from "../wire/index.ts";
import { mainThreadError } from "./catalogue.ts";
import { createCodeStyles } from "./code-styles.ts";
import type { CodeStyles } from "./code-styles.ts";
import { createFlattening } from "./flatten.ts";
import type { Flattening } from "./flatten.ts";
import { mainThread } from "./globals.ts";
import type { ListenerOptions, LynxElement } from "./globals.ts";
import { createLists, LIST_ONLY_INFO } from "./lists.ts";

/** The engine's `closure_type` with which it reads `bind_type`. */
const CLOSURE_CORE = 2;

/**
 * How each event type is bound: `bind_type` 1 is bubble, 2 capture, 3 capture and catch, 4
 * bubble and catch (Lynx's `Event::BindType`).
 */
const LISTENER_OPTIONS: Readonly<Record<LynxEventType, ListenerOptions>> = {
	bindEvent: { closure_type: CLOSURE_CORE, bind_type: 1 },
	"capture-bind": { closure_type: CLOSURE_CORE, bind_type: 2 },
	"capture-catch": { closure_type: CLOSURE_CORE, bind_type: 3 },
	catchEvent: { closure_type: CLOSURE_CORE, bind_type: 4 },
};

/** `value` as an attribute's text: a string as it is, a number or a boolean written out, else JSON. */
function textOf(value: unknown): string {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return value.toString();
	return JSON.stringify(value) ?? "";
}

/** Sends an event of handler `handler` to the background. */
export type Dispatch = (handler: number, event: unknown) => void;

/** One op the applier could not apply, and why. */
export interface FailedOp {
	op: Op;
	error: unknown;
}

/** The page's elements, as the background's ops made them. */
export interface Applier {
	/** Applies `ops` in order. An op that throws is skipped, and the others are applied. */
	apply(ops: Op[]): FailedOp[];
	/** Tells the lists inside cells whose items changed; ends a patch. */
	flushLists(): void;
	/** The tree was flushed: the elements made so far have their views. */
	flushed(): void;
	/** Whether the element with this id was made since the tree was last flushed. */
	isNew(id: number): boolean;
	/** The element with this id. */
	element(id: number): LynxElement | undefined;
	/** The background's id of a Lynx element, by its unique id. */
	idForUid(uid: number): number | undefined;
	/** The background's id of a Lynx element. */
	idOf(element: LynxElement): number | undefined;
	/** The elements kept from being flattened. */
	readonly flattening: Flattening;
	/** The styles code set. */
	readonly styles: CodeStyles;
	/** Removes every listener it added, the page's own too: no event reaches the background after. */
	silence(): void;
	/** Takes the page's elements off it and lets go of every one. */
	clear(): void;
	/** The page is gone: Lynx gets no callbacks of its lists to call. */
	destroy(): void;
}

/** What an applier is made with. */
export interface ApplierOptions {
	/** The page element. */
	page: LynxElement;
	/** Sends an element's event to the background. */
	dispatch: Dispatch;
	/** Makes the list cell with this id from what the main thread kept for it. */
	openCell(id: number): void;
	/** Reports an error the engine's call into the page threw. */
	report(error: unknown): void;
}

interface Registration {
	name: string;
	handler: number;
	listener: (event: unknown) => void;
	options: ListenerOptions;
}

/** Makes the applier of a page. */
export function createApplier({ page, dispatch, openCell, report }: ApplierOptions): Applier {
	const elements = new Map<number, LynxElement>([[ROOT_ID, page]]);
	const pageUid = mainThread.__GetElementUniqueID(page);
	const flattening = createFlattening();
	const styles = createCodeStyles();
	const lists = createLists({ pageUid, openCell, elementOf: (id) => elements.get(id), report });
	// The elements made since the tree was last flushed: they have no view yet.
	const made = new Set<number>();
	const idByUid = new Map<number, number>([[pageUid, ROOT_ID]]);
	const uidById = new Map<number, number>([[ROOT_ID, pageUid]]);
	// Each element's `data-*` attributes, which Lynx takes as one dataset.
	const datasets = new Map<number, Record<string, unknown>>();
	const registrations = new Map<number, Map<string, Registration>>();
	// The elements in the page element, which a reset takes off it.
	const onPage = new Set<number>();

	function get(id: number): LynxElement {
		const element = elements.get(id);
		if (element === undefined) throw mainThreadError({ code: "element_missing", details: { id } });
		return element;
	}

	function removeListener(id: number, slot: string): void {
		const slots = registrations.get(id);
		const registration = slots?.get(slot);
		if (!slots || !registration) return;
		mainThread.__RemoveEventListener(
			get(id),
			registration.name,
			registration.listener,
			registration.options,
		);
		slots.delete(slot);
		if (slots.size === 0) registrations.delete(id);
	}

	function setEvent(id: number, type: LynxEventType, name: string, handler: number): void {
		const slot = `${type}:${name}`;
		if (registrations.get(id)?.get(slot)?.handler === handler) return;
		removeListener(id, slot);
		if (handler === 0) return;
		const registration: Registration = {
			name,
			handler,
			listener: (event) => dispatch(handler, event),
			options: LISTENER_OPTIONS[type],
		};
		mainThread.__AddEventListener(get(id), name, registration.listener, registration.options);
		let slots = registrations.get(id);
		if (!slots) registrations.set(id, (slots = new Map()));
		slots.set(slot, registration);
	}

	function release(id: number): void {
		const slots = registrations.get(id);
		// oxlint-disable-next-line unicorn/no-useless-spread -- copied: removeListener deletes from slots
		if (slots) for (const slot of [...slots.keys()]) removeListener(id, slot);
		datasets.delete(id);
		lists.release(id);
		made.delete(id);
		const uid = uidById.get(id);
		if (uid !== undefined) idByUid.delete(uid);
		uidById.delete(id);
		elements.delete(id);
		onPage.delete(id);
	}

	function create(id: number, tag: string): LynxElement {
		switch (tag) {
			case "list":
				return lists.create(id);
			case "view":
				return mainThread.__CreateView(pageUid);
			case "text":
				return mainThread.__CreateText(pageUid);
			case "image":
				return mainThread.__CreateImage(pageUid);
			case "scroll-view":
				return mainThread.__CreateScrollView(pageUid);
			default:
				return mainThread.__CreateElement(tag, pageUid);
		}
	}

	function setDataset(id: number, key: string, value: unknown): void {
		const dataset = { ...datasets.get(id) };
		if (value == null) delete dataset[key];
		else dataset[key] = value;
		datasets.set(id, dataset);
		mainThread.__SetDataset(get(id), dataset);
	}

	function setAttribute(id: number, key: string, value: unknown): void {
		if (key.startsWith("data-")) {
			setDataset(id, key.slice(5), value);
			return;
		}
		if (LIST_ITEM_INFO.has(key)) {
			lists.setInfo(id, { key, value });
			if (LIST_ONLY_INFO.has(key)) return;
		}
		const element = get(id);
		switch (key) {
			case "class":
				mainThread.__SetClasses(element, value == null ? "" : textOf(value));
				return;
			case "style": {
				const css = value == null ? "" : textOf(value);
				mainThread.__SetInlineStyles(element, css);
				// That replaced every inline style: what code set comes back.
				styles.restore(element, css);
				return;
			}
			case "flatten":
				flattening.set(element, value);
				return;
			case "id":
				mainThread.__SetID(element, value == null ? null : textOf(value));
				return;
			default:
				mainThread.__SetAttribute(element, key, value);
		}
	}

	function applyOne(op: Op): void {
		switch (op[0]) {
			case OpCode.Create: {
				const element = create(op[1], op[2]);
				const uid = mainThread.__GetElementUniqueID(element);
				elements.set(op[1], element);
				idByUid.set(uid, op[1]);
				uidById.set(op[1], uid);
				made.add(op[1]);
				return;
			}
			case OpCode.CreateText: {
				const raw = mainThread.__CreateElement("raw-text", pageUid);
				mainThread.__SetAttribute(raw, "text", op[2]);
				elements.set(op[1], raw);
				return;
			}
			case OpCode.SetText:
				mainThread.__SetAttribute(get(op[1]), "text", op[2]);
				return;
			case OpCode.SetAttr:
				setAttribute(op[1], op[2], op[3]);
				return;
			case OpCode.Insert:
				if (lists.isList(op[1])) lists.insert(op[1], { id: op[2], anchor: op[3] });
				else if (op[3] === 0) mainThread.__AppendElement(get(op[1]), get(op[2]));
				else mainThread.__InsertElementBefore(get(op[1]), get(op[2]), get(op[3]));
				if (op[1] === ROOT_ID) onPage.add(op[2]);
				return;
			case OpCode.Remove:
				if (lists.isList(op[1])) lists.remove(op[1], op[2]);
				else mainThread.__RemoveElement(get(op[1]), get(op[2]));
				if (op[1] === ROOT_ID) onPage.delete(op[2]);
				return;
			case OpCode.SetEvent:
				setEvent(op[1], op[2], op[3], op[4]);
				return;
			case OpCode.Release:
				release(op[1]);
				return;
			case OpCode.ListUpdate:
				lists.update(op[1], { info: op[2], items: op[3], added: op[4], removed: op[5] });
				return;
		}
	}

	return {
		apply(ops) {
			const failed: FailedOp[] = [];
			// One `try` around the loop, entered again after an op that threw: the ops that do not
			// throw pay nothing for it.
			let i = 0;
			while (i < ops.length) {
				try {
					for (; i < ops.length; i++) applyOne(ops[i]!);
				} catch (error) {
					failed.push({ op: ops[i]!, error });
					i++;
				}
			}
			return failed;
		},
		flushLists: () => lists.flush(),
		flushed: () => made.clear(),
		isNew: (id) => made.has(id),
		element: (id) => elements.get(id),
		idForUid: (uid) => idByUid.get(uid),
		idOf: (element) => idByUid.get(mainThread.__GetElementUniqueID(element)),
		flattening,
		styles,
		silence() {
			// oxlint-disable-next-line unicorn/no-useless-spread -- copied: removeListener deletes from the map
			for (const id of [...registrations.keys()]) {
				// oxlint-disable-next-line unicorn/no-useless-spread -- copied: removeListener deletes from the slots
				for (const slot of [...registrations.get(id)!.keys()]) removeListener(id, slot);
			}
		},
		clear() {
			for (const id of onPage) mainThread.__RemoveElement(page, get(id));
			onPage.clear();
			// oxlint-disable-next-line unicorn/no-useless-spread -- copied: release deletes from the map
			for (const id of [...elements.keys()]) if (id !== ROOT_ID) release(id);
		},
		destroy() {
			lists.destroy();
		},
	};
}
