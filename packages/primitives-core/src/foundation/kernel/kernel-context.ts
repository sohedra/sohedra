import { createContext } from "svelte";

export interface DefinedContext<T> {
	/**
	 * Reads the context. `part` is the reader's public name (`Popover.Title`), which the error
	 * names when no provider set the context.
	 */
	get(part: string): T;
	/** Reads the context, or `fallback` when it isn't set. */
	getOr<F>(fallback: F): T | F;
	/** Sets the context for the current component's descendants. */
	set(value: T): T;
}

/**
 * The error of a part rendered outside the part it must be placed within. `provider` is a public
 * name (`Dialog.Root`), or a family-wide part's name inside the reader's component (`Root`);
 * `alternative` ends the sentence for a part with another way in (`given a handle`).
 */
export function missingProviderMessage(
	part: string,
	provider: string,
	alternative?: string,
): string {
	const within = provider.includes(".") ? provider : `${part.split(".")[0]}.${provider}`;
	return `Sohedra: <${part}> must be placed within <${within}>${alternative ? ` or ${alternative}` : ""}.`;
}

/**
 * A typed context that `provider` sets; read outside one, it throws in every build, naming the
 * part and its provider. It holds a store, a `…View` of one or a plain id, never an object made
 * for it. Free of side effects, so a bundler drops a context nothing reads.
 */
/*#__NO_SIDE_EFFECTS__*/
export function defineContext<T>(provider: string): DefinedContext<T> {
	const [get, set, has] = createContext<T>();
	return {
		get(part) {
			if (!has()) {
				throw new Error(missingProviderMessage(part, provider));
			}
			return get();
		},
		getOr(fallback) {
			return has() ? get() : fallback;
		},
		set,
	};
}
