# @sohedra/lynx-polyfill

The web's standard APIs and the language through ES2025 on both of Lynx's threads, for a Lynx app
whose build resolves the main thread with the `worker` condition (Sohedra's does). Apache-2.0,
credits in `NOTICE`. Private.

- Read `CONTRIBUTING.md` § Code first: shape, folders, errors, workarounds, tests.
- `src/fills/` holds every fill and imports nothing outside itself: no Svelte, no `@lynx-js/*`, no
  package of this repository. `src/background/` and `src/main-thread/` are the entries, one file per
  subpath of `package.json`'s `exports`, which resolve by thread (`worker` is the main thread); an
  entry imports only `../fills/index.ts`. `.oxlintrc.jsonc` enforces both.
- **A thread's globals** (`lynx`, the timers, `console`, `process`) and `globalThis` are named only
  in `src/fills/globals.ts`. Never `Reflect` in `src/`: Android's engine objects refuse it.
- **A fill** installs with `installEager` or `installLazy` (`src/fills/install.ts`) behind a check
  of the global's behavior, never over one that works. Its file's header gives the spec section and
  what it leaves out; its function carries a `@workaround` tag. What it catches goes to
  `reportCaught` (`src/fills/errors.ts`). A new subpath gets an entry per thread, a row in the
  README, a row in the binding's missing-global table (`packages/lynx/src/wire/missing-globals.ts`)
  and its budget in `tests/package/entries.test.ts`' snapshot.
- **Vendored packages:** a dev dependency pinned exactly, an entry in `scripts/vendor/entries/`,
  `pnpm -F @sohedra/lynx-polyfill vendor` to bundle it into `src/fills/vendor/` (committed, never
  edited by hand), a hand-written `.d.ts` beside it, a line in `NOTICE`, and Renovate's `polyfill`
  group. `tests/contract/vendor.test.ts` bundles again and compares.
- **Tests:** `pnpm -F @sohedra/lynx-polyfill test` runs the unit, contract, package and speed tests.
  `test:primjs` (`test:wpt`, `test:test262`) builds PrimJS from source (a C++ compiler and CMake),
  fetches WPT and test262 into `.cache/`, and runs them on both threads of both engines against the
  status files in `tests/primjs/*/status/`. Our own code has no expected failure but a Lynx limit
  named in its note.
