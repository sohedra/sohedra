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

The build and the test presets run on Node.js `^22.22.2 || ^24.15.0 || ^26.0.0`, as `engines` in the
package's manifest says: the lines in Active or Maintenance LTS, each from the version the test
presets' `jsdom` needs. CI runs the newest release of each line, and Node.js 22.22.2, the oldest
version claimed. The build takes the types out of a component's main-thread functions written in
TypeScript with Node's own `module.stripTypeScriptTypes`, and says so when the Node that builds has
none. What is more than a type (an `enum`, a `namespace`, a parameter property, a decorator) is a
build error in a main-thread function, which says what to write instead.

Lynx's threads lack some globals and built-ins that Svelte's runtime reads or that the other thread
has. The binding installs these where a thread has none, never over the engine's own:
`queueMicrotask` on the background, `performance.now()` on the background (for `svelte/motion` and
`$inspect.trace()`), `SystemInfo` on the main thread, and `String.prototype.replaceAll`,
`EventTarget` ([`@ungap/event-target`](https://github.com/ungap/event-target)) and `structuredClone`
([`@ungap/structured-clone`](https://github.com/ungap/structured-clone)) on both. `getAbortSignal()`
in a `$derived` that the first frame renders still needs `AbortController` on the main thread.

Everything else of the web and the language comes from
[`@sohedra/lynx-polyfill`](../../modules/lynx-polyfill), which an app imports in the first line of
its entry (`import "@sohedra/lynx-polyfill"`) and which replaces the binding's smaller
`performance`, `EventTarget` and `structuredClone` with the standard's. The binding imports nothing
of it: it hears the errors the polyfill catches as `error` events on the global object, and sends
them to the page's `onError`. When a page reads a global Lynx lacks, its error names the import that
fills it, or what to use instead.

The build also checks the app's own code (not its packages) for what type-checks and then fails on
Lynx, at its file, line and column. These are errors: a global the thread lacks, with the import of
`@sohedra/lynx-polyfill` that fills it when the app imports neither it nor the catch-all, or what to
use instead; the web's DOM (`document`, `window`, `HTMLElement`…); an API of the other thread, such
as `NativeModules` or `lynx.getJSModule` in a main-thread function, or Lynx's element functions
outside one; and a plain function a main-thread function calls without `runOnBackground`. A read
behind a feature check (`typeof X !== "undefined"`, `"X" in globalThis`) anywhere in the file is
left alone. A development build also warns at a selector outside the ones Lynx lists, and at a
main-thread handler inside `{#if background}`, `{#if mainThread}` or their `{:else}`. To silence one
of these on a line, write a comment with its code on that line or the one above:
`// svelte-lynx-ignore dom_not_on_lynx`, `<!-- svelte-lynx-ignore … -->` in markup, and
`/* svelte-lynx-ignore … */` in a style sheet. As it runs, a development build warns once for a
`<scroll-view>` that holds more than 200 elements directly, which a `<list>` draws faster.

Without the polyfill, your code sees the binding's fills, and `EventTarget` and `structuredClone`
are smaller than the web's:

- `EventTarget` has `addEventListener` (with `once`), `removeEventListener` and `dispatchEvent`, and
  no `Event` or `CustomEvent`: it takes any extensible object with a `type` as the event, and sets
  its `target` and `currentTarget` while it runs. It ignores the `capture`, `passive` and `signal`
  options, so a listener added for capture and again without it is one listener. `dispatchEvent`
  always returns `true`, and a listener that throws stops the ones after it.
- `structuredClone` throws a `TypeError` where the web's throws a `DataCloneError`. It copies what
  the web's refuses, such as a `Promise` or a `WeakMap`, as an empty object, gives an array's holes
  the value `undefined`, and ignores `transfer`.

`@sohedra/lynx/testing` tests components without a phone, in `@testing-library/svelte`'s shape:
`await render(Component, { props, context, lynx })` runs the page on both threads, on an engine fake
that has only what a device has and the binding's fills. The background draws it; with
`lynx: { firstFrame: true }` the main thread draws the first frame first, and the background
hydrates it: turn that on to test what the first frame shows, or that the two agree. `fireEvent`,
`act`, `rerender` and what the test's `lynx` sends (host data and events, a reload, a list's rows, a
gesture's callbacks) are awaited. Run the tests with `withSvelteLynx()` from
`@sohedra/lynx/config/rstest` or `svelteLynx()` from `@sohedra/lynx/config/vitest`, and install
`jsdom`, `@testing-library/dom` and the runner (Vitest needs `vite` too).

Run its tests and type check from the repository root with `pnpm -F @sohedra/lynx test` and
`pnpm -F @sohedra/lynx check`. Read [CONTRIBUTING.md](../../CONTRIBUTING.md) § Code before you
change it.
