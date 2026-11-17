# @sohedra/lynx

Svelte on Lynx: the binding that runs Svelte's custom renderer on Lynx's background thread and draws
with Lynx's elements on the main thread. Apache-2.0, with credits in `NOTICE`. Private, with no
public entry yet; it grows one pull request at a time.

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
- **The compile step** (`src/build/compile/`): `compileComponent` preprocesses and parses a
  component once, `prepare` lets every pass read that one AST and return edits against the source as
  written, and the edits are applied once with one map. Main-thread functions
  (`build/main-thread-functions/`) take their ids from the script as written, so both threads agree.
  Every message the build throws or warns with is an entry of `build/diagnostics/catalogue.ts`, with
  its fix and its docs page. `tests/fixtures/build/` holds inputs and is not type-checked.
- Use Svelte's custom-renderer build, as the root `AGENTS.md` says.
- `pnpm -F @sohedra/lynx test` also measures coverage. No floor is recorded yet; once
  `tests/coverage-baseline.json` exists, coverage may never drop below it.
