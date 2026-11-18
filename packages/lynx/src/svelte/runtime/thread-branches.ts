// A branch of `{#if background}` (or `{#if mainThread}`) that only one thread renders. The compile
// step wraps each such branch that renders a component or a snippet in `ThreadBranch`, on both
// threads, so the components it renders as it is drawn take their `$props.id()` from the branch's
// own sequence: `lynx-b1`, `lynx-b2`… for the background's, `lynx-m1`… for the main thread's. The
// ids of every other component are then the same on both threads, in the same order, and the first
// frame's ids are the background's.

import { PROPS_ID_PREFIX } from "../../wire/index.ts";

/** The thread a branch is for. */
export type BranchThread = "background" | "main-thread";

/** The letter of each thread's branch sequence. */
const LETTERS = { background: "b", "main-thread": "m" } as const;

/** How many ids each branch sequence has given, on one page or in one render. */
export type BranchCounts = Record<"b" | "m", number>;

/** The sequences of the branches being drawn, innermost last. */
const drawing: ("b" | "m")[] = [];

/** What the compile step passes: the thread the branch is for, and the branch as a snippet. */
export interface ThreadBranchProps<Target> {
	thread: BranchThread;
	render: (target: Target) => void;
}

/**
 * Draws a branch only `thread` renders. It is called as a component is, with the anchor
 * (background) or the server's renderer (main thread) and its props, and draws the branch there at
 * once; a component the branch renders calls `$props.id()` as it starts.
 */
export function ThreadBranch<Target>(target: Target, props: ThreadBranchProps<Target>): void {
	drawing.push(LETTERS[props.thread]);
	try {
		props.render(target);
	} finally {
		drawing.pop();
	}
}

/** Whether a branch only one thread renders is being drawn. */
export const inThreadBranch = (): boolean => drawing.length > 0;

/** Counts that start each sequence from the first. */
export function newBranchCounts(): BranchCounts {
	return { b: 0, m: 0 };
}

/**
 * The next id of the branch being drawn, counted in `counts`; `undefined` outside every branch, where
 * the id is the page's own.
 */
export function branchId(counts: BranchCounts): string | undefined {
	const letter = drawing[drawing.length - 1];
	if (letter === undefined) return undefined;
	counts[letter] += 1;
	return `${PROPS_ID_PREFIX}-${letter}${counts[letter]}`;
}
