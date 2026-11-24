// The types of float16.js, which scripts/polyfill/bundle.ts writes from core-js.

/** Loads core-js's modules for `Math.f16round` and `DataView`'s `getFloat16` and `setFloat16`, once: each installs what its check finds missing or wrong. */
export function loadFloat16(): void;
