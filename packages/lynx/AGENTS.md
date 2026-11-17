# @sohedra/lynx

Svelte on Lynx: the binding that runs Svelte's custom renderer on Lynx's background thread and draws
with Lynx's elements on the main thread. Apache-2.0, with credits in `NOTICE`. Private, with no
runtime yet; it grows one pull request at a time.

- Read `CONTRIBUTING.md` § Code first: code shape, folders and imports, errors, workarounds, tests.
- Each folder of `src/` is a program, and imports another only through its `index.ts`.
  `.oxlintrc.jsonc` enforces this table, and `tests/contract/lint/` pins it:

  | Folder                      | Runs                  | May import                 |
  | --------------------------- | --------------------- | -------------------------- |
  | `wire/`                     | both threads          | nothing                    |
  | `build/` (and `presets/`)   | Node, at build time   | `wire/`, `svelte/build/`   |
  | `background/`               | the background thread | `wire/`, `svelte/runtime/` |
  | `main-thread/`              | the main thread       | `wire/`                    |
  | `first-frame/`              | the page's own script | `wire/`                    |
  | `svelte/build/`, `runtime/` | Node, a thread        | nothing                    |
  | `testing/`                  | Node                  | every thread's folder      |
  | `gesture/`, `host/`, `env/` | their entries         | `wire/`                    |

- **A thread's globals** (`lynx`, timers, Lynx's element functions, `process`) are reached only
  through the folder's `globals.ts`, typed for that thread. Never name them elsewhere, declare them
  ambiently, or write `globalThis` outside a `globals.ts`; lint enforces this.
- **Svelte's internals** are touched only in `src/svelte/`, and every touch is a row of
  `src/svelte/manifest.ts` (read through `src/svelte/index.ts`) that `tests/contract/svelte/`
  checks. To upgrade Svelte, bump the pinned URL in `package.json` and run the tests: the failing
  row names what to revisit.
- **The compile step** (`src/build/compile/`): `compileComponent` parses a component once, every
  pass returns edits against the source as written, and they are applied once with one map. Every
  message the build throws or warns with is an entry of `build/diagnostics/catalogue.ts`.
- **The plugin** (`src/build/plugin/`): a bundler layer per thread (`layers.ts`), the rules split by
  layer (`rules-test.ts`: one thread, no layers). Two loaders see every module, `node_modules` too,
  so each returns at once without its marker. `RUNTIME_FILES` are found by path.
- **Build tests** (`tests/build/`) build a fixture of `tests/fixtures/build/apps/` through
  `buildApp`, one at a time. Runtime not written yet is stubbed in `tests/fixtures/build/stubs/`.
  `sideEffects` covers fixtures too; `apps/package.json` ends that.
- Use Svelte's custom-renderer build, as the root `AGENTS.md` says.
- `pnpm -F @sohedra/lynx test` also measures coverage. No floor is recorded yet; once
  `tests/coverage-baseline.json` exists, coverage may never drop below it.
