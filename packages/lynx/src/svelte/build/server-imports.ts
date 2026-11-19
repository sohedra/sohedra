// Two imports of Svelte's server runtime that the first frame never runs, and that the build keeps
// quiet and out of the bundle (the contract rows `async-hooks-import` and `crypto-import`).

/** The specifier of the dynamic import only Svelte's async server rendering runs. */
export const SERVER_ASYNC_HOOKS_IMPORT: RegExp = /^node:async_hooks$/;

/** The hash helper that imports `crypto` through an expression, which the bundler warns about. */
export const SERVER_CRYPTO_FILE: RegExp =
	/[\\/]svelte[\\/]src[\\/]internal[\\/]server[\\/]crypto\.js$/;
