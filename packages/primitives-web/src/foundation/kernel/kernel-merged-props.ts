import type { ClassValue } from "svelte/elements";

import { makeEventPreventable } from "./kernel-event.js";

/**
 * Props as Sohedra merges them: string keys, plus symbol keys for attachments. `class` and
 * `style` are the two keys the merge treats on their own, so they carry their types.
 */
export type Props = Record<PropertyKey, unknown> & {
	class?: ClassValue | undefined;
	style?: string | undefined;
};

/** A props object, or a function of the props merged so far (left to right) returning new ones. */
export type PropsInput = Props | ((merged: Props) => Props) | undefined;

type Handler = (...args: unknown[]) => unknown;

/**
 * Merges props with Svelte's names:
 * - the rightmost plain prop wins;
 * - `on*` handlers (lowercase, as Svelte names them) are chained, rightmost first, and the
 *   rightmost can skip the ones to its left with `event.preventSohedraHandler()`;
 * - `class` becomes `[theirs, ours]` (Svelte resolves class arrays), and `style` strings are
 *   joined so the rightmost declaration wins;
 * - attachments (symbol keys) from every source are kept;
 * - a function source receives the props merged so far and its result replaces them; it chains
 *   handlers itself if it needs to.
 */
export function mergeProps(...props: PropsInput[]): Props {
	return mergePropsN(props);
}

/** {@link mergeProps} over an array of sources. */
export function mergePropsN(props: readonly PropsInput[]): Props {
	if (props.length === 0) {
		return {};
	}
	let merged = createInitialMergedProps(props[0]);
	for (let i = 1; i < props.length; i += 1) {
		merged = mergeInto(merged, props[i]);
	}
	return merged;
}

function createInitialMergedProps(input: PropsInput): Props {
	if (typeof input === "function") {
		// Getter-returned handlers intentionally keep their existing semantics.
		return { ...input({}) };
	}
	const copied: Props = { ...input };
	for (const key in copied) {
		const value = copied[key];
		if (isEventHandler(key, value)) {
			copied[key] = wrapEventHandler(value);
		}
	}
	return copied;
}

function mergeInto(merged: Props, input: PropsInput): Props {
	if (typeof input === "function") {
		return input(merged);
	}
	if (!input) {
		return merged;
	}
	for (const key in input) {
		const value = input[key];
		switch (key) {
			case "style":
				merged.style = mergeStyles(merged.style, input.style);
				break;
			case "class":
				merged.class = mergeClasses(merged.class, input.class);
				break;
			default:
				merged[key] = isEventHandler(key, value) ? mergeEventHandlers(merged[key], value) : value;
		}
	}
	for (const key of Object.getOwnPropertySymbols(input)) {
		merged[key] = input[key];
	}
	return merged;
}

function isEventHandler(key: string, value: unknown): value is Handler | undefined {
	const code2 = key.charCodeAt(2);
	return (
		key.charCodeAt(0) === 111 /* o */ &&
		key.charCodeAt(1) === 110 /* n */ &&
		code2 >= 97 /* a */ &&
		code2 <= 122 /* z */ &&
		(typeof value === "function" || value === undefined)
	);
}

function mergeEventHandlers(ours: unknown, theirs: Handler | undefined) {
	if (!theirs) {
		return ours;
	}
	if (typeof ours !== "function") {
		return wrapEventHandler(theirs);
	}
	return (...args: unknown[]) => {
		const event = args[0];
		if (isEvent(event)) {
			const preventable = makeEventPreventable(event);
			const result = theirs(...args);
			if (!preventable.sohedraHandlerPrevented) {
				ours(...args);
			}
			return result;
		}
		const result = theirs(...args);
		ours(...args);
		return result;
	};
}

function wrapEventHandler(handler: Handler | undefined) {
	if (!handler) {
		return handler;
	}
	return (...args: unknown[]) => {
		const event = args[0];
		if (isEvent(event)) {
			makeEventPreventable(event);
		}
		return handler(...args);
	};
}

/** `class` merged as `[theirs, ours]`, dropping an undefined side. */
export function mergeClasses(ours: ClassValue | undefined, theirs: ClassValue | undefined) {
	if (theirs === undefined || theirs === null || theirs === "") {
		return ours;
	}
	if (ours === undefined || ours === null || ours === "") {
		return theirs;
	}
	return [theirs, ours];
}

/** `style` strings joined so the rightmost (theirs) declarations win. */
export function mergeStyles(ours: string | undefined, theirs: string | undefined) {
	if (!theirs) {
		return ours;
	}
	if (!ours) {
		return theirs;
	}
	return `${ours.trim().replace(/;$/, "")}; ${theirs}`;
}

function isEvent(value: unknown): value is Event {
	return typeof Event !== "undefined" && value instanceof Event;
}
