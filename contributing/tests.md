# Tests

A map of every test in the repo: what each kind covers, where it runs, and the exact command. CI is
in `.github/workflows/ci.yml`.

## Before you run anything

- **Run browser and device tests through `scripts/test-slot.sh`.** It waits for one of two
  machine-wide slots (`SOHEDRA_TEST_SLOTS` changes the count), so parallel sessions don't slow each
  other down. `pnpm test:affected` does it for you.
- **Every command that starts a server sets its own port.** Vitest's browser mode picks a free port
  itself. The Lynx playground serves on rspeedy's default port, 3000, which a phone points at
  (`adb reverse tcp:3000 tcp:3000`): before you start it, check that no other session serves there
  (`lsof -iTCP:3000 -sTCP:LISTEN`), so a phone never loads another session's page.
- **Check the exit code, not the output.** `echo $?` after the command, or `&& echo passed`.
- **No retries.** A flake is reproduced (run the file in a loop), then fixed. It is never retried.
- **Report each mode's numbers from that mode's own run.**

Run from the repository root:

```sh
pnpm test                                          # every package, as CI does
pnpm -F @sohedra/primitives-web test switch        # one package, files whose path matches
pnpm test:affected                                 # what this branch reaches, in every mode
pnpm test:affected --dry                           # the same plan, printed
```

## Where tests live

Tests live in each package's `tests/` folder and test public behavior through the public entry. The
binding and the polyfill group them by kind, with a subfolder per source area. The primitives mirror
their source (`tests/components/<x>/`, `tests/foundation/<job>/`), since a store is tested where it
is decided. Lynx packages use Rstest; web packages use Vitest.

## At a glance

