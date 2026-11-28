function isPlainObject(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype
	);
}

function shallowEqual(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) {
		return true;
	}
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
	}
	if (isPlainObject(a) && isPlainObject(b)) {
		const keys = Object.keys(a);
		return keys.length === Object.keys(b).length && keys.every((key) => Object.is(a[key], b[key]));
	}
	return false;
}

/**
 * For `$derived.by`: returns the previous value while the next one is shallowly equal, so an
 * inline object or array re-created by the parent doesn't re-run what reads the derived.
 */
export function keepShallowEqual<T>(get: () => T): () => T {
	let previous: { value: T } | undefined;
	return () => {
		const next = get();
		if (previous && shallowEqual(previous.value, next)) {
			return previous.value;
		}
		previous = { value: next };
		return next;
	};
}
