// The `input` events of a page's inputs and textareas, numbered on the main thread. The background
// answers typing with `setValue` when the component changes what was typed (a mask, upper case),
// and its write says which event it answers. A write that answers an older event than the field's
// latest would put back text the user has typed past, and lose those keys: it is dropped. The
// background cannot tell, since the newer events are still on their way to it.
//
// Lynx answers a write with an `input` event of its own on Android (and for an iOS textarea), with
// the written value: that echo is not typing, and keeps the number it follows.

import type { LynxElement } from "./globals.ts";

/** The numbered `input` events of one page's fields. */
export interface InputNumbers {
	/** The field sent an `input` event with `value`: its number, a new one unless it echoes a write. */
	heard(element: LynxElement, value: unknown): number;
	/** The page wrote `value` to the field with `setValue`. */
	wrote(element: LynxElement, value: unknown): void;
	/** Whether a write that answers the event `answers` is older than the field's latest event. */
	stale(element: LynxElement, answers: number): boolean;
	/** The page let go of the field. */
	forget(element: LynxElement): void;
}

/** The `input` event's value, as Lynx puts it in `detail`. */
export function inputValue(event: unknown): unknown {
	if (typeof event !== "object" || event === null) return undefined;
	const detail: unknown = Reflect.get(event, "detail");
	return typeof detail === "object" && detail !== null ? Reflect.get(detail, "value") : undefined;
}

/** The numbered events of one page's fields. */
export function createInputNumbers(): InputNumbers {
	// A map, emptied as the page lets go of each field: see the wrappers' (./functions/element.ts).
	const fields = new Map<LynxElement, { latest: number; echo: unknown }>();
	return {
		heard(element, value) {
			let field = fields.get(element);
			if (!field) fields.set(element, (field = { latest: 0, echo: undefined }));
			if (field.echo !== undefined && value === field.echo) {
				field.echo = undefined;
				return field.latest;
			}
			field.echo = undefined;
			return ++field.latest;
		},
		wrote(element, value) {
			const field = fields.get(element);
			if (field) field.echo = value;
		},
		stale: (element, answers) => answers < (fields.get(element)?.latest ?? 0),
		forget(element) {
			fields.delete(element);
		},
	};
}
