import { createContext } from "svelte";

export interface DefinedContext<T> {
	/** Reads the context, throwing the missing-context error when it isn't set. */
	get(): T;
	/** Reads the context, or `fallback` when it isn't set. */
	getOr<F>(fallback: F): T | F;
	/** Sets the context for the current component's descendants. */
	set(value: T): T;
}

/**
 * A typed context with a missing-context message: `Sohedra: <name> is missing. <hint>`.
 * Values are store instances (or null stores for optional contexts), never plain value objects.
 * Free of side effects, so a bundler drops a context nothing reads.
 */
/*#__NO_SIDE_EFFECTS__*/
export function defineContext<T>(
	name: string,
	hint: string,
	options?: { readonly message?: string },
): DefinedContext<T> {
	const [get, set, has] = createContext<T>();
	// A few contexts throw their own message (for example `<Popover.Portal> is missing.`).
	const message = options?.message ?? `Sohedra: ${name} is missing. ${hint}`;
	return {
		get() {
			if (!has()) {
				throw new Error(message);
			}
			return get();
		},
		getOr(fallback) {
			return has() ? get() : fallback;
		},
		set,
	};
}
