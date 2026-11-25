// Every reader of what the threads send each other handles every kind: its `switch` ends in a
// default branch that hands what is left to `unknownKind` or `unknownKindError`
// (./development-catalogue.ts), which take `never`, so a new kind of message, patch item, op or
// call is a compile error in each reader that misses it. At run time the default branch sees a
// kind this build does not know: a development build reports it, and a production build skips it,
// as both threads ship in one build.

/** The kind of a message, or of a part of one, that no case of a reader took. */
export function unknownKind(value: never): string {
	// At run time `value` is whatever came: a tuple led by its kind, a message with its kind in `t`.
	const came: unknown = value;
	if (Array.isArray(came)) return String(came[0]);
	if (typeof came === "object" && came !== null && "t" in came) return String(came.t);
	return String(came);
}
