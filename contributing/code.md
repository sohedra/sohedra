# Code

Write code a skilled team would be glad to read, review and extend: readable first, then fast, never
clever for its own sake. The rules hold in every package; the primitives add the ones marked
**Primitives**. `pnpm lint` checks what a script can, and every new convention lands with its check.

## Style

- American English, second person, present tense, active voice, in code, docs, commits and pull
  requests. Headings in sentence case, starting at level 2. Platforms in the order "iOS, Android and
  web"; version ranges as "Lynx 4.2 and later". No emoji.
- File names are kebab-case, Svelte components too (`switch-root.svelte`).
- `pnpm format` (oxfmt) formats every file: tabs, sorted imports. `pnpm format:check` checks.

## Shape

- **Functions first.** A class only where state and identity live, such as a renderer or a store.
- **Named exports,** except where a host reads the default export: `.svelte` components, Svelte's
  custom-renderer module, bundler loaders and tool config files.
- **An exported function with more than two arguments takes an options object,** unless a standard,
  Svelte, Lynx or a host dictates its signature, or it is a private function on a hot path.
  **Primitives:** a store or building block takes `(props, deps)`, a wiring one of the two forms in
  [architecture.md](architecture.md#wiring), and rule functions and intents keep the arguments they
  have.
- **Exported functions state their types** (`isolatedDeclarations`, where a package turns it on).
- **Type escapes** (`as`, `any`, `@ts-expect-error`) only at boundaries, such as thread entries and
  untyped Svelte or Lynx APIs, each with a one-line comment that starts with `Boundary:` and names
  the published type that doesn't fit and why, true for the installed version. Without that reason,
  use the published type. `unknown` plus narrowing, never `any`.
- **`interface`** for an object shape, **`type`** for a union, a function type or a mapped type.

## Design

- **Match by identity, not by position or text.** Pair two things by an identity the system gives
  you: a key, a mark, a resolved path. Order, shape and string patterns are guesses.
- **Ask the source of truth.** When a dependency already knows the answer (the bundler's resolved
  module, the compiler's AST, a published type), use its answer.
- **Each decision lives in one place.** When two files decide the same thing, one owns it and the
  other asks. Before you write a helper, look in the foundation jobs; when two components need it,
  move it there in the same change.
- **No silent failure.** A `catch` reports, rethrows, or says in a comment why ignoring is correct.
- **Wait for a condition, not for time.** No fixed timeouts, delays or round counts in code or
  tests; wait for the state you need, with a bound that fails saying what it waited for. The delays
  that exist are behavior: a prop (`delay`) or a named constant (`OPEN_DELAY`).
- **Handle the general case, or refuse it loudly.** A known gap is a workaround tag or a test marked
  as a known failure, never an unmarked assumption.
- **No dead code:** no commented-out code, unused exports, leftover probes or `console.log`.
  **Primitives:** `pnpm lint` fails on an exported value nothing imports and no public entry
  reaches. Code with no user yet moves in with its first user, unless that user is the next
  component to move in.

## Files and folders

- Each top folder of a package has one `index.ts`, its only face to the other folders. The lint
  config sets which folder may import which.
- Name every folder and file for what it holds. No `shared`, `helpers`, `utils` or `common`.
- A file over 400 lines must be one concept: a prompt in review. **Primitives:** a source file over
  500 code lines fails lint (`max-lines`; the root config denies warnings). It is split by idea,
  never by size; one that is one idea keeps the disable comment, with its reason.
- **Primitives:** the layout, the file set and when code gets its own file are in
  [architecture.md](architecture.md#folders-and-files).

## Names (primitives)

A name's first or last word says what it is. The list is closed.

| Word                             | Is                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `…Store`                         | A core class with state or lifetime work, built by a part or a handle                    |
| `…StoreProps`, `…StoreDeps`      | The two constructor arguments of a store; a building block's are `…Props` and `…Deps`    |
| `<x>-rules.ts`                   | Pure decisions                                                                           |
| `use…`                           | Called once while a part initialises; may read contexts and start effects; returns props |
| `attach…`                        | Returns an attachment                                                                    |
| `define…`                        | Makes a definition at module scope, with no effect (`defineContext`)                     |
| `create…`                        | Returns a new object and starts nothing (`createChangeEventDetails`)                     |
| `is…`, `has…`, `can…`            | Answers yes or no, with no effect                                                        |
| `…Context`, `…View`              | A defined context; an interface of what a wiring or an owned object reads of a store     |
| `…Options`                       | A call's options: what a `use…` function's options function returns, or an argument      |
| `…State`, `…Props`               | A part's public state, and nothing else; a part's public props                           |
| `…Details`, `…Reason`, `…Source` | A change's details, its reason, the facts the platform saw                               |
| `…Handle`                        | The object a user creates to drive a component from outside                              |
| `connect()`                      | A store's lifetime method. Never a free function                                         |

Not used: `…Intent` (a class with state is a `…Store`), `…ContextValue` (a context holds a store or
a `…View`), `…Config`, `…Manager`, `…Facts`, `…Host`, `…Scope`, `…Helper`, `…Util`. `pnpm lint`
checks the endings and `…State` (`scripts/primitives-names.ts`). One name per idea: `anchorElement`,
`popup` (not floating), `claim`, change details `{ event, trigger }`, "trigger change". One meaning
per word: a _part_ is one public piece (not a slot), a _store_ holds state and decisions (not a
model or machine), an _intent_ proposes a change (not an action or setter), a _rule_ decides (not a
helper or policy), a _fact_ is a plain value a platform passes (not a payload), a _handle_ drives a
component from outside (not a controller), the _platform_ is what core gets from where it runs (not
a host or adapter). Names are full words; booleans read as questions (`isOpen`).

## Classes (primitives)

- Private state is a `#` field; `protected` only for what a subclass passes or overrides.
- Public state is a `readonly` field with `$derived`, or a getter over a private field. A user's
  change is an intent, never a public setter: it carries details and can be refused.
- An intent is an arrow-function field, so a part can hand it over; a method only when a subclass
  overrides it. Queries and `connect()` are methods.
- `$state` only for what something reactive reads; a field nothing renders from is a plain field.
  `$state.raw` for an element, a foreign object, and data that is replaced and never mutated.
- A constant that depends on nothing in the instance is made once: in `<script module>` when one
  component uses it, in a `.ts` file when anything else imports it.

## Effects

- Reach for a `$derived` first, then the event handler, then an attachment, then `watch`, and only
  then `$effect`. State that follows state is a `$derived`, writable when an intent overrides it. A
  reset on a change is written in the intent that makes it.
- A reaction from one store to another is a `watch` in the reacting store's `connect()`. A store may
  register with another store; it never writes another store's state from an effect.
- Effects in parts and wiring are for the platform only: native input values, measuring, focus,
  listeners.
- **Every effect and `watch` has a comment right above it** that says what outside thing it keeps in
  step, in one line where it can. `pnpm lint` checks it.
- Deriveds are pure. Teardowns read captured values, never props: a prop read in a teardown can be
  stale (see [pitfalls.md](pitfalls.md)).
- The library behaves the same with Svelte's `experimental.async` on and off, so a decision is made
  in the handler or intent, not in an effect that hopes to run first.
- **`untrack` only where a reaction is running.** A read becomes a dependency exactly when a
  reaction is on the stack and no `untrack` is around it. That is inside `$derived`, `$effect`,
  template expressions and attachment bodies, and in anything they call synchronously: intents a
  reaction calls, and our own DOM listeners for events a reaction can fire synchronously
  (`el.focus()`, `el.click()`, `dispatchEvent`, a removal that fires `blur`). `untrack` does nothing
  in teardowns, in handlers Svelte attaches, in constructors called from component setup, and in
  promise, timer and frame callbacks: leave it out there. `$effect.tracking()` tells you which case
  you are in. Never use `untrack` to silence a loop.
- `flushSync` only on a platform, where an event handler must see the DOM updated before it returns,
  with a comment.

## Comments

- **A comment says what the code can't:** a constraint, a reason, a trap. Never what the next line
  does, what a value holds or how the pieces connect, and never the history of a change: that goes
  in the pull request's Why.
- **Three lines at most.** An explanation that needs more goes in `contributing/`, a test title or
  the pull request. `pnpm lint` checks the comments a branch adds in the primitives, counting the
  lines with text.
- **Standing comments:** a part's and a store's numbered section markers, and the line above each
  effect, `watch` and `flushSync`.
- **Never in the primitives:** the name of the library the API started from (only `NOTICE.txt` names
  it), words about what the code matches or where it came from, an earlier package of ours, or a
  private label (a list and its numbers, a review round). A difference a user must know is written
  as behavior. `pnpm lint` checks it, with the word list in `scripts/comments.ts`.
- **Doc comments** on every public API: the API reference is generated from them. **Primitives:**
  every part's file starts with a `<!-- @component -->` comment (what it is, the element it
  renders); every public prop, state field, data attribute and CSS variable has one, with `@default`
  where there is one; and internals get one sentence on every exported function, every public member
  of a store, and every field of a `…StoreProps`, `…StoreDeps` and `…Options` type. `pnpm lint`
  checks exported functions and classes and the fields of exported `…Props`, `…Deps`, `…Options` and
  `…State` interfaces (`scripts/doc-comments.ts`).
- **Markers:** `// TODO(refactor): …` for something meant to change, saying what and why. No other
  `TODO`s.

## Errors and warnings

- **The first line is a plain sentence saying what went wrong,** in the developer's names: their
  function, component or value. Then where (thread, component, `file:line:col`), one concrete next
  step, and a docs link with a stable snake_case code. Never the package's internal words.
- Each area of a package keeps one catalogue of its messages, each with its fix line and docs page;
  a test fails when an entry lacks either, and every message has a snapshot test. Warnings appear
  only in development builds, once per place. An error that repeats is shown once, with a count,
  until it has been quiet for five seconds. On Lynx, errors go through `lynx.reportError` with
  Lynx's codes and levels.
- **Primitives,** in place of the catalogue, the docs link and "once per place":

  | Situation                         | What happens                                                  |
  | --------------------------------- | ------------------------------------------------------------- |
  | The part can't work               | `throw`, the same in every build (a part outside its root)    |
  | The usage is wrong but renders    | `error(…)`: `console.error`, development only, each text once |
  | The usage is probably not meant   | `warn(…)`: `console.warn`, development only, each text once   |
  | The user did something it refuses | Nothing: the intent returns `false`                           |

  Every message starts with `Sohedra: `; `warn` and `error` (core's kernel) add it, run only when
  `DEV` from `esm-env` is true, and log each text once. Development-only code sits inside
  `if (DEV)`. A message names the parts the user wrote, says what is wrong, then what to do: a part
  outside its provider gets `missingProviderMessage`'s text,
  `Sohedra: <Popover.Trigger> must be placed within <Popover.Root>.` No message names a store or a
  context.

## Workarounds

Code that exists because of something outside our control says so where it lives.

- Repository-wide: a `@workaround` JSDoc tag with a name, a kind (`lynx-limit`, `lynx-bug`,
  `lynx-gap`, `svelte-internal` or `tooling`), the public upstream issue if there is one, and when
  it can go: `/** @workaround proxy-accessor-setter kind=lynx-bug delete-when="…" */`. A test reads
  every tag and generates the list, the checklist for a Lynx or Svelte upgrade. A workaround gets
  its own file only when it is file-sized. Where an upstream change can be detected, a canary test
  fails when it happens and says which workaround can go.
- **Primitives:** a browser or engine workaround starts with
  `// WORKAROUND(<target>): <what is wrong>. Remove when <…>. <link>`, with the target one of
  `safari`, `firefox`, `chromium`, `ios`, `android`, `svelte`, `lynx`. A user-agent check is always
  one.

## Performance

- Per-frame math is a pure function over plain values, outside any store, so Lynx can run it on its
  main thread; only the end of a gesture is a store call.
- A handler that runs on every pointer move allocates nothing it can avoid and writes no `$state`.
- Listeners exist only while needed: a document listener is added when the popup opens.
- A derived an effect depends on is compared by value where its inputs change often
  (`keepShallowEqual`).
- Measure before optimizing, and say what you measured. Size budgets flag side effects and dead
  code; growth from design is fine.

## Before you finish: review your own diff

Read it as a strict reviewer would, then run `sohedra-unslop`:

1. Is every decision in a core store or rules file, and does core stay free of the DOM?
2. Is every store built with `(props, deps)`, in the section order, with a pure constructor and
   intents as the only writers?
3. Does every `use…` take one of the two wiring forms, return `{ props, …named }` and start its own
   effects?
4. Does every handler call one intent, with no behavior `if`? Does the part's state come from core?
5. Is every derived pure, does every effect say what it is for without copying state, and do
   teardowns read only captured values?
6. Does the component use its family's recipe ([primitives-recipes.md](primitives-recipes.md)), or
   is it a listed exception?
7. Do the files, names and imports follow [architecture.md](architecture.md)?
8. Does a change to the `Platform` contract only add an optional member, an optional trailing
   parameter or a wider return type?
9. Did a test assertion, server output or public type change? Then it is a behavior change: say so
   in the pull request.
10. Is any name unclear, any function doing two things, anything duplicated, any comment the code
    would read as well without?
