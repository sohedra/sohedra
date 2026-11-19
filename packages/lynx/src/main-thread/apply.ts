// Applies the background's ops with Lynx's element functions.
//
// Events use plain listeners (`__AddEventListener`, which the `enableEventHandleRefactor` page
// config the plugin sets turns on): each element's event slot (`type:name`) gets one listener,
// which sends its handler id to the background.
//
// A `<list>`'s cells do not go into the tree here: the list takes each one when Lynx asks for it,
// and lets go of one Lynx handed back once the background wrote it again (./lists.ts).

import {
	decodeCell,
	LIST_ITEM_INFO,
	MAIN_THREAD_PREFIX,
	OpCode,
	ROOT_ID,
	sentNames,
} from "../wire/index.ts";
import type { LynxEventType, Op } from "../wire/index.ts";
import { createAnimations } from "./animations.ts";
import { mainThreadError } from "./catalogue.ts";
import { createCodeStyles } from "./code-styles.ts";
import type { CodeStyles } from "./code-styles.ts";
import { createFlattening } from "./flatten.ts";
import type { Flattening } from "./flatten.ts";
import type { FunctionsPage } from "./functions/page.ts";
import { mainThread } from "./globals.ts";
import type { ListenerOptions, LynxElement } from "./globals.ts";
import { createInputNumbers, inputValue } from "./inputs.ts";
import type { InputNumbers } from "./inputs.ts";
import { LISTENER_OPTIONS } from "./listeners.ts";
import { createLists, LIST_ONLY_INFO } from "./lists.ts";
import type { AdoptedItems, HeldCell, ListState } from "./lists.ts";
import type { WaitingCells } from "./lists/waiting.ts";

/** `value` as an attribute's text: a string as it is, a number or a boolean written out, else JSON. */
function textOf(value: unknown): string {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return value.toString();
	return JSON.stringify(value) ?? "";
}

/**
 * Sends an event of handler `handler` to the background; an `input` event with the number the
 * page gave it (./inputs.ts).
 */
export type Dispatch = (handler: number, event: unknown, input?: number) => void;

/** One op the applier could not apply, and why. */
export interface FailedOp {
	op: Op;
	error: unknown;
}

/** An element as one applier lets go of it and another takes it: hydration moves it. */
export interface TakenElement {
	element: LynxElement;
	/** Its `data-*` values. */
	dataset: Record<string, unknown> | undefined;
	/** A list's own state, with its cells. */
	list: ListState | undefined;
}

