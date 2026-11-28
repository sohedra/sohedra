// Facts the platform measures or classifies and passes into core calls as plain values.

import type { PlatformTypes } from "./kernel-platform.js";

/** A point in the platform's layout coordinates (web: CSS pixels from the viewport's corner). */
export interface Point {
	readonly x: number;
	readonly y: number;
}

/** A rectangle in the platform's layout coordinates. */
export interface Rect {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/** What a popup is anchored to: an element, a point (the pointer) or a rectangle (a text line). */
export type Anchor<T extends PlatformTypes = PlatformTypes> =
	| { readonly element: T["element"] }
	| { readonly point: Point }
	| { readonly rect: Rect };

/**
 * The event types core interprets, spelled as on the web: core's vocabulary, not a platform's
 * native names. A platform maps its native interactions onto them before it passes one in (a tap
 * that presses a trigger is `click`) and passes `undefined` for an interaction core doesn't
 * interpret.
 *
 * - `click`: a press (a trigger press, or the end of an outside press);
 * - `mousedown`: the start of a press;
 * - `keydown`, `keyup`: a key that presses;
 * - `mouseenter`, `mousemove`: the pointer entering or moving over a trigger (a hover);
 * - `imperative-action`: a change made through a handle, with no native event.
 */
export type InteractionEventType =
	| "click"
	| "mousedown"
	| "keydown"
	| "keyup"
	| "mouseenter"
	| "mousemove"
	| "imperative-action";

/**
 * The pointing device of a pointer interaction, spelled as on the web: core's vocabulary, not a
 * platform's native names. A platform maps its device onto it (a finger is `touch`); `""` is a
 * device it can't tell, which core treats like a mouse where it asks whether one is mouse-like.
 */
export type PointerType = "mouse" | "pen" | "touch" | "";

/** A key press, with W3C `key` values. */
export interface KeyInput {
	readonly key: string;
	readonly shiftKey: boolean;
	readonly ctrlKey: boolean;
	readonly altKey: boolean;
	readonly metaKey: boolean;
	/** Whether an input method is composing text (the key belongs to the composition). */
	readonly composing: boolean;
}

/** One sample of a pointer or touch gesture. `time` is on the scheduler's clock (`now()`). */
export interface GestureSample {
	readonly x: number;
	readonly y: number;
	readonly time: number;
}
