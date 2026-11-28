# Contributing

Everything you need to work on Sohedra, for people and agents alike. Start with the root
`AGENTS.md`, then read what your task needs. How to report a bug, open a pull request and use AI
tools is in [CONTRIBUTING.md](../CONTRIBUTING.md).

| File                                                       | What's in it                                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [architecture.md](architecture.md)                         | The packages and their imports, the binding's threads, and the primitives: core, platforms, the registry |
| [code.md](code.md)                                         | How code is written: names, files, shape, design, comments, errors, workarounds                          |
| [primitives-recipes.md](primitives-recipes.md)             | What several components share, written once: each recipe, its members and its exceptions                 |
| [tests.md](tests.md)                                       | Every kind of test, where it runs and the exact command                                                  |
| [pitfalls.md](pitfalls.md)                                 | What cost real debugging time: Svelte 5.59, Lynx, browsers, tools                                        |
| [../.agents/skills/README.md](../.agents/skills/README.md) | The skills for working here, and when to use each                                                        |

## The repo

- `packages/lynx`: the binding, `@sohedra/lynx`. Svelte's custom renderer on Lynx's background
  thread, Lynx's elements on the main thread, the build plugin and the test library.
- `packages/primitives-core`: the state and decisions of the components, shared by the web and Lynx.
  It never touches the DOM.
- `packages/primitives-web`: the components for Svelte on the web.
- `packages/primitives-lynx`: the same components on Lynx (not in yet).
- `modules/lynx-polyfill`: the web's standard APIs and the language on both of Lynx's threads.
- `playgrounds/lynx`: a Svelte page on Lynx, built with rspeedy, for Lynx Explorer on a phone.
- `.agents`: the skills for working here and one expert per platform (Svelte, Lynx).
- `scripts`: the repository's own checks (`pnpm lint` runs them, and each runs alone with
  `node scripts/<check>.ts`), the test slots and the test plan.

## Where things stand

Nothing is published yet. The binding and the polyfill are in. The primitives are moving in family
by family: Switch (a checked control) and Popover (a popup) are done in core and on the web, and
they are the twins every later component copies. Lynx's primitives move in once every component is
in core and on the web, with the web as their reference. Then the native framework and the router,
in that order (see the root `README.md`).

## How we work

- **Small steps, each green.** A change ships with the tests that prove it, and a fix with the test
  that fails without it.
- **Decisions in core, wiring on the platform.** A component's behavior is decided once, in
  `primitives-core`, and both platforms render it.
- **Start from the twin.** Every new piece of code copies the file that already does the same job:
  the table is in [sohedra-write-code](../.agents/skills/sohedra-write-code/SKILL.md). If two twins
  disagree, one of them is wrong: say so instead of picking one.
- **One shape everywhere.** Every component has the same file set, sections and wiring contract.
  When something is right for one component and not the rest, the shape is wrong.
- **Ask before changing what users see.** A public API's name or shape, a new component, package or
  runtime dependency, a change to the `Platform` contract beyond an optional addition, raising the
  Svelte floor, and exceptions to pnpm's release-age gate (`minimumReleaseAgeExclude`) need the
  maintainer's word. Internal layout, tests and tooling don't.
- **Parallel sessions** each get their own git worktree and their own ports, and run browser tests
  through `scripts/test-slot.sh`.
- **Gates.** Before a pull request is ready: `pnpm lint` (oxlint and `scripts/check-repo.ts`),
  `pnpm format:check`, `pnpm check`, `pnpm build`, `pnpm test`, and `pnpm test:affected` for the
  modes a full run leaves out. The git hooks format and lint staged files and run the checks before
  a push; when one fails, fix what it reports and push again. Check exit codes, and rerun only what
  failed.
- **Experts.** Before merging a change that reaches the primitives, the binding, a module or a
  playground, run the `sohedra-expert-review` skill. `node scripts/expert-scope.ts` shows which
  experts it reaches.
