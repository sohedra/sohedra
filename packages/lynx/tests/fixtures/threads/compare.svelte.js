// `a < b > (c)`: a comparison in JavaScript, a call of `a` with a type argument in TypeScript.
const a = 1;
const b = 2;
const c = 0;
// prettier-ignore
// oxlint-disable-next-line oxc/bad-comparison-sequence -- the shape under test
export const compared = a < b > (c);
