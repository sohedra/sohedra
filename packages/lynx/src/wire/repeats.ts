// Repeats of one error, counted on either thread: a main-thread function can throw on every frame
// of a gesture, and an effect on every change. The first of an error is reported, then the 10th,
// the 100th and so on, each with how many there have been, so Lynx shows a few entries that count
// rather than one per throw.

/** How many different errors a page counts before it starts counting from none again. */
const KEPT = 100;

/** What tells two errors apart: the message, and the first line of the stack that is not it. */
function keyOf(error: Error): string {
	const frame = error.stack?.split("\n").find((line) => /^\s+at\s|@/.test(line)) ?? "";
	return `${error.name}\n${error.message}\n${frame.trim()}`;
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
	 * or a power of ten, and `undefined` when it is only counted.
	 */
	count(error: Error): number | undefined;
	/** Forgets every count: the page starts again. */
	clear(): void;
}

/** Counts the repeats of errors. */
export function createRepeats(): Repeats {
	const counts = new Map<string, number>();
	return {
		count(error) {
			const key = keyOf(error);
			if (!counts.has(key) && counts.size >= KEPT) counts.clear();
			const count = (counts.get(key) ?? 0) + 1;
			counts.set(key, count);
			return reportedAt(count) ? count : undefined;
		},
		clear() {
			counts.clear();
		},
	};
}

/**
 * `error` as its repeat is reported: the count ends its first line ("(×10)"), the line LogBox and
 * logcat show. The first report is the error itself. Its name, stack and code are kept.
 */
export function withCount(error: Error, count: number): Error {
	if (count === 1) return error;
	const [first = "", ...rest] = error.message.split("\n");
	const counted = new Error([`${first} (×${count})`, ...rest].join("\n"));
	counted.name = error.name;
	if (error.stack !== undefined) counted.stack = error.stack;
	const code = (error as { code?: unknown }).code;
	if (code !== undefined) Object.assign(counted, { code });
	return counted;
}
