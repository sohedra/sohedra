// Which branch each of Svelte's blocks took, as a page starts: hydration pairs the first frame's
// blocks with the background's by it. Svelte's compiler numbers every branch of every `{#if}` on
// both threads; its server writes the number into the first frame's markup (`<!--[0-->`,
// `<!--[-1-->` for none), and its client passes it to `$.if` and keeps it to itself. This `$.if`
// is Svelte's own, and while a recorder is set it tells the recorder the number, the anchor and
// where the branch's nodes start.
//
// The compile step adds blocks of its own, and says what each is from inside the block's test,
// which runs inside the call:
//   - a block only the background's copy has, which is not recorded (`ownBranch`, and the count of
//     a list's initial rows);
//   - the second state of a block (a list's `{:else}`, an `{#await}` given a value, a boundary's
//     `pending`), wrapped in the background's copy, as the first frame's `<!--[!-->` is
//     (`secondState`);
//   - the place of an `{#await}` given a promise, whose branch the background draws after the page
//     started: an empty block after it (`awaitPlace`), told by `awaitGiven` what the `{#await}`
//     was given. A block's first run is synchronous, in template order, so each `{#await}`'s
//     answer is taken by the block after it, the innermost first.

// @ts-expect-error -- Svelte publishes no types for its internal modules; the cast below gives this one's.
import { if as svelteIf } from "svelte/internal/client";

import { BranchKey } from "../../wire/index.ts";

/** Draws a branch: its render function and its number; none is the first branch, 0. */
type Render = (branch: unknown, key?: number | false) => void;
type IfBlock = (anchor: unknown, fn: (render: Render) => void, elseif?: boolean) => void;

// Boundary: Svelte's function, typed by what it does.
const svelteIfBlock = svelteIf as IfBlock;

/** Who hears which branch each block took, while a page starts. */
export interface BranchRecorder {
	/** A branch is about to render before `anchor`: what to find its first node from, after. */
	start(anchor: unknown): unknown;
	/** The block at `anchor` took the branch `key`; its nodes come after `started`. */
	taken(anchor: unknown, key: number, started: unknown): void;
}

let recorder: BranchRecorder | null = null;

/**
 * What the compile step's hook said of the block whose test it is: null, a block it added to one
 * copy, which is not recorded; a number, the key to record in place of Svelte's; undefined, none.
 */
let said: number | null | undefined;

/** Whether each `{#await}` was given a promise, innermost last, until the block after it takes it. */
const awaits: boolean[] = [];

/** A page starts (a recorder) or has rendered (null). */
export function recordBranches(given: BranchRecorder | null): void {
	recorder = given;
	said = undefined;
	awaits.length = 0;
}

/** `$.if`: Svelte's, telling the recorder, while one is set, which branch it took. */
export function ifBlock(anchor: unknown, fn: (render: Render) => void, elseif?: boolean): void {
	svelteIfBlock(
		anchor,
		(render) => {
			const record = recorder;
			if (record === null) {
				fn(render);
				return;
			}
			said = undefined;
			let key = -1;
			let started: unknown = anchor;
			let mark: number | null | undefined;
			let rendered = false;
			fn((branch, number) => {
				// The test ran: its hook, if it has one, has spoken.
				mark = said;
				said = undefined;
				rendered = true;
				started = record.start(anchor);
				render(branch, number);
				// None is the first branch, as Svelte's own default.
				key = number === undefined ? 0 : number === false ? -1 : number;
			});
			if (!rendered) {
				mark = said;
				said = undefined;
			}
			if (mark !== null) record.taken(anchor, mark ?? key, started);
		},
		elseif,
	);
}

/** Says that the block whose test calls it is one the compile step added to the background's copy. */
export function sayOwn(): void {
	said = null;
}

/** The test of an `{#if}` the compile step adds to the background's copy alone: true. */
export function ownBranch(): true {
	sayOwn();
	return true;
}

/** The test of the `{#if}` the compile step puts around a block's second state: true. */
export function secondState(): true {
	said = BranchKey.Second;
	return true;
}

/** What an `{#await}` is given, passed through; while a page starts, whether it is a promise. */
export function awaitGiven<T>(value: T): T {
	if (recorder !== null)
		awaits.push(typeof (value as { then?: unknown } | null)?.then === "function");
	return value;
}

/**
 * The test of the empty `{#if}` the compile step puts after an `{#await}`: false. Recorded only when
 * the `{#await}` was given a promise, as the place of the branch it draws later.
 */
export function awaitPlace(): false {
	said = recorder !== null && awaits.pop() === true ? BranchKey.Await : null;
	return false;
}
