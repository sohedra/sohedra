# @sohedra/lynx

Svelte on Lynx: runs Svelte's custom renderer on Lynx's background thread and draws with Lynx's
elements on the main thread. Apache-2.0, credits in `NOTICE`. Private.

- Read `CONTRIBUTING.md` § Code first: shape, folders, errors, workarounds, tests.
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
  | `gesture/`, `env/`          | their entries       | `wire/`                      |

- **A thread's globals** (`lynx`, timers, Lynx's element functions, `process`) are reached only
  through the folder's `globals.ts`, typed for that thread. Never name them elsewhere, declare them
  ambiently, or write `globalThis` outside a `globals.ts`: lint enforces it.
- **Svelte's internals** are touched only in `src/svelte/`, and every touch is a row of
  `src/svelte/manifest.ts` that `tests/contract/svelte/` checks. To upgrade Svelte, bump its dev
  copy and run the tests: the failing row names what to revisit.
- **The compile step** (`src/build/compile/`): `compileComponent` parses a component once, every
  pass returns edits against the source as written, and they are applied once with one map.
  Main-thread function ids come from the script as written. Every message the build throws or warns
  with is an entry of `build/diagnostics/catalogue.ts`.
- **The plugin** (`src/build/plugin/`): a bundler layer per thread (a test run: the first-frame
  copies' main-thread layer only). Two loaders see every module, `node_modules` too: each returns at
  once without its marker.
- **`sideEffects`**: a `src/` file acting on load (registers a global, adds a listener) is in
  `package.json`, source and built, or production drops it. Fixtures: `apps/package.json`.
- **Build tests** (`tests/build/`) share a production and a development build of
  `tests/fixtures/build/apps/` per run (`sharedBuild`); `buildApp` takes a test's own options,
  `cliBuild` a CLI. Fixtures are not type-checked; `stubs/` stand in for unwritten runtime.
- Only a bare `pnpm test` checks `tests/coverage-baseline.json`. The engine fake cites Lynx per
  behavior, and throws where unverified. `GENERATED_RUNS=500` tries more pages.
