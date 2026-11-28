---
name: sohedra-write-code
description:
  Writes and edits Sohedra code (the primitives in core, on the web and on Lynx, the binding, the
  modules, tests and scripts) the way a Svelte and Lynx expert would, starting from the twin that
  already does the job, then checks it with the repository's checks, the tests it reaches and a cold
  read. Use whenever you write or change code in this repository, before you call the change done.
metadata:
  internal: true
---

# Write Sohedra code

The bar: a Svelte expert reads the file and says "this is how I'd write it", and anyone else reads
it top to bottom without stopping. Readable first, then fast, never clever.

## 1. Find the twin

Every piece of code here has a twin that already does it well. Open it before you write a line, and
copy its shape, names, sections and order. Paths are under `packages/`.

| You're writing                                      | Start from                                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A control's store (Checkbox, Radio, Toggle)         | `primitives-core/src/components/switch/switch-store.svelte.ts`                                                     |
| A popup's store                                     | `primitives-core/src/components/popover/popover-store.svelte.ts`, on `foundation/popup/popup-store.svelte.ts`      |
| A part's state a shared part holds                  | `primitives-core/src/foundation/popup/popup-trigger-store.svelte.ts`, built in `popover-trigger.svelte`            |
| A component's pure decisions                        | `primitives-core/src/components/popover/popover-rules.ts`                                                          |
| A handle for detached triggers                      | `primitives-core/src/components/popover/popover-handle.ts`, on `foundation/popup/popup-handle.svelte.ts`           |
| A core building block a store owns                  | `primitives-core/src/foundation/kernel/kernel-controllable.svelte.ts`                                              |
| A checked control's parts                           | `primitives-web/src/components/switch/`, on `useCheckedControl` (`foundation/form/form-checked-control.svelte.ts`) |
| A popup's parts                                     | `primitives-web/src/components/popover/`, on the jobs `popup`, `position`, `portal`, `dismiss`, `focus`, `hover`   |
| A part that only reads a context and renders        | `primitives-web/src/components/switch/switch-thumb.svelte`                                                         |
| A Title, Label or Description another element names | `primitives-web/src/components/popover/popover-title.svelte`, on `useClaimedId`                                    |
| A pressable part (Close, Trigger)                   | `primitives-web/src/components/popover/popover-close.svelte`, on `useButton`                                       |
| A wiring two components share                       | `primitives-web/src/foundation/form/form-checked-control.svelte.ts`                                                |
| A trigger-side wiring (the options form)            | `primitives-web/src/foundation/hover/hover-trigger.svelte.ts`                                                      |
| A shared part                                       | `primitives-web/src/foundation/position/position-anchored-arrow.svelte`                                            |
| A component's namespace, types, hooks, contexts     | `primitives-web/src/components/switch/switch-{parts,types,attributes,context}.ts` and its `index.ts`               |
| A package entry                                     | `primitives-web/src/index.ts`, `primitives-core/src/index.ts`: explicit exports, one statement per component       |
| A Lynx part                                         | Its web twin, with Lynx's elements, `ui-<state>` classes and `accessibility-*` attributes                          |
| A store test                                        | `primitives-core/tests/components/switch/switch-store.svelte.test.ts`                                              |
| A part test                                         | `primitives-web/tests/components/switch/switch-root.test.ts`, `switch-thumb.test.ts`                               |
| Conformance, a11y, server, hydration tests          | `primitives-web/tests/components/switch/switch.{conformance,a11y,ssr,hydration}.test.ts`                           |
| A popup's tests                                     | `primitives-web/tests/components/popover/`: the popup suites in `popover.conformance`, time in `popover.hover`     |
| An entry's exports test                             | `primitives-web/tests/components/popover/popover.exports.test.ts`                                                  |
| Fixtures                                            | `primitives-web/tests/components/switch/fixtures/switch-{demo,in-form,page}.svelte`                                |
| A family suite                                      | `primitives-web/tests/conformance/conformance-checked-control.ts`                                                  |
| Binding code                                        | The nearest file in the same program folder of `lynx/src/`, after `lynx/AGENTS.md`                                 |
| A repository check                                  | `scripts/styling-hooks.ts`: returns problems, with its reasoned exemptions; called from `scripts/check-repo.ts`    |

- The family recipes in `contributing/primitives-recipes.md` say which shared wiring or part a new
  component's family uses. A recipe that exists is called, never copied.
- If two twins disagree, the shape is wrong in one of them. Say so instead of picking one.
- Copy a twin's shape, not its comments.

## 2. Load the platform

Read the expert's `knowledge.md` (part 1 and "Common mistakes to flag") and `decisions.md` for every
platform you touch: `.agents/experts/svelte/` for any Svelte code, `.agents/experts/lynx/` for the
binding, the modules, the Lynx primitives and the playground. They are pinned to the versions this
repository installs; trust them over memory. Fetch the Svelte docs you need (Svelte MCP:
`list-sections`, then `get-documentation`) before you write Svelte.

Then read `contributing/architecture.md` for the shape and `contributing/code.md` for the rules. The
ones that make code look generated when missed:

- **Decisions in core.** A part's handler calls one intent; a part that grows an `if` about what
  happens, a focus call or a state object of its own is in the wrong layer.
- **One shape.** `new XStore(props, deps)`, a wiring in one of its two forms returning
  `{ props, …named }`, numbered sections, files named `<folder>-<idea>` after their main export, the
  word list.
- **Effects last.** A `$derived` first; every effect carries the comment that says what it keeps in
  step; teardowns read captured values.
- **No comment by default.** One only when a reader would get the code wrong without it, three lines
  at most. Doc comments on what code.md lists.
- **No defensive code for cases the types rule out,** and no helper for one caller.

## 3. Write it

Write the change and its tests together. A fix starts with the test that fails without it. Run the
Svelte autofixer (`svelte-autofixer`) on every `.svelte`, `.svelte.ts` and `.svelte.js` file you
write until it reports nothing.

## 4. Check it

Run each and check the exit code, not the output:

```sh
pnpm lint            # oxlint and the repository's checks: layout, names, styling hooks, comments,
                     # doc comments, dead exports, test kinds
pnpm format:check
pnpm -F <package> check
pnpm -F <package> build
pnpm test:affected   # the tests your change reaches, in every mode, through the test slots
```

Fix what each reports and run it again until all pass. For a new or changed behavior, break it on
purpose (return early, skip a call), run its tests, see one fail, and restore the file.

## 5. Read it cold

Read the whole diff as the platform's expert would, with the "Review checklist" in each
`knowledge.md` you loaded and the list at the end of `contributing/code.md`, and as a teammate who
has never seen it. If you can name a more idiomatic version, write that one.

## 6. Unslop

Run `sohedra-unslop` on your diff. The change isn't done until it has. Before merging a change the
experts reach, run `sohedra-expert-review`.
