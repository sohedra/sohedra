# @sohedra/lynx

Svelte on Lynx: runs Svelte's custom renderer on Lynx's background thread and draws with Lynx's
elements on the main thread. Apache-2.0, credits in `NOTICE`. Private.

- Read `CONTRIBUTING.md` § Code first: code shape, folders and imports, errors, workarounds, tests.
- Each folder of `src/` is a program, and imports another only through its `index.ts`.
  `.oxlintrc.jsonc` enforces this table; `tests/contract/lint/` pins it:

  | Folder                      | Runs                | May import                   |
  | --------------------------- | ------------------- | ---------------------------- |
  | `wire/`                     | both threads        | nothing                      |
  | `build/` (and `presets/`)   | Node, at build time | `wire/`, `svelte/build/`     |
  | `background/`               | background thread   | `wire/`, `svelte/runtime/`   |
  | `main-thread/`              | main thread         | `wire/`                      |
  | `first-frame/`              | the page's script   | `wire/`                      |
  | `svelte/build/`, `runtime/` | Node, a thread      | nothing; `runtime/`: `wire/` |
  | `testing/`                  | Node                | every thread's folder        |
  | `gesture/`, `host/`, `env/` | their entries       | `wire/`                      |

- **A thread's globals** (`lynx`, timers, Lynx's element functions, `process`) are reached only
  through the folder's `globals.ts`, typed for that thread. Never name them elsewhere, declare them
  ambiently, or write `globalThis` outside a `globals.ts`: lint enforces it.
- **Svelte's internals** are touched only in `src/svelte/`, and every touch is a row of
  `src/svelte/manifest.ts` that `tests/contract/svelte/` checks. To upgrade Svelte, bump the pinned
  URL and run the tests: the failing row names what to revisit.
- **The compile step** (`src/build/compile/`): `compileComponent` parses a component once, every
  pass returns edits against the source as written, and they are applied once with one map.
  Main-thread function ids come from the script as written. Every message the build throws or warns
  with is an entry of `build/diagnostics/catalogue.ts`.
- **The plugin** (`src/build/plugin/`): a bundler layer per thread (a test run has none). Two
  loaders see every module, `node_modules` too: each returns at once without its marker.
- **`sideEffects`**: a file of `src/` that acts when it loads (registers on a global, adds a
  listener) is listed in `package.json`, source and built, and a production build shows it stays.
- **Build tests** (`tests/build/`) build a fixture of `tests/fixtures/build/apps/` through
  `buildApp`, one at a time; `tests/fixtures/` is not type-checked. Runtime not written yet is
  stubbed in `fixtures/build/stubs/`. `apps/package.json` ends `sideEffects` for fixtures.
- Only a bare `pnpm test` checks `tests/coverage-baseline.json`. The engine fake cites Lynx's source
  per behavior, and throws where unverified. `GENERATED_RUNS=500` tries more generated pages.
