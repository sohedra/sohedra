// What the background keeps of the page it runs: its generation, and what other modules let go
// of when the page ends.
//
// The generation is the page that the content made now belongs to (src/wire/page.ts). It starts
// at 0 and is bumped synchronously, first thing, when the app reloads and when the page is
// destroyed, before any teardown: what the old page's teardown sends is then stamped with a page
// the main thread no longer shows, or not sent at all.

let generation = 0;

/** The page the content made now belongs to. */
export function currentPage(): number {
	return generation;
}

/** A page starts, as the first of its runtime: a runtime that ran one before starts it clean. */
export function startGeneration(): void {
	generation = 0;
}

/** The page reloads or is destroyed: a new generation starts. */
export function bumpPage(): void {
	generation++;
}

const clears: (() => void)[] = [];

/** Runs `clear` when the running page is destroyed, once. */
export function onPageDestroy(clear: () => void): void {
	clears.push(clear);
}

/** The page is destroyed: runs what was registered, in order, and forgets it. */
export function clearPageState(): void {
	runAll(clears.splice(0));
}

/**
 * Runs every step, in order, though one throws; then throws the first error. The others are not
 * thrown: the first is the cause, and the rest may follow from it.
 */
export function runAll(steps: readonly (() => void)[]): void {
	let failed = false;
	let first: unknown;
	for (const step of steps) {
		try {
			step();
		} catch (error) {
			if (!failed) {
				failed = true;
				first = error;
			}
		}
	}
	if (failed) throw first;
}
