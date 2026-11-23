// How a fill goes on a global object or a prototype: only where what is there is missing or fails
// the fill's check of its behavior, never over a built-in that works (a production iOS app runs the
// background on JavaScriptCore, which has most of what PrimJS lacks); writable and configurable, as
// WinterTC's global scope allows, so an app may put its own in place.

/**
 * Whether what is already there works. The default asks only that something is there; a fill whose
 * built-in an engine gets wrong passes a check of that behavior.
 */
export type Works = (existing: unknown) => boolean;

const isPresent: Works = (existing) => existing !== undefined;

/** The getters `installLazy` put in place, which count as installed and are never read to check. */
const lazyGetters = new WeakSet<object>();

/** Whether the fill named `name` is needed on `target`. */
function needed(target: object, name: PropertyKey, works: Works): boolean {
	for (let owner: object | null = target; owner !== null; owner = Object.getPrototypeOf(owner)) {
		const descriptor = Object.getOwnPropertyDescriptor(owner, name);
		if (descriptor === undefined) continue;
		if (descriptor.get !== undefined && lazyGetters.has(descriptor.get)) return false;
		break;
	}
	try {
		// Boundary: a property of any object, read by name.
		return !works((target as Record<PropertyKey, unknown>)[name]);
	} catch {
		return true;
	}
}

/** Puts `value` on `target` as a built-in is: writable, configurable, not enumerable. */
function define(target: object, name: PropertyKey, value: unknown): void {
	Object.defineProperty(target, name, {
		value,
		writable: true,
		enumerable: false,
		configurable: true,
	});
}

/**
 * Puts `value` on `target` as `name` now, unless what is there works. For what must be there before
 * an app's code runs, or what other fills build on, and for methods on prototypes. Returns whether
 * it put it there.
 */
export function installEager(
	target: object,
	name: PropertyKey,
	value: unknown,
	works: Works = isPresent,
): boolean {
	if (!needed(target, name, works)) return false;
	define(target, name, value);
	return true;
}

/**
 * Puts a getter on `target` as `name`, unless what is there works: the first read runs `load` and
 * puts what it returns in the getter's place, and a write puts the value written there, without
 * running `load`. As Expo's `installGlobal`. Returns whether it put the getter there.
 */
export function installLazy(
	target: object,
	name: PropertyKey,
	load: () => unknown,
	works: Works = isPresent,
): boolean {
	if (!needed(target, name, works)) return false;
	const get = (): unknown => {
		const value = load();
		define(target, name, value);
		return value;
	};
	lazyGetters.add(get);
	Object.defineProperty(target, name, {
		get,
		set: (value: unknown) => {
			define(target, name, value);
		},
		enumerable: false,
		configurable: true,
	});
	return true;
}

/** Whether `run` returns `true` without throwing: for a check that calls a built-in. */
export function holds(run: () => boolean): boolean {
	try {
		return run();
	} catch {
		return false;
	}
}
