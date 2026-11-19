// The binding's internal words, which no message may use: the one list every catalogue's test
// checks its messages against.

/** A word of the binding's own, not the developer's: none may appear in a message. */
export const INTERNAL_WORDS: RegExp =
	/\b(?:patch|op|ops|worklet|lepus|svelte-lynx|generation|wire|serialized)\b/i;
