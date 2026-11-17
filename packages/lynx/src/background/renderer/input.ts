// The controlled `value` of an `<input>` or a `<textarea>`, as on the web. A Lynx input has no
// `value` attribute: `default-value` gives the first value, the `input` event reports typing in
// `detail.value`, and the `setValue` UI method writes a new value.
//
// A write skips the value the input already holds, so typing is not echoed back. A setter that
// changes the typed value (say, to upper case) is not written back while the keyboard composes,
// which would break the composition; any other change (a Clear button) is written at once.

import { backgroundError } from "../catalogue.ts";
import { background } from "../globals.ts";
import { reportError } from "../report.ts";
import type { Handler } from "./handlers.ts";
import type { InputState, TreeNode } from "./node.ts";
import { textOf } from "./values.ts";

/** What the input needs of the renderer. */
export interface InputHost {
	/** Listens to the input's `input` event, beside the component's own listener. */
	listen(element: TreeNode, handler: Handler): void;
	/** Sets an attribute the way the component would. */
	setAttribute(element: TreeNode, key: string, value: unknown): void;
	/** Calls a UI method of the element on the main thread. */
	invoke(element: TreeNode, method: string, params: Record<string, unknown>): Promise<unknown>;
}

/** Whether a rejection means the page is gone, which needs no report. */
const pageIsGone = (error: unknown): boolean =>
	typeof error === "object" && error !== null && "code" in error && error.code === "page_is_gone";

/** Sets the `value` of `element`, an input or a textarea. */
export function setInputValue(host: InputHost, element: TreeNode, raw: unknown): void {
	const value = raw == null ? "" : textOf(raw);
	let input = element.input;
	if (!input) {
		const state: InputState = { current: value, composing: false, typing: false };
		input = element.input = state;
		host.listen(element, (event) => {
			// Boundary: Lynx's input event, read by field.
			const detail = (event as { detail?: { value?: unknown; isComposing?: unknown } }).detail;
			state.composing = detail?.isComposing === true;
			state.current = typeof detail?.value === "string" ? detail.value : "";
			state.typing = true;
			// The update the component's own handler makes runs before this microtask: the page
			// flushes Svelte's updates right after an event's handlers.
			background.lynx.queueMicrotask(() => {
				state.typing = false;
			});
		});
	} else {
		if (value === input.current) return;
		if (input.typing && input.composing) return;
		input.current = value;
		input.composing = false;
	}
	// An input that has no Lynx element yet starts from `default-value`, which it is made with.
	if (element.lynxId === 0) {
		host.setAttribute(element, "default-value", value);
		return;
	}
	const tag = element.tag ?? "input";
	host.invoke(element, "setValue", { value }).catch((error: unknown) => {
		if (pageIsGone(error)) return;
		reportError(
			backgroundError({
				code: "input_value_not_written",
				details: { tag, reason: error instanceof Error ? error.message : String(error) },
			}),
		);
	});
}
