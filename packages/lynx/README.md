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
not have, and loads `@sohedra/lynx/client`, which declares what a Lynx thread has without a fill:
`console`, the timers, `requestAnimationFrame`, `queueMicrotask`, `SystemInfo`, `lynx` with every
member Lynx declares for either thread except `lynx.fetch`, `lynx.EventSource` and
`lynx.ReadableStream` (Lynx types them with the DOM's types, which its threads lack: use the
standard `fetch`, `EventSource` and `ReadableStream` of `@sohedra/lynx-polyfill`), and
`NativeModules`, which only the background has. Each doc comment says which thread has it. Each
import of `@sohedra/lynx-polyfill` declares what it fills, so `URL` type-checks once the app imports
`@sohedra/lynx-polyfill` or `/url`, and `window` or `localStorage` never does. The element types are
generated from Lynx's own (`@lynx-js/types`), which an app does not install. For hovers and
completions in the markup, add `node_modules/@sohedra/lynx/types/generated/html-custom-data.json` to
the editor's `html.customData`.

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

The build also checks the app's own code (the files under the app's folder, outside `node_modules`)
for what type-checks and then fails on Lynx, at its file, line and column. Code outside every
function (a module's top level, a component's script and markup) runs on both threads, since the
main thread runs it for the first frame; code in a function runs on the background, and in a
main-thread function on the main thread, but for the function it hands `runOnBackground`; code under
a thread's flag (`if (background)`, `if (!mainThread) return;`, `{#if mainThread}`) runs on that
thread only. These are errors:

- a global the thread lacks, with the import of `@sohedra/lynx-polyfill` that fills it, when the app
  fills it no way: no import of that fill or of the catch-all that holds it, no assignment of its
  own (`globalThis.TextEncoder = …`, `Object.defineProperty(globalThis, "TextEncoder", …)`), and no
  fill package it builds with. The packages counted, by the file that installs their globals:
  `core-js` (its `modules/web.*` and `es.iterator.constructor`, which every entry such as `core-js`,
  `core-js/stable` or `core-js/stable/url` loads), `fast-text-encoding`, `abortcontroller-polyfill`
  (not its ponyfills), `whatwg-fetch`, `url-polyfill` and `web-streams-polyfill/polyfill`.
  `text-encoding` and `@ungap/structured-clone` install no global under a bundler, so they don't
  count. For a fill this list doesn't know, put the comment below on each read, or install the
  global from the app's own code;
- a global no fill gives (`Intl`, `crypto`…), with what to use instead;
- the web's DOM (`document`, `window`, `HTMLElement`…);
- an API of the other thread: `NativeModules` or `lynx.getJSModule` on the main thread, Lynx's
  element functions on the background, and `lynx.querySelector`, which neither thread has in Svelte
  on Lynx;
- a plain function a main-thread function calls without `runOnBackground`.

The background has lynx-core's own `URL`, `URLSearchParams`, `fetch`, `Headers`, `Request`,
`Response` and `AbortController`, so reading them there throws nothing and the build says nothing.
Each misses parts of the standard (lynx-core's `URL` has no `pathname` or `search`, its `Headers`
minds case, its `AbortSignal` has no `timeout`): import `@sohedra/lynx-polyfill/url`, `/fetch` or
`/abort`, or the catch-all, to replace them with the standard's.

A read behind a feature check (`typeof X !== "undefined"`, `"X" in globalThis`, `globalThis.X`, or
inside a `try` that has a `catch`) anywhere in the file is left alone. A development build also
warns at a selector outside the ones Lynx lists, and at a main-thread handler inside
`{#if background}`, `{#if mainThread}` or their `{:else}`. To silence one of these on a line, write
a comment with its code on that line or the one above: `// svelte-lynx-ignore dom_not_on_lynx`,
`/* svelte-lynx-ignore … */` in a style sheet, and `<!-- svelte-lynx-ignore … -->` in markup, where
a comment above an element also silences its attributes, each on a line of its own. As it runs, a
development build warns once for a `<scroll-view>` that holds more than 200 elements directly, which
a `<list>` draws faster.

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

An app can turn on Svelte's async mode (`compilerOptions.experimental.async`, off as in Svelte). The
first frame does not wait: a page that awaits outside a `<svelte:boundary>` with a `pending` snippet
has no first frame, and a development build warns; inside one, the first frame draws the snippet.

`@sohedra/lynx/testing` tests components without a phone, in `@testing-library/svelte`'s shape:
`await render(Component, { props, context, lynx })` runs the page on both threads, on an engine fake
that has only what a device has and the binding's fills. The background draws it; with
`lynx: { firstFrame: true }` the main thread draws the first frame first, and the background
hydrates it: turn that on to test what the first frame shows, or that the two agree. `fireEvent`,
`act`, `rerender` and what the test's `lynx` sends (host data and events, a reload, a list's rows, a
gesture's callbacks) are awaited. Each thread's timers, frames and promise continuations run as that
thread, as on a device, also under the test's fake timers; the background's `requestAnimationFrame`
is the test's own, if it set one before `render`. Run the tests with `withSvelteLynx()` from
`@sohedra/lynx/config/rstest` or `svelteLynx()` from `@sohedra/lynx/config/vitest`, and install
`jsdom`, `@testing-library/dom` and the runner (Vitest needs `vite` too).

Run its tests and type check from the repository root with `pnpm -F @sohedra/lynx test` and
`pnpm -F @sohedra/lynx check`. Read [CONTRIBUTING.md](../../CONTRIBUTING.md) § Code before you
change it.
