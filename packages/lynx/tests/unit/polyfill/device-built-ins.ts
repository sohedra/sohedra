// This process's built-ins made, for the length of a fill, as a device's engine has them: some taken
// away, some replaced by a wrong one. The language fills install on the built-ins of the realm they
// run in, as core-js's modules do, so a test runs them on this process's and puts them back after.

/** A built-in as a device's engine has it: missing, or `onDevice`, its wrong one. */
export type DeviceGap = readonly [owner: object, name: PropertyKey, onDevice?: unknown];

/** What `fillOnDevice` takes. */
export interface DeviceFill {
	/** The built-ins a device lacks or gets wrong. */
	gaps: readonly DeviceGap[];
	/** Runs the fill. */
	fill: () => void;
	/** Other properties the fill changes, put back after it with the gaps. */
	restore?: readonly (readonly [owner: object, name: PropertyKey])[];
}

/** The global core-js keeps its modules' shared store in. */
const CORE_JS_STORE = "__core-js_shared__";

/**
 * Runs `fill` on this process's built-ins with `gaps` as a device has them, and gives back what is
 * in each gap's place after it, in their order. Every gap and every property of `restore` is put
 * back as it was, and so is the global object, whatever the fill did.
 */
export function fillOnDevice({ gaps, fill, restore = [] }: DeviceFill): unknown[] {
	const places = [...gaps.map(([owner, name]) => [owner, name] as const), ...restore];
	places.push([globalThis, CORE_JS_STORE]);
	const saved = places.map(([owner, name]) => Object.getOwnPropertyDescriptor(owner, name));
	try {
		for (const [owner, name, onDevice] of gaps) {
			if (onDevice === undefined) delete (owner as Record<PropertyKey, unknown>)[name];
			else
				Object.defineProperty(owner, name, {
					value: onDevice,
					writable: true,
					enumerable: false,
					configurable: true,
				});
		}
		fill();
		// Boundary: what a fill put on a built-in, read by name.
		return gaps.map(([owner, name]) => (owner as Record<PropertyKey, unknown>)[name]);
	} finally {
		places.forEach(([owner, name], index) => {
			const descriptor = saved[index];
			if (descriptor === undefined) delete (owner as Record<PropertyKey, unknown>)[name];
			else Object.defineProperty(owner, name, descriptor);
		});
	}
}

/** What `run` throws, or `undefined`. */
export function thrown(run: () => unknown): unknown {
	try {
		run();
	} catch (error) {
		return error;
	}
	return undefined;
}

/** The same outcome: the same value, or an error of the same class. */
export function outcome(run: () => unknown): unknown {
	try {
		return { value: run() };
	} catch (error) {
		return { error: (error as Error).constructor.name };
	}
}

/** Whether `value` can be called with `new`, as test262's `isConstructor` asks: a built-in's method can't. */
export function isConstructor(value: unknown): boolean {
	try {
		Reflect.construct(String, [], value as new () => unknown);
		return true;
	} catch {
		return false;
	}
}
