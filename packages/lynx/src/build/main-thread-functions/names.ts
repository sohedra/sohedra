// The names the compiled code gives its own helpers; they start with `__` so as not to collide with the app's.

export const COMPILED_NAMES = {
	/** The constant a markup function is declared as in the script, with its number. */
	hoisted: "__mainThread",
} as const;
