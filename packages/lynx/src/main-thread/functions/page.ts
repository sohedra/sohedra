// Main-thread functions on one page of the main thread: what its elements' `main-thread:`
// attributes bind (./bindings.ts), its refs, the wrappers of its elements, the contexts it holds
// for the background, and the calls between its functions and the background. Everything here is
// the page's: a page that reloads starts a new one, and the old one, silenced, only lets go.
// Only the registered bodies outlive a page (../globals.ts).
//
// The settle step runs the function refs bound since it last ran, each once its element is in the
// tree and before the flush that shows it: at a patch's end, before a call of the patch, inside a
// list's making of a cell, as the first frame is drawn and at hydration.

import { isMainThreadFunction, RUN_FUNCTION } from "../../wire/index.ts";
import type { Result, ToBackground } from "../../wire/index.ts";
import { mainThreadError } from "../catalogue.ts";
import type { CodeStyles } from "../code-styles.ts";
import type { Flattening } from "../flatten.ts";
import { DEV } from "../globals.ts";
import type { LynxElement } from "../globals.ts";
import { createBackgroundCalls, handled } from "./background-calls.ts";
import type { HeldCall } from "./background-calls.ts";
import { Entry, slotOf } from "./bindings.ts";
import type { Binding, BindingScope } from "./bindings.ts";
import { createElements } from "./element.ts";
import { carry } from "./hydrate.ts";
import { createLifetimes } from "./lifetimes.ts";
import { createLoopGuard } from "./loop-guard.ts";
import { createRefs } from "./refs.ts";
import { contextsOf, holdValue, made, prepare, runAs } from "./run.ts";
import type { Ready } from "./run.ts";

/** An element hydration kept, with the background's `main-thread:` attributes for it. */
export interface HydratedElement {
	element: LynxElement;
	values: [name: string, value: unknown][];
}

/** The main-thread functions of one page. */
export interface FunctionsPage {
	/** A `main-thread:` attribute of an element is set: bound, changed, or with none, released. */
	setAttribute(element: LynxElement, name: string, value: unknown): void;
	/** The page lets go of an element: its bindings are released, and its wrapper forgotten. */
	release(element: LynxElement): void;
	/** Runs the function refs bound since, in order, each on its own. */
	settle(): void;
	/**
	 * Runs `run` as part of a change the page flushes after: what functions change then waits for
	 * that flush, and their UI methods for its layout. `drain` runs after the outermost.
	 */
	applying(run: () => void, drain?: () => void): void;
	/** A patch's `runOnMainThread` call: runs the function now, and returns what it returned. */
	run(fn: unknown, params: unknown[]): unknown;
	/** The background let go of these refs. */
	unref(ids: readonly number[]): void;
	/** The background answered a call of a background function. */
	reply(id: number, result: Result): void;
	/** `runOnBackground(handle)(...params)` from a main-thread function. */
	runOnBackground(handle: unknown, params: unknown[]): Promise<unknown>;
	/** `runOnMainThread(fn)(...params)` from a main-thread function: it runs now. */
	runOnMainThread(fn: unknown, params: unknown[]): Promise<unknown>;
	/** The engine runs a main-thread function (`runWorklet`). */
	runWorklet(value: unknown, params: unknown, options: unknown): unknown;
	/** The first frame's log, where its calls of background functions wait for hydration. */
	holdFirstFrame(log: unknown[]): void;
	/**
	 * Hydration, before anything is bound: what the first frame's values on the elements it keeps
	 * left goes into the background's, which take their place.
	 */
	carry(elements: HydratedElement[]): void;
	/**
	 * Hydration, once the elements are the page's: the background's values take over from the first
	 * frame's. What the first frame bound that the background does not goes, and the function refs
	 * that changed run.
	 */
	adopt(elements: HydratedElement[]): void;
	/** Whether the page bound anything on the element. */
	binds(element: LynxElement): boolean;
	/**
	 * The first frame's log is replayed, once hydration adopted it, or hydration could not: calls
	 * from then on go at once, and those held for a first-frame function no background function
	 * took over reject.
	 */
	endFirstFrame(adopted: boolean): void;
	/** A call the first frame held, now that hydration named its function, or could not. */
	sendHeld(held: HeldCall): void;
	/** The page let go of text that held these contexts, unread. */
	dropUnread(ids: readonly number[]): void;
	/** The page reloads or ends: its functions run no more, and its calls reject. */
	silence(): void;
	/** What the page holds, for tests. */
	sizes(): { elements: number; bindings: number; refs: number; contexts: number[] };
	/** Whether the ref `id` holds `element`, for tests. */
	refHolds(id: number, element: LynxElement): boolean;
}