/** The page's elements, as the background's ops made them. */
export interface Applier extends WaitingCells {
	/** Applies `ops` in order. An op that throws is skipped, and the others are applied. */
	apply(ops: Op[]): FailedOp[];
	/** Tells the lists inside cells whose items changed; ends a patch. */
	flushLists(): void;
	/** The list cells to ask the background to write again now, `max` at most, marked asked. */
	takeRewrites(max: number): number[];
	/** A list cell Lynx never showed is to be written again: its kept text piled up. */
	askCell(id: number): void;
	/**
	 * The background wrote a list cell again, as `text`: a cell Lynx handed back leaves its list
	 * and its elements are let go of. Whether the text replaces what is kept for the cell; not when
	 * the cell was not asked for, or Lynx asked for it since and it keeps its elements.
	 */
	replaceCell(id: number, text: string): boolean;
	/** The element with this id. */
	element(id: number): LynxElement | undefined;
	/** The background's id of a Lynx element, by its unique id. */
	idForUid(uid: number): number | undefined;
	/** The background's id of a Lynx element. */
	idOf(element: LynxElement): number | undefined;
	/** The `flatten` of the page's elements, and the elements held so that Lynx gives them a UI. */
	readonly flattening: Flattening;
	/** The styles code set. */
	readonly styles: CodeStyles;
	/** The numbers of the fields' `input` events. */
	readonly inputs: InputNumbers;
	/** The handler id of an element's event slot (`bindEvent:tap`), if it listens there. */
	handlerOf(id: number, slot: string): number | undefined;
	/** The cells of a list that have elements, with whether Lynx holds them. */
	heldCells(id: number): HeldCell[];
	/** A list's items now, and as Lynx last heard of them. */
	listOrder(id: number): { items: number[]; committed: number[] };
	/**
	 * Lets go of an element without touching it: it stays where it is, and another applier takes it
	 * (`adopt`). Its listeners must be gone (`silence`).
	 */
	forget(id: number): TakenElement;
	/** Takes an element another applier let go of, under this id; a list takes its cells too. */
	adopt(id: number, taken: TakenElement, options: { onPage: boolean; list?: AdoptedItems }): void;
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
	/** Whether a list cell can be made now; one that cannot is a deferred row, answered later. */
	written?: (id: number) => boolean;
	/** Asks the background to render a deferred row and write it. */
	request?: (id: number) => void;
	/**
	 * Asks for `takeRewrites` on a later task, outside Lynx's callbacks. Without it, the lists keep
	 * every cell they made.
	 */
	scheduleRewrites?: () => void;
	/** Reports an error the engine's call into the page threw. */
	report(error: unknown): void;
	/** The styles code set, shared with the applier whose elements this one adopts. */
	styles?: CodeStyles;
	/** The `flatten` of the elements, and those held for a UI, shared the same way. */
	flattening?: Flattening;
	/** What the elements' `main-thread:` attributes bind: the page's main-thread functions. */
	functions: FunctionsPage;
	/** The numbers of the fields' `input` events, shared the same way as `styles`. */
	inputs?: InputNumbers;
	/** Runs the function refs bound since, once a list made a cell and before it is flushed. */
	settle?: () => void;
}

interface Registration {
	/** The names Lynx sends the event under, each listened to. */
	names: readonly string[];
	handler: number;
	listener: (event: unknown) => void;
	options: ListenerOptions;
}

