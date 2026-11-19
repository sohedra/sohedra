// JavaScript that TypeScript reads otherwise, in a plain module.
const a = 1;
const b = 2;
const c = 0;
// prettier-ignore
// oxlint-disable-next-line oxc/bad-comparison-sequence -- the shape under test
export const compared = a < b > (c);
