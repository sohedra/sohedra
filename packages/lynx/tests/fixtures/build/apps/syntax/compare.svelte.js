// JavaScript that TypeScript reads otherwise, in a rune module: each shape compares in JavaScript, and
// is a call of `a` (with a type argument) in TypeScript. Svelte's printer keeps the template and the
// parentheses of all but the first.
const a = 1;
const b = 2;
const c = 0;
// prettier-ignore
export const compared = [
	// oxlint-disable-next-line oxc/bad-comparison-sequence -- the shape under test
	a < b > (c),
	// oxlint-disable-next-line oxc/bad-comparison-sequence -- the shape under test
	a < b > `0`,
	// oxlint-disable-next-line oxc/bad-comparison-sequence -- the shape under test
	a < b > (c ? 0 : 0),
	// oxlint-disable-next-line oxc/bad-comparison-sequence -- the shape under test
	a < b > (c, 0),
];