| Package           | Kind                                                        | Files                                               | Runs in                                              |
| ----------------- | ----------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| `primitives-core` | [Store and rules](#core)                                    | `tests/components/<x>/`, `tests/foundation/<job>/`  | Node, Vitest, on the fake platform; two modes        |
| `primitives-web`  | [Parts](#web)                                               | `tests/components/<x>/<x>-<part>[.<topic>].test.ts` | Chromium and WebKit, Vitest browser mode; four modes |
| `primitives-web`  | [Conformance](#shared-suites)                               | `<x>.conformance.test.ts`                           | Like parts                                           |
| `primitives-web`  | [Accessibility](#web)                                       | `<x>.a11y.test.ts`                                  | Like parts                                           |
| `primitives-web`  | [Server rendering](#web)                                    | `<x>.ssr.test.ts`; `<x>.hydration.test.ts`          | Node (`ssr` project); the browsers                   |
| `primitives-web`  | [Exports](#web)                                             | `<x>.exports.test.ts`                               | Like parts                                           |
| `primitives-lynx` | [Parts](#lynx-primitives)                                   | `tests/components/<x>/…`                            | Node, Rstest, on the binding's engine fake           |
| `lynx`            | [The binding](#the-binding)                                 | `tests/<kind>/…`                                    | Node, Rstest; a few in Vitest                        |
| `lynx-polyfill`   | [The polyfill](#the-polyfill)                               | `tests/<kind>/…`                                    | Node, Rstest; PrimJS suites in CI                    |
| every package     | [Coverage and package checks](#coverage-and-package-checks) | `tests/coverage-baseline.json`, `publint`           | With the package's tests                             |
| primitives        | [Kinds per component](#kinds-per-component)                 | `tests/coverage-exemptions.json`                    | `pnpm lint`                                          |

## Modes

| Package           | Command             | Mode                             |
| ----------------- | ------------------- | -------------------------------- |
| `primitives-core` | `test`              | Normal                           |
| `primitives-core` | `test:async`        | Svelte's `experimental.async` on |
| `primitives-web`  | `test`              | `ssr` and `browser (chromium)`   |
| `primitives-web`  | `test:async`        | The same, async                  |
| `primitives-web`  | `test:webkit`       | `ssr` and `browser (webkit)`     |
| `primitives-web`  | `test:webkit:async` | The same, async                  |

`pnpm test` from the root runs only each package's `test`. A change to the primitives also passes
the other modes: `pnpm test:affected` runs `vitest related` on the changed files in each of them, so
a test runs when it imports a changed file, directly or through other modules. A change to core
reaches the web's tests too. Run one mode by hand with
`scripts/test-slot.sh pnpm -F @sohedra/primitives-web test:webkit:async switch`.

## Which layer proves what

Each behavior is proven once, at the lowest layer that can show it.

| Layer | Proves                                                                                                                                                                                                   | Leaves to others                                                                                                                                    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core  | Every decision: defaults, controlled and uncontrolled, refusals (disabled, read-only, cancel), what each fact means, timing through the fake scheduler, rules as tables of input and output              | Anything rendered                                                                                                                                   |
| Web   | What a user and a screen reader meet: roles, names, ARIA and data attributes, focus, real keys and pointer, the hidden input and `FormData`, server output and hydration, positioning, the part contract | Decision tables; it keeps one wiring case per intent, and the cases where the browser adds something (label clicks, native button keys, form reset) |
| Lynx  | State classes, `accessibility-*` attributes, tap and gesture wiring, layers, the part contract                                                                                                           | Decisions core proves; one wiring case per intent                                                                                                   |

## Core

`packages/primitives-core/tests/`, mirroring `src/`. Stores run in Node with no DOM, on the fake
platform (`tests/kit/kit-fake-platform.ts`): its scheduler is stepped by hand, and its services
throw unless the test scripts them, so a decision that asks the platform something unplanned fails.

- Build a store with one `setup(…)`: `$state` props, `bound(…)` for each bindable, the null
  contexts, and spies for the callbacks. Facts go to intents; a DOM event appears only as an opaque
  value.
- Effects run inside the kit's `track(…)` (`tests/kit/kit-effects.svelte.ts`), never a hand-written
  `$effect.root`.
- Time only through the fake scheduler. A file with runes ends `.svelte.test.ts`.

```sh
scripts/test-slot.sh pnpm -F @sohedra/primitives-core test switch
scripts/test-slot.sh pnpm -F @sohedra/primitives-core test:async switch
```

## Web

`packages/primitives-web/tests/`, mirroring `src/`. Vitest browser mode with Playwright; server
rendering in Node in the `ssr` project. Tests import the source through `#lib`.

- **Render** with `render` from `vitest-browser-svelte`; props change with `screen.rerender`.
- **Find** elements by role and accessible name, then by text or label; a test id only for a part
  with no role, or to tell two same-named parts apart.
- **Act** with `userEvent` from `vitest/browser`: real keys and pointer. A synthetic event only when
  no input can produce it (a visually hidden input, an untrusted event the test is about,
  composition, autofill, clipboard data, events on `window`), with a one-line comment saying why.
- **Assert** on the DOM with `await expect.element(locator)…`, which retries until it holds; plain
  `expect` for spies and values once a DOM assertion before it passed.
- **Time** that is behavior (`delay`, `closeDelay`) runs on fake timers. Anything else waits for a
  state: `expect.element`, `expect.poll`, `vi.waitFor`, the kit's frame helpers
  (`tests/kit/kit-frames.ts`). Animations are off unless a test turns them on.
- **Real input under fake timers** works with three conditions. Fake only the clocks:
  `vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance"] })`,
  so frames stay real (a real click doesn't open a popover in async mode without them). A
  `userEvent` action advances fake time by up to 50 ms, so a case timed within a few milliseconds of
  a boundary dispatches its event, with a comment. A retrying `expect.element` advances fake time
  too: read the DOM with a plain `expect` after the kit's `settle()`, and say so in the file's first
  comment.
- **Accessibility:** `<x>.a11y.test.ts` runs axe (`tests/kit/kit-axe.ts`) in each state, with a tree
  snapshot per state.
- **Server rendering:** `<x>.ssr.test.ts` checks what matters in the server output (`aria-*`,
  `data-*`, ids and their references, `hidden` on closed parts, the hidden input);
  `<x>.hydration.test.ts` hydrates it in the browser (`tests/kit/kit-server.ts`) and fails on any
  mismatch warning.
- **Engines** are gated inside a file with `it.skipIf(…)` and a reason, never by file name.

```sh
scripts/test-slot.sh pnpm -F @sohedra/primitives-web test switch
scripts/test-slot.sh pnpm -F @sohedra/primitives-web test:webkit:async switch-root
scripts/test-slot.sh pnpm -F @sohedra/primitives-web exec vitest run --project "browser (chromium)" -t "toggles with the Enter key"
```

## Lynx primitives

`packages/primitives-lynx/tests/`, on Rstest with `@sohedra/lynx/testing`: `render` and
`fireEvent.tap`, parts found by the classes the demo fixture gives them or by text, `waitFor` for a
state, `rs.useFakeTimers()` for durations. What only a phone shows (layout, animation, real touches,
screen readers) is checked on the playground with Lynx Explorer.

## Shared suites

A family's cases are written once, as a suite each member runs with its own setup. A suite takes
`(name, () => setup)`; the setup's type says what the fixture must contain (role, labels, test ids,
the props it maps), so a member can't run it with a fixture that lacks them. Cases are written in
the family's words ("the control").

| Suite                                                           | Members                                                                                                                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/conformance/conformance-part.ts` (`describeConformance`) | Every part: its element, extra props, handlers, class and style, state attributes, `bind:ref`, attachments, `render` and `children`, server rendering and hydration |
| `conformance-checked-control.ts`                                | Switch, then Checkbox and Radio                                                                                                                                     |
| `conformance-popup.ts`, `conformance-detached-triggers.ts`      | Popover, then every popup                                                                                                                                           |
| `conformance-field-control.ts`                                  | Planned, with the Field family                                                                                                                                      |

A part's conformance setup is a `const` in its component's `<x>.conformance.test.ts`, next to the
call that uses it; `conformance-setup.ts` types it. The suites' own components are in
`tests/conformance/fixtures/conformance-<idea>.svelte`.

Lynx runs its own twin of the part contract, with the web's case titles where the case is the same.

## File names

A component's tests mirror its source in `tests/components/<x>/`. `pnpm lint` checks the names
(`scripts/primitives-tests.ts`).

```
primitives-core   <x>-store.svelte.test.ts, <x>-<part>-store.svelte.test.ts, <x>-rules.test.ts
                  each may add .<topic> before .svelte.test.ts or .test.ts
primitives-web    <x>-<part>.test.ts            one part
                  <x>-<part>.<topic>.test.ts    one part, one topic, when the part file would pass
                                                600 lines or needs its own fixture
                  <x>.<topic>.test.ts           a topic that spans parts
                  <x>.conformance.test.ts  <x>.a11y.test.ts  <x>.ssr.test.ts
                  <x>.hydration.test.ts  <x>.exports.test.ts
                  fixtures/<x>-demo.svelte  <x>-in-form.svelte  <x>-in-field.svelte
                  fixtures/<x>-page.svelte  <x>-<scenario>.svelte
primitives-lynx   <x>-<part>.test.ts  <x>.<topic>.test.ts  <x>.conformance.test.ts
                  fixtures/<x>-demo.svelte  <x>-<scenario>.svelte
```

- **Topics, a closed list:** `form`, `field`, `keyboard`, `pointer`, `focus`, `dismiss`, `hover`,
  `nested`, `position`, `direction`, `transitions`, `portal`, `scroll-lock`, `typeahead`, `filter`,
  `selection`, `swipe`, `detached-triggers`, `lifecycle` (a popup's open pipeline over time),
  `bindings` (what only Svelte has: `bind:`, snippets, context, attachments), `reactivity` (effect
  and listener counts, teardown). A new topic is added here and in `scripts/primitives-tests.ts` in
  the same change.
- **Qualifiers,** after the topic: `.async` (async mode only), `.production` (its own `esm-env`
  mock), `.svelte` (runes in the file).
- **Every test folder** holds its test files flat and one flat `fixtures/` with its `.svelte`
  components, nothing else. `<x>-demo.svelte` is the component from all its parts, one props object
  per part, sized for a real pointer. `<x>-page.svelte` is it labelled as a page has it, for the
  accessibility and server tests. A scenario fixture's first comment says why the demo can't do it.
- **A file's layout:** its first line is a comment that says what it covers. Then imports (Vitest,
  the testing library, source, fixtures), one `setup(…)` if more than two cases build the same
  thing, and `describe("<X>.<Part>")` › `describe("<prop or situation>")` › `it("<sentence>")`.
  Titles are plain present-tense sentences of what the user or the store sees, no "should", unique
  in the file, about 90 characters at most. One behavior per test. A file over 600 lines splits by
  topic.
- **Helpers** go in `tests/kit/kit-<idea>.ts`, once three components need them. Each package's
  `setup-*.ts` files stay where its Vitest config names them.

## Kinds per component

`scripts/primitives-tests.ts`, part of `pnpm lint`. Each component needs:

- **core:** a store test for each `*-store.svelte.ts`, a rules test for each `*-rules.ts`;
- **web:** a test per part, `conformance`, `a11y`, `ssr`, `hydration`, `exports`, and the `demo` and
  `page` fixtures;
- **Lynx:** a test per part, `conformance` and the `demo` fixture;
- and every test file named by the scheme above (`scheme`).

A component without one lists it in its package's `tests/coverage-exemptions.json`, with a reason,
or `"todo: <what to write>"` for coverage still to write; a file off the scheme is listed as
`"scheme:<file>"`. An exemption for something the component now has fails, so the file only shrinks.

```sh
node scripts/primitives-tests.ts           # check
node scripts/primitives-tests.ts --list    # what each component is missing
```

## Break it on purpose

A test that still passes when the behavior is gone tests nothing. For each key behavior of a new or
changed component (a role or an `aria-` state, a key, a refusal, a label link, a focus return, the
submitted value), break it in the source (return early, skip a call), run the tests, check that one
fails, and restore the file. Say in the pull request how many breaks the tests caught.

## The binding

`packages/lynx/tests/`, grouped by kind with a subfolder per source area. Rstest; the Vitest
preset's own projects run in Vitest. Read `packages/lynx/AGENTS.md` first.

| Folder      | Holds                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------ |
| `threads/`  | Both threads of a page on the engine fake. `GENERATED_RUNS=500` tries more generated pages |
| `unit/`     | One module at a time                                                                       |
| `build/`    | Production, development and CLI builds of the fixture apps, and the size budgets           |
| `library/`  | Components tested through `@sohedra/lynx/testing`, as a component library would            |
| `contract/` | Rules about the source, the repository, the pinned Svelte build and the engine spec        |
| `types/`    | Checked by `pnpm check`, not run                                                           |

The engine fake has only what a device has, cites Lynx per behavior, and throws where a behavior is
unverified. The size budgets cover each thread's runtime alone and a minimal page's scripts: growth
there usually means code leaking from one thread to the other, so raising a budget is a deliberate
change, explained in its pull request.

```sh
scripts/test-slot.sh pnpm -F @sohedra/lynx test
scripts/test-slot.sh pnpm -F @sohedra/lynx test tests/threads
pnpm -F @sohedra/lynx check
```

## The polyfill

`modules/lynx-polyfill/tests/`: `unit`, `contract`, `package` and `speed` in `pnpm test`; the WPT
and test262 suites on PrimJS in `test:primjs`, which CI runs on main and on pull requests that
change the polyfill. Read `modules/lynx-polyfill/AGENTS.md` first.

## Coverage and package checks

- Coverage never drops below the package's `tests/coverage-baseline.json`; a pull request that
  raises it may raise the file, and `pnpm lint` fails when the file goes lower than on `main`. Only
  a whole run (a bare `pnpm test`) checks the floor: a run of one file measures part of the suite.
- Every package runs `publint` on its packed package. Every public entry has type tests, run against
  the packed package on TypeScript 6.0 and later.

## Reading a failure

- **Vitest** prints the failing assertion with a diff and exits non-zero. Browser mode saves a
  screenshot of each failed test under the package's `.vitest/` (ignored by git); delete it after
  long runs.
- **A failure under load isn't proof.** Rerun the file alone, several times, before you trust it or
  change code for it.
- **Rstest** prints the failing assertion the same way and exits non-zero.
