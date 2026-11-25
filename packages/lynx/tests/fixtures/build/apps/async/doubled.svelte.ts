// A `$derived` of an awaited promise in a rune module, which compiles only in async mode.

/** A value that follows `count()`, doubled once a promise settles. */
export async function doubling(count: () => number): Promise<{ readonly value: number }> {
	const value = $derived(await Promise.resolve(count() * 2));
	return {
		get value() {
			return value;
		},
	};
}
