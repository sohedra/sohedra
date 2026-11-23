// `@sohedra/lynx/env`, bundled from the source by `pnpm -F @sohedra/lynx declarations`.

/**
 * `true` in the main thread's bundle, where the first frame is drawn. In markup, `{#if mainThread}`
 * draws a part in the first frame only, and a component in it takes `$props.id()` values of its own
 * (`lynx-m1`…), so the ids after it are the background's.
 */
export const mainThread: boolean;
/**
 * `true` in the background thread's bundle, where Svelte and the app run. In markup,
 * `{#if background}` keeps a part off the first frame, and a component in it takes `$props.id()`
 * values of its own (`lynx-b1`…), so the ids after it are the first frame's.
 */
export const background: boolean;
/** `true` in a development build. */
export const dev: boolean;

export {};
