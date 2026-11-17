# @sohedra/lynx

Svelte on Lynx: runs Svelte's custom renderer on Lynx's background thread and draws with Lynx's
elements on the main thread. Apache-2.0, credits in `NOTICE`. Private; no runtime yet.

- Read `CONTRIBUTING.md` § Code first: code shape, folders and imports, errors, workarounds, tests.
- Each folder of `src/` is a program, and imports another only through its `index.ts`.
  `.oxlintrc.jsonc` enforces this table; `tests/contract/lint/` pins it:

  | Folder                      | Runs                | May import                 |
  | --------------------------- | ------------------- | -------------------------- |
  | `wire/`                     | both threads        | nothing                    |
  | `build/` (and `presets/`)   | Node, at build time | `wire/`, `svelte/build/`   |
  | `background/`               | background thread   | `wire/`, `svelte/runtime/` |
  | `main-thread/`              | main thread         | `wire/`                    |
  | `first-frame/`              | the page's script   | `wire/`                    |
  | `svelte/build/`, `runtime/` | Node, a thread      | nothing                    |
  | `testing/`                  | Node                | every thread's folder      |
  | `gesture/`, `host/`, `env/` | their entries       | `wire/`                    |

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
  listener) must be listed in `package.json` `sideEffects`, in source and built form, with a
  production build that shows it stays. An unlisted file is dropped in production only.
- **Build tests** (`tests/build/`) build a fixture of `tests/fixtures/build/apps/` through
  `buildApp`, one at a time; `tests/fixtures/` is not type-checked. Runtime not written yet is
  stubbed in `fixtures/build/stubs/`. `apps/package.json` ends `sideEffects` for fixtures.
- **The engine fake** (`src/testing/engine/`) is Lynx's main thread on a DOM, each element a jsdom
  node. Each behaviour names the engine source it follows (a path in `lynx-family/lynx`); where
  Lynx's behaviour is not verified, it throws instead of guessing. The behaviours the binding counts
  on are the cases of `tests/contract/engine/behaviours.ts`, which a device will run too: a case
  uses only what a device has.
- **A test page** (`startTestPage`) puts the fake on the main thread's globals and gives both
  threads one `lynx`. Everything between the threads crosses one bridge on a later macrotask, and
  `settle()` waits for it. The page's scripts start where a device starts them; nothing runs in
  their place. Tests of `src/testing` and `threads/` run through `withSvelteLynx()`.
- `pnpm -F @sohedra/lynx test` measures coverage against the floor in `tests/coverage-baseline.json`
  (whole percents, rounded down). Never lower it; raise it when coverage rises.
