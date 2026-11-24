// The controlled `value` of an `<input>` or a `<textarea>`, as on the web. A Lynx input has no
// `value` attribute: `default-value` gives the first value, the `input` event reports typing in
// `detail.value`, and the `setValue` UI method writes a new value.
//
// - A write skips the value the input already holds, so typing is not echoed back.
// - A setter that changes the typed value (a mask, upper case) is written back with the caret
//   where the typing left it, moved by what the setter added or took away before it: iOS would
//   put it at the end. Such a write says which `input` event it answers, and the main thread drops one that
//   answers an older event than the field's latest, which would put back text typed since.
// - While the keyboard composes, a setter's change is not written, which would break the
//   composition. Lynx sends no event when composition ends, so it is written with the next `input`
//   event that does not compose, or when the field loses focus, whichever comes first.
// - Any other change (a Clear button) is written at once, and applies whatever was typed since, as
//   a web input's value set from code does.

import { backgroundError } from "../catalogue.ts";
import { background } from "../globals.ts";
import { reportError } from "../report.ts";
import type { Handler } from "./handlers.ts";
import type { InputState, TreeNode } from "./node.ts";
import { textOf } from "./values.ts";

/** What the input needs of the renderer. */
export interface InputScope {
	/** Listens to the input's event `name`, beside the component's own listener. */
	listen(element: TreeNode, name: "input" | "blur", handler: Handler): void;
	/** Sets an attribute the way the component would. */
	setAttribute(element: TreeNode, key: string, value: unknown): void;
	/**
	 * Calls `setValue` on the element on the main thread; one that answers typing says which of the
	 * field's `input` events it answers (`answers`), one from code says none.
	 */
	setValue(
		element: TreeNode,
		params: Record<string, unknown>,
		answers: number | undefined,
	): Promise<unknown>;
}

/** Where an `input` event's number rides, on the event the background's handlers get. */
const INPUT_NUMBER = Symbol("input number");

/** Gives `event` the number the main thread gave it. */
export function numberInput(event: object, input: number): void {
	Object.defineProperty(event, INPUT_NUMBER, { value: input });
}

/** Whether a rejection means the page is gone, which needs no report. */
const pageIsGone = (error: unknown): boolean =>
	typeof error === "object" && error !== null && "code" in error && error.code === "page_is_gone";

/**
 * Writes `value` to the field. An answer to typing (`typing`) says which event it answers, with
 * the caret at `cursor` when it is given; a write from code applies whatever was typed since.
 */
function write(
	scope: InputScope,
	element: TreeNode,
	value: string,
	typing?: { cursor: number | undefined },
): void {
	const input = element.input!;
	input.current = value;
	input.skipped = undefined;
	const tag = element.tag ?? "input";
	const params: Record<string, unknown> = { value };
	if (typing?.cursor !== undefined) params["cursor"] = typing.cursor;
	scope.setValue(element, params, typing ? input.answers : undefined).catch((error: unknown) => {
		if (pageIsGone(error)) return;
		reportError(
			backgroundError({
				code: "input_value_not_written",
				details: { tag, reason: error instanceof Error ? error.message : String(error) },
			}),
		);
	});
}

/**
 * Where the caret goes in `value`, the setter's answer to typing that left `typed` with the caret
 * at `at`, after what the user typed. It stays put when all the setter changed lies after it, and
 * else keeps its distance from the end, so it moves past what the setter added at the caret or
 * before it.
 */
function caret(typed: string, at: number, value: string): number {
	const shortest = Math.min(typed.length, value.length);
	let same = 0;
	while (same < shortest && typed[same] === value[same]) same++;
	if (at < same) return at;
	const moved = at + value.length - typed.length;
	return Math.max(0, Math.min(value.length, moved));
}

/** Writes a setter's change that composition held back, unless the field holds it already. */
function writeSkipped(scope: InputScope, element: TreeNode): void {
	const input = element.input!;
	const skipped = input.skipped;
	input.skipped = undefined;
	if (skipped !== undefined && skipped !== input.current)
		write(scope, element, skipped, { cursor: undefined });
}

/** Starts the state of a field's value, and listens to its typing. */
function startInput(scope: InputScope, element: TreeNode, value: string): InputState {
	const state: InputState = {
		current: value,
		composing: false,
		typing: false,
		answers: 0,
		typed: value,
		selection: -1,
		skipped: undefined,
		blurs: false,
	};
	scope.listen(element, "input", (event) => {
		// Boundary: Lynx's input event, read by field.
		const detail = (
			event as {
				detail?: { value?: unknown; isComposing?: unknown; selectionEnd?: unknown };
			}
		).detail;
		state.composing = detail?.isComposing === true;
		state.current = typeof detail?.value === "string" ? detail.value : "";
		state.typed = state.current;
		state.selection = typeof detail?.selectionEnd === "number" ? detail.selectionEnd : -1;
		const number: unknown = Reflect.get(event as object, INPUT_NUMBER);
		if (typeof number === "number") state.answers = number;
		state.typing = true;
		// The update the component's own handler makes runs before this microtask: the page
		// flushes Svelte's updates right after an event's handlers.
		background.lynx.queueMicrotask(() => {
			state.typing = false;
			if (!state.composing) writeSkipped(scope, element);
		});
	});
	return state;
}

/** Sets the `value` of `element`, an input or a textarea. */
export function setInputValue(scope: InputScope, element: TreeNode, raw: unknown): void {
	const value = raw == null ? "" : textOf(raw);
	const input = element.input;
	if (!input) {
		element.input = startInput(scope, element, value);
		// An input that has no Lynx element yet starts from `default-value`, which it is made with.
		if (element.lynxId === 0) scope.setAttribute(element, "default-value", value);
		else write(scope, element, value);
		return;
	}
	if (value === input.current) {
		input.skipped = undefined;
		return;
	}
	if (input.typing && input.composing) {
		input.skipped = value;
		if (!input.blurs) {
			input.blurs = true;
			scope.listen(element, "blur", () => {
				input.composing = false;
				writeSkipped(scope, element);
			});
		}
		return;
	}
	input.composing = false;
	if (element.lynxId === 0) {
		input.current = value;
		scope.setAttribute(element, "default-value", value);
		return;
	}
	// An answer to typing keeps the caret where the typing left it.
	if (!input.typing) {
		write(scope, element, value);
		return;
	}
	const cursor = input.selection >= 0 ? caret(input.typed, input.selection, value) : undefined;
	write(scope, element, value, { cursor });
}