/** What a page's functions are made with. */
export interface FunctionsPageOptions {
	styles: CodeStyles;
	flattening: Flattening;
	/** Sends a message to the background, stamped with this page. */
	send(message: ToBackground): void;
	report(error: unknown): void;
	/** Flushes the page's tree: what functions change outside a patch. */
	flush(): void;
	/** Runs a UI method after the patch being applied is flushed and laid out. */
	afterLayout(run: () => void): void;
	/** Runs `callback` at the end of the task. */
	soon(callback: () => void): void;
	/** Runs `callback` at the main thread's next turn; false when the engine cannot. */
	nextTurn(callback: () => void): boolean;
	/** The background's id of an engine element, while the page shows it. */
	idOf(element: LynxElement): number | undefined;
}

/** The main-thread functions of a page. */
export function createFunctionsPage(options: FunctionsPageOptions): FunctionsPage {
	const { styles, flattening, send, report, flush, afterLayout, soon, nextTurn, idOf } = options;
	const guard = DEV ? createLoopGuard({ report, nextTurn }) : undefined;
	const refs = createRefs();
	const lifetimes = createLifetimes({
		release: (contexts) => send({ t: "release", contexts }),
		soon,
	});
	const store = new Map<LynxElement, Map<string, Binding>>();
	const calls = createBackgroundCalls({ send, report, lifetimes, soon });
	let pending: { binding: Binding; value: unknown }[] = [];
	let silenced = false;
	let depth = 0;
	let flushing = false;
	const reportedNames = new Set<string>();

	const elements = createElements({
		styles,
		flattening,
		idOf,
		report,
		changed(what, detail) {
			if (DEV) guard?.changed(what, detail);
			if (depth > 0 || flushing) return;
			flushing = true;
			soon(() => {
				flushing = false;
				if (silenced || (DEV && guard?.flush() === false)) return;
				flush();
			});
		},
		invoke(run) {
			if (depth > 0) afterLayout(run);
			else run();
		},
	});

	const scope: BindingScope = {
		refs,
		elements,
		flattening,
		silenced: () => silenced,
		queue(binding) {
			pending.push({ binding, value: binding.value });
		},
		guarded(run) {
			try {
				run();
			} catch (error) {
				report(error);
			}
		},
		ran(id) {
			if (DEV) guard?.ran(id, undefined);
		},
	};

	function applying(run: () => void, drain?: () => void): void {
		depth++;
		try {
			run();
		} finally {
			depth--;
			if (depth === 0) drain?.();
		}
	}

	function settle(): void {
		if (pending.length === 0) return;
		applying(() => {
			while (pending.length > 0) {
				const due = pending;
				pending = [];
				for (const { binding, value } of due) {
					if (binding.released || binding.value !== value) continue;
					scope.guarded(() => binding.kind.settle?.(binding, scope));
				}
			}
		});
	}

	function setAttribute(element: LynxElement, name: string, value: unknown): void {
		const slot = slotOf(name);
		if (!slot) {
			// It binds nothing: the background lets go of what it gave the value.
			lifetimes.dropUnread(contextsOf(value));
			if (!reportedNames.has(name)) {
				reportedNames.add(name);
				report(mainThreadError({ code: "main_thread_attribute_unknown", details: { name } }));
			}
			return;
		}
		let bindings = store.get(element);
		const binding = bindings?.get(slot.key);
		if (typeof value !== "object" || value === null) {
			if (!binding) return;
			bindings!.delete(slot.key);
			if (bindings!.size === 0) store.delete(element);
			slot.kind.release(binding, scope);
			return;
		}
		holdValue(value, lifetimes);
		if (binding) {
			slot.kind.change(binding, value, scope);
			return;
		}
		if (!bindings) store.set(element, (bindings = new Map()));
		const made: Binding = {
			element,
			kind: slot.kind,
			value,
			...(slot.event && { event: slot.event }),
		};
		bindings.set(slot.key, made);
		slot.kind.bind(made, scope);
	}

	/** The function `fn` given to a call, ready: a function the body made, or one that came. */
	function readyOf(fn: unknown): Ready {
		if (typeof fn === "function") return fn as Ready;
		if (!isMainThreadFunction(fn))
			throw mainThreadError({
				code: "main_thread_function_not_found",
				details: { id: String(fn) },
			});
		holdValue(fn, lifetimes);
		return prepare(fn, scope);
	}

	return {
		setAttribute,
		release(element) {
			const bindings = store.get(element);
			if (bindings) {
				store.delete(element);
				for (const binding of bindings.values())
					scope.guarded(() => binding.kind.release(binding, scope));
			}
			elements.forget(element);
		},
		settle,
		applying,
		run(fn, params) {
			holdValue(params, lifetimes);
			const ready = readyOf(fn);
			// What the patch bound before the call is there for it.
			settle();
			let returned: unknown;
			applying(() => {
				returned = ready(...(made(params, scope, 0) as unknown[]));
			});
			return returned;
		},
		unref(ids) {
			refs.drop(ids);
		},
		reply: calls.reply,
		runOnBackground: calls.runOnBackground,
		runOnMainThread(fn, params) {
			try {
				return handled(Promise.resolve(readyOf(fn)(...(made(params, scope, 0) as unknown[]))));
			} catch (error) {
				report(error);
				return handled(Promise.reject(error));
			}
		},
		runWorklet(value, params, options) {
			let ready: Ready | undefined;
			if (value instanceof Entry) ready = value.ready();
			else if (isMainThreadFunction(value)) ready = silenced ? undefined : readyOf(value);
			else if (DEV && !reportedNames.has(RUN_FUNCTION)) {
				reportedNames.add(RUN_FUNCTION);
				report(mainThreadError({ code: "main_thread_value_not_runnable", details: {} }));
			}
			if (!ready) return undefined;
			const source =
				typeof options === "object" && options !== null
					? (Reflect.get(options, "source") as number | undefined)
					: undefined;
			const list = Array.isArray(params) ? params : [];
			if (DEV && value instanceof Entry) {
				const event: unknown = list[0];
				const type =
					typeof event === "object" && event !== null ? Reflect.get(event, "type") : undefined;
				guard?.ran(value.fn._wkltId, typeof type === "string" ? type : undefined);
			}
			return runAs(ready, {
				params: source === undefined ? (made(list, scope, 0) as unknown[]) : list,
				source,
				elements,
				manager: value instanceof Entry ? value.manager : undefined,
			});
		},
		holdFirstFrame: calls.holdFirstFrame,
		binds: (element) => store.has(element),
		carry(kept) {
			const carryScope = { refs, lifetimes };
			for (const { element, values } of kept) {
				const bindings = store.get(element);
				if (!bindings) continue;
				for (const [name, value] of values) {
					const slot = slotOf(name);
					const binding = slot && bindings.get(slot.key);
					if (binding) carry(value, binding.value, carryScope);
				}
			}
		},
		adopt(kept) {
			for (const { element, values } of kept) {
				const bindings = store.get(element);
				const given = new Set<string>();
				for (const [name, value] of values) {
					const slot = slotOf(name);
					if (!slot) continue;
					given.add(slot.key);
					const binding = bindings?.get(slot.key);
					if (!binding || typeof value !== "object" || value === null) {
						setAttribute(element, name, value);
						continue;
					}
					holdValue(value, lifetimes);
					slot.kind.carry(binding, value, scope);
				}
				// What the first frame bound and the background does not have goes.
				if (bindings)
					for (const [key, binding] of bindings)
						if (!given.has(key)) {
							bindings.delete(key);
							scope.guarded(() => binding.kind.release(binding, scope));
						}
				if (bindings?.size === 0) store.delete(element);
			}
			settle();
		},
		endFirstFrame: calls.endFirstFrame,
		sendHeld: calls.sendHeld,
		dropUnread(ids) {
			lifetimes.dropUnread(ids);
		},
		silence() {
			silenced = true;
			lifetimes.end();
			pending = [];
			calls.silence();
		},
		sizes() {
			let bindings = 0;
			for (const slots of store.values()) bindings += slots.size;
			return { elements: elements.size, bindings, refs: refs.size, contexts: lifetimes.held() };
		},
		refHolds(id, element) {
			const current = refs.find(id)?.current;
			return current !== undefined && current === elements.find(element);
		},
	};
}
