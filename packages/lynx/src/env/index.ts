// Which thread a bundle is, as values: `import { mainThread, background, dev } from
// "@sohedra/lynx/env"`. Each is decided when the app is built, so the branch it guards is dropped
// from the thread that never runs it. `{#if background}` keeps a part of the markup off the first
// frame. A component in it, or in its `{:else}`, takes `$props.id()` values of its branch's own
// (`lynx-b1`…, `lynx-m1`…), so the ids of every other component are the same in the first frame and
// on the background. The build knows `{#if background}`, `{#if !background}`, `{#if mainThread}` and
// `{#if !mainThread}`, under any name the import gives them; a test with more in it shifts the ids
// after it, and a development build warns of each id that differed.

export { MAIN_THREAD as mainThread, BACKGROUND as background, DEV as dev } from "./globals.ts";
