# @sohedra/lynx

Svelte on [Lynx](https://lynxjs.org): the binding that runs Svelte's custom renderer on Lynx's
background thread and draws with Lynx's elements on the main thread.

> **Status: early development.** The package is private. Its root entry, `@sohedra/lynx`, has
> main-thread refs and the calls between the threads (`mainThreadRef`, `runOnMainThread`,
> `runOnBackground`), and `@sohedra/lynx/gesture` Lynx's gestures for `main-thread:gesture` (those
> with no device probe yet are in `@sohedra/lynx/experimental`); the rest grows one pull request at
> a time.

Run its tests and type check from the repository root with `pnpm -F @sohedra/lynx test` and
`pnpm -F @sohedra/lynx check`. Read [CONTRIBUTING.md](../../CONTRIBUTING.md) § Code before you
change it.