/** Makes the applier of a page. */
export function createApplier(options: ApplierOptions): Applier {
	const { page, dispatch, openCell, report, scheduleRewrites, written, request, functions } =
		options;
	const elements = new Map<number, LynxElement>([[ROOT_ID, page]]);
	const pageUid = mainThread.__GetElementUniqueID(page);
	const flattening = options.flattening ?? createFlattening();
	const styles = options.styles ?? createCodeStyles();
	const inputs = options.inputs ?? createInputNumbers();
	const lists = createLists({
		pageUid,
		openCell,
		elementOf: (id) => elements.get(id),
		report,
		...(scheduleRewrites && { schedule: scheduleRewrites }),
		...(written && { written }),
		...(request && { request }),
		...(options.settle && { settle: options.settle }),
	});
	const idByUid = new Map<number, number>([[pageUid, ROOT_ID]]);
	const uidById = new Map<number, number>([[ROOT_ID, pageUid]]);
	// Each element's `data-*` attributes, which Lynx takes as one dataset.
	const datasets = new Map<number, Record<string, unknown>>();
	const registrations = new Map<number, Map<string, Registration>>();
	// The elements in the page element, which a reset takes off it.
	const onPage = new Set<number>();
	const animations = createAnimations();

	function get(id: number): LynxElement {
		const element = elements.get(id);
		if (element === undefined) throw mainThreadError({ code: "element_missing", details: { id } });
		return element;
	}

	function removeListener(id: number, slot: string): void {
		const slots = registrations.get(id);
		const registration = slots?.get(slot);
		if (!slots || !registration) return;
		const { names, listener, options } = registration;
		// By index: the main thread's engine pays for each iterator.
		for (let index = 0; index < names.length; index++)
			mainThread.__RemoveEventListener(get(id), names[index]!, listener, options);
		slots.delete(slot);
		if (slots.size === 0) registrations.delete(id);
	}

	function setEvent(id: number, type: LynxEventType, name: string, handler: number): void {
		const slot = `${type}:${name}`;
		if (registrations.get(id)?.get(slot)?.handler === handler) return;
		removeListener(id, slot);
		if (handler === 0) return;
		const registration: Registration = {
			names: sentNames(name),
			handler,
			listener:
				name === "input"
					? (event) => dispatch(handler, event, inputs.heard(get(id), inputValue(event)))
					: (event) => dispatch(handler, event),
			options: LISTENER_OPTIONS[type],
		};
		const names = registration.names;
		for (let index = 0; index < names.length; index++)
			mainThread.__AddEventListener(
				get(id),
				names[index]!,
				registration.listener,
				registration.options,
			);
		let slots = registrations.get(id);
		if (!slots) registrations.set(id, (slots = new Map()));
		slots.set(slot, registration);
	}

	function release(id: number): void {
		const slots = registrations.get(id);
		// oxlint-disable-next-line unicorn/no-useless-spread -- copied: removeListener deletes from slots
		if (slots) for (const slot of [...slots.keys()]) removeListener(id, slot);
		const element = elements.get(id);
		if (element !== undefined) {
			functions.release(element);
			inputs.forget(element);
		}
		datasets.delete(id);
		lists.release(id);
		const uid = uidById.get(id);
		if (uid !== undefined) idByUid.delete(uid);
		uidById.delete(id);
		elements.delete(id);
		onPage.delete(id);
		animations.forget(id);
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
		if (key.startsWith(MAIN_THREAD_PREFIX)) {
			functions.setAttribute(get(id), key, value);
			return;
		}
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
			case "style":
				styles.write(element, value == null ? "" : textOf(value));
				return;
			case "flatten":
				flattening.set(element, value);
				return;
			case "id":
				mainThread.__SetID(element, value == null ? null : textOf(value));
				return;
			case "preload-buffer-count":
				lists.setPreload(id, value);
				mainThread.__SetAttribute(element, key, value);
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
			case OpCode.SetStyles:
				styles.set(get(op[1]), op[2]);
				return;
			case OpCode.Animate: {
				const element = get(op[1]);
				flattening.hold(element);
				mainThread.__ElementAnimate(element, op[2]);
				animations.animated(op[1], op[2]);
				return;
			}
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
		takeRewrites: (max) => lists.takeRewrites(max),
		askCell: (id) => lists.ask(id),
		firstText: (id) => lists.firstText(id),
		isHidden: (id) => lists.isHidden(id),
		hideCell: (id) => lists.hideCell(id),
		resumeWaiting: () => lists.resumeWaiting(),
		waitingCells: (id) => lists.waitingCells(id),
		replaceCell(id, text) {
			const outcome = lists.rewritten(id);
			if (outcome !== "release") return outcome === "keep";
			// The cell's elements, as the text makes them again: the engine cancels their animations.
			for (const op of decodeCell(text)) {
				if (op[0] !== OpCode.Create && op[0] !== OpCode.CreateText) continue;
				const slots = registrations.get(op[1]);
				animations.cancel(op[1], slots?.get("bindEvent:animationcancel")?.listener);
				release(op[1]);
			}
			return true;
		},
		element: (id) => elements.get(id),
		idForUid: (uid) => idByUid.get(uid),
		idOf: (element) => idByUid.get(mainThread.__GetElementUniqueID(element)),
		flattening,
		styles,
		inputs,
		handlerOf: (id, slot) => registrations.get(id)?.get(slot)?.handler,
		heldCells: (id) => lists.heldCells(id),
		listOrder: (id) => lists.orderOf(id),
		forget(id) {
			const element = get(id);
			const taken: TakenElement = { element, dataset: datasets.get(id), list: lists.forget(id) };
			const uid = uidById.get(id);
			if (uid !== undefined) idByUid.delete(uid);
			uidById.delete(id);
			elements.delete(id);
			datasets.delete(id);
			onPage.delete(id);
			return taken;
		},
		adopt(id, taken, { onPage: top, list }) {
			const uid = mainThread.__GetElementUniqueID(taken.element);
			elements.set(id, taken.element);
			idByUid.set(uid, id);
			uidById.set(id, uid);
			if (taken.dataset) datasets.set(id, taken.dataset);
			if (top) onPage.add(id);
			if (taken.list && list) lists.adopt(id, { state: taken.list, ...list });
		},
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
