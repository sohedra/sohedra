// The state of a generated page: what its data holds, and the values each part may take.

import fc from "fast-check";

/** The texts a page's state and its static texts take. */
export const TEXTS: readonly string[] = [
	"",
	" ",
	"a",
	"two words",
	"<",
	"a & b",
	"x\u2028y",
	"é ü",
	"<list-item",
	`'"`,
];

/** The values of the arrays `{#each}` goes over: distinct, so each can be a key. */
const ITEMS: readonly string[] = ["a", "b", "c", "<list-item", "é", "x y"];

/** The page's state, from its data: every page has all of it. */
export interface PageState {
	s0: string;
	s1: string;
	s2: string;
	b0: boolean;
	b1: boolean;
	n0: number;
	a0: string[];
	a1: string[];
	t0: "view" | "text";
}

/** The keys of the state, by kind. */
export const STRING_KEYS: readonly ["s0", "s1", "s2"] = ["s0", "s1", "s2"];
export const ARRAY_KEYS: readonly ["a0", "a1"] = ["a0", "a1"];

const items = (): fc.Arbitrary<string[]> =>
	fc.uniqueArray(fc.constantFrom(...ITEMS), { maxLength: 4 });

/** The most items an array of the state holds: four, and a tap may add `"z"`. */
export const MOST_ITEMS = 5;

/** A value for one key of the state. */
export function stateValue(key: keyof PageState): fc.Arbitrary<PageState[keyof PageState]> {
	if (key.startsWith("s")) return fc.constantFrom(...TEXTS);
	if (key.startsWith("b")) return fc.boolean();
	if (key === "n0") return fc.integer({ min: 0, max: 2 });
	if (key === "t0") return fc.constantFrom("view" as const, "text" as const);
	return items();
}

/** The state a page starts with. */
export const pageState: fc.Arbitrary<PageState> = fc.record({
	s0: fc.constantFrom(...TEXTS),
	s1: fc.constantFrom(...TEXTS),
	s2: fc.constantFrom(...TEXTS),
	b0: fc.boolean(),
	b1: fc.boolean(),
	n0: fc.integer({ min: 0, max: 2 }),
	a0: items(),
	a1: items(),
	t0: fc.constantFrom("view" as const, "text" as const),
});

/** Every key of the state. */
export const STATE_KEYS: readonly (keyof PageState)[] = [
	"s0",
	"s1",
	"s2",
	"b0",
	"b1",
	"n0",
	"a0",
	"a1",
	"t0",
];
