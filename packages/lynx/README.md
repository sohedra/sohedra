# @sohedra/lynx

Svelte on [Lynx](https://lynxjs.org): the binding that runs Svelte's custom renderer on Lynx's
background thread and draws with Lynx's elements on the main thread.

> **Status: early development.** The package is private. Its root entry, `@sohedra/lynx`, has the
> page's entry (`mountPage`), layers above the page (`mount`, `unmount`), the page's root for `on()`
> (`root`), static copies (`createStaticCopy`), `reportError`, main-thread refs and the calls
> between the threads (`mainThreadRef`, `runOnMainThread`, `runOnBackground`), and
> `@sohedra/lynx/gesture` Lynx's gestures for `main-thread:gesture` (run on an Android phone; iOS is
> checked later, and those that wait for a device probe to pass are in
> `@sohedra/lynx/experimental`); the rest grows one pull request at a time.

`@sohedra/lynx/elements` types Lynx's elements for components. With
`"extends": "@sohedra/lynx/tsconfig"` and `"svelteOptions": { "namespace": "svelteLynx" }` in the
app's `tsconfig.json`, svelte-check and the editor check each element's attributes and events, in
the binding's spellings (`ontap`, `oncatchtap`, `ontapcapture`, `main-thread:ontap`), and Svelte's
`on()` types a node's events by name. The base config leaves out the DOM, which Lynx's threads do
not have, and loads `@sohedra/lynx/client`. The types are generated from Lynx's own
(`@lynx-js/types`), which an app does not install. For hovers and completions in the markup, add
`node_modules/@sohedra/lynx/types/generated/html-custom-data.json` to the editor's
`html.customData`.

Lynx's threads lack some globals and built-ins that Svelte's runtime reads or that the other thread
has. The binding installs these where a thread has none, never over the engine's own:
`queueMicrotask` on the background, `SystemInfo` on the main thread, and
`String.prototype.replaceAll`, `EventTarget`
([`@ungap/event-target`](https://github.com/ungap/event-target)) and `structuredClone`
([`@ungap/structured-clone`](https://github.com/ungap/structured-clone)) on both. Svelte's other
reads of the web's globals are not filled yet: `getAbortSignal()` in a `$derived` that the first
frame renders needs `AbortController`, `svelte/motion`'s `Tween` and `Spring` need `performance`,
and `SvelteURL` needs a full `URL`.

Your code sees the fills too, and `EventTarget` and `structuredClone` are smaller than the web's:

- `EventTarget` has `addEventListener` (with `once`), `removeEventListener` and `dispatchEvent`, and
  no `Event` or `CustomEvent`: it takes any extensible object with a `type` as the event, and sets
  its `target` and `currentTarget` while it runs. It ignores the `capture`, `passive` and `signal`
  options, so a listener added for capture and again without it is one listener. `dispatchEvent`
  always returns `true`, and a listener that throws stops the ones after it.
- `structuredClone` throws a `TypeError` where the web's throws a `DataCloneError`. It copies what
  the web's refuses, such as a `Promise` or a `WeakMap`, as an empty object, gives an array's holes
  the value `undefined`, and ignores `transfer`.

`@sohedra/lynx/testing` tests components without a phone, in `@testing-library/svelte`'s shape:
`await render(Component, { props, context, lynx })` draws the page on both threads, the first frame
then the background, on an engine fake that has only what a device has and the binding's fills.
`fireEvent`, `act`, `rerender` and what the test's `lynx` sends (host data and events, a reload, a
list's cells, a gesture's callbacks) are awaited. Run the tests with `withSvelteLynx()` from
`@sohedra/lynx/config/rstest` or `svelteLynx()` from `@sohedra/lynx/config/vitest`, and install
`jsdom`, `@testing-library/dom` and the runner (Vitest needs `vite` too).

Run its tests and type check from the repository root with `pnpm -F @sohedra/lynx test` and
`pnpm -F @sohedra/lynx check`. Read [CONTRIBUTING.md](../../CONTRIBUTING.md) § Code before you
change it.
