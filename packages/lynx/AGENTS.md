# @sohedra/lynx

Svelte on Lynx: the binding that runs Svelte's custom renderer on Lynx's background thread and draws
with Lynx's elements on the main thread. Apache-2.0, with credits in `NOTICE`. Private, with no
public entry yet; it grows one pull request at a time.

- Read `CONTRIBUTING.md` § Code first: code shape, folders and imports, errors, workarounds, tests.
- A folder is a program: `build/` (Node), `background/`, `main-thread/` and `first-frame/` (Lynx's
  two threads), with `wire/` between them. Which folder may import which is set in
  `.oxlintrc.jsonc`; import another folder only through its `index.ts`.
- **A thread's globals** (`lynx`, timers, Lynx's element functions, `process`) are reached only
  through the folder's `globals.ts`, typed for that thread. Never use them bare, never declare them
  ambiently, and never write `globalThis` outside a `globals.ts`; lint enforces this.
- **Svelte's internals** are touched only in `src/svelte/`, and every touch is a row of
  `src/svelte/manifest.ts`. `tests/contract/svelte/svelte-contract.test.ts` checks each row, so a
  Svelte upgrade names what to revisit: bump the pinned URL in `package.json`, then run the tests.
- Use Svelte's custom-renderer build, as `AGENTS.md` at the root says.
- `pnpm -F @sohedra/lynx test` also measures coverage; it may never drop below
  `tests/coverage-baseline.json`.
