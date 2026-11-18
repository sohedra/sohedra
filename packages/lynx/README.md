# @sohedra/lynx

Svelte on [Lynx](https://lynxjs.org): the binding that runs Svelte's custom renderer on Lynx's
background thread and draws with Lynx's elements on the main thread.

> **Status: early development.** The package is private. Its root entry, `@sohedra/lynx`, has
> main-thread refs and the calls between the threads (`mainThreadRef`, `runOnMainThread`,
> `runOnBackground`), and `@sohedra/lynx/gesture` Lynx's gestures for `main-thread:gesture` (run on
> an Android phone; iOS is checked later, and those that wait for a device probe to pass are in
> `@sohedra/lynx/experimental`); the rest grows one pull request at a time.

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

Run its tests and type check from the repository root with `pnpm -F @sohedra/lynx test` and
`pnpm -F @sohedra/lynx check`. Read [CONTRIBUTING.md](../../CONTRIBUTING.md) § Code before you
change it.
