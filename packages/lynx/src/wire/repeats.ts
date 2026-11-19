// Repeats of one error, counted on either thread: a main-thread function can throw on every frame
// of a gesture, and an effect on every change. The first of an error is reported, then the 10th,
// the 100th and so on, each with how many there have been, so Lynx shows a few entries that count
// rather than one per throw. An error quiet for a while is reported as new: a retry shows in LogBox.

import { thrownText } from "./patch.ts";

/** How many different errors a page counts before it starts counting from none again. */
const KEPT = 100;
/**
 * How long an error is quiet before it counts from none, in milliseconds: well past the gaps of an
 * error that comes every frame or every change, and about the time it takes to read LogBox and try
 * again.
 */
const QUIET = 5000;

/** A field of an error as text: an error's fields are whatever the code that made it set. */
const textOf = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * What tells two errors apart: the name, the message and the whole stack. A function that throws
 * every frame has the same stack each time; two callers of one helper do not.
 */
function keyOf(error: Error): string {
	return `${textOf(error.name)}\n${textOf(error.message)}\n${textOf(error.stack)}`;
}

/** Whether `count` is one of the counts that are reported: 1, 10, 100… */
const reportedAt = (count: number): boolean => {
	let at = 1;
	while (at < count) at *= 10;
	return at === count;
};

/** The repeats of errors on one thread, for one page. */
export interface Repeats {
	/**
	 * Counts `error`: answers how many times it has come when this one is to be reported, the first
	 * or a power of ten, and `undefined` when it is only counted. One that comes after five quiet
	 * seconds is the first again.
	 */
	count(error: Error): number | undefined;
	/** Forgets every count: the page starts again. */
	clear(): void;
}

/** Counts the repeats of errors, on the thread's clock. */
export function createRepeats(): Repeats {
	const counts = new Map<string, { count: number; last: number }>();
	return {
		count(error) {
			const key = keyOf(error);
			const now = Date.now();
			if (!counts.has(key) && counts.size >= KEPT) counts.clear();
			const seen = counts.get(key);
			const count = seen && now - seen.last < QUIET ? seen.count + 1 : 1;
			counts.set(key, { count, last: now });
			return reportedAt(count) ? count : undefined;
		},
		clear() {
			counts.clear();
		},
	};
}

/**
 * `error` as its repeat is reported: the count ends its first line ("(×10)"), the line LogBox and
 * logcat show. The first report is the error itself. Its name, stack, code and cause are kept.
 */
export function withCount(error: Error, count: number): Error {
	if (count === 1) return error;
	const [first = "", ...rest] = thrownText(error.message).split("\n");
	const counted = new Error([`${first} (×${count})`, ...rest].join("\n"));
	counted.name = textOf(error.name) || "Error";
	if (error.stack !== undefined) counted.stack = error.stack;
	const { code, cause } = error as { code?: unknown; cause?: unknown };
	if (code !== undefined) Object.assign(counted, { code });
	if (cause !== undefined) Object.assign(counted, { cause });
	return counted;
}
