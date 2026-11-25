// Which thread a bundle is, as values: `import { mainThread, background, dev } from
// "@sohedra/lynx/environment"`. Each is decided when the app is built, so the branch it guards is
// dropped from the thread that never runs it. `{#if background}` keeps a part of the markup off the
// first frame. A component in it, or in its `{:else}`, takes `$props.id()` values of its branch's
// own (`lynx-b1`…, `lynx-m1`…), so the ids of every other component are the same in the first frame
// and on the background. The build knows a flag or its negation as the test (`{#if background}`,
// `{#if !mainThread}`, and `{#if BROWSER}` from `esm-env`), under any name the import gives them,
// and a flag joined to more by `&&` for the consequent alone. A development build warns at another
// `{#if}` that reads a flag around a component, and of an id hydration wrote over outside any
// `{#if}`.

export { MAIN_THREAD as mainThread, BACKGROUND as background, DEV as dev } from "./globals.ts";
