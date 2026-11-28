# Svelte expert: decisions

What's already decided about the primitives' Svelte, and what's known and open. The expert never
re-raises a **Settled** item as a finding.

Last reviewed: none yet. Pass `--base` to `scripts/expert-scope.ts` until the first review sets a
commit here.

## Settled

- **One store per component, built as `new XStore(props, deps)`,** with five numbered sections, a
  pure constructor and intents as the only writers. A class per part was weighed and refused: each
  would need its platform twin.
- **A wiring returns props with its attachment inside,** under a key made once, so one spread
  applies everything. `{ props, attach }` was weighed and refused: two things to apply, and one can
  be forgotten.
- **A part's state object is built in core,** so the web and Lynx render the same object.
- **Shared Portal, Backdrop, Positioner, Arrow and Viewport are shared parts,** rendered under each
  component's own name. A part whose only node is one component adds no hydration marker.
- **No definition object per part,** and no generator. Consistency comes from the types, the tests,
  the twins (Switch, Popover) and the repository's checks.
- **File names are kebab-case, Svelte components too.**
- **Rule functions and intents keep their arguments;** they are not moved to options objects.
- **Messages name the parts the user wrote**
  (`Sohedra: <Popover.Trigger> must be placed within <Popover.Root>.`), never a store or a context.
  Every message starts with `Sohedra: `, through core's `warn` and `error`, and each text logs once;
  a throw is the same in every build. The primitives keep no message catalogue.
- **Wiring has two forms:** the store form, and the options form for a trigger-side wiring whose
  popup a handle can swap. Forcing one form would rebuild the wiring on every swap.
- **Two props types:** `Props` for what reaches `Part`, Svelte's element attribute types for what
  spreads on a plain element. One type would need a cast at every plain element, because of the
  symbol attachment slot.
- **Native listeners where `on()` is unsafe:** pointer, touch and wheel listeners that must be live
  at once, and non-capture listeners on portalled elements outside the app root.
- **A popup's inner wirings take one `PopupView`,** not a view type per wiring.
- **A trigger's data reaches its popup one update late, on purpose:** read straight from the trigger
  registry, an async content load would hold the whole trigger change, so the popup would stay on
  the old trigger instead of moving and showing the old content while the new loads.
- **The web's store element type stays `Element`.** `HTMLElement` would narrow the public
  `…ChangeEventDetails["trigger"]`; the casts to element types that remain are design-bound.
- **A handle's store is off its public type,** behind symbol keys.
- **Exports are explicit,** with no wildcard. The web has no `./foundation/<job>` subpaths: nothing
  outside imports its wiring.
- **The 500-line limit is a lint error** (the root config denies warnings). A file that is one idea
  keeps its disable comment, with the reason; the others split by idea.
- **Real `userEvent` works under fake timers** when only the clocks are faked; the conditions are in
  `contributing/tests.md`.
- **Component-to-component imports are a written list** (`contributing/architecture.md` § Imports),
  held by lint where it can. No second entry file per component.
- **No slot marker in the primitives.** The registry sets `data-slot` on the web and a slot class on
  Lynx.
- **No loading state in the primitives:** no built-in `<svelte:boundary>`, no `pending` prop, no
  `$state.eager` on triggers (an `aria-expanded` would claim a popup that isn't in the document).
  The registry owns the boundary and its skeleton; docs show the user-side boundary.
- **Not used in the library:** `<svelte:boundary>`, `fromAction`, `$host`, `hydratable` (ids come
  from `$props.id()`), element `bind:`, transitions and animations (Lynx can't have them).
- **A handler written after the spread in a `render` snippet replaces the part's own.** Documented,
  not fixed.
- **The focus manager stays one file:** one idea, a popup's focus on open, while open and on close.
- **While there are no users,** a public change needs the maintainer's word and an updated API
  snapshot, and no deprecation period.
- **Size budgets are a smell detector,** for side effects and dead code. Growth from design needs no
  decision.
- **Initial focus waits for `tick()`,** not one microtask, so content behind an already-resolved
  `await` in a boundary exists when focus moves (Svelte 5.59).

## Known and open (don't report again, check whether fixed)

- **A server-rendered Switch has no accessible name until it hydrates.**
- **Two workaround markers:** the repository's `@workaround` tag is to be the one; the primitives'
  `// WORKAROUND(<target>)` lines are not converted yet, and the tag has no kinds for browsers or
  Svelte bugs yet.
- **`<Popover.Popup id={null}>`** (Svelte's attribute types allow `null`) renders no id while the
  claim falls back to the generated one, so `aria-controls` names an id nothing has. `null` and
  `undefined` should both keep the generated id.
- **Casts that can be false:** event targets read `as Element` and event types narrowed by a cast
  (`MouseEvent` to `PointerEvent`) need runtime checks, each with an edge-case test.
- **A WebKit flake:** Popover's "multiple triggers › allows controlling the open state and active
  trigger programmatically" (contained and detached) fails now and then in full WebKit runs.
- **Tree snapshots don't show `aria-readonly` or `aria-required`;** those stay direct attribute
  checks.
- **`.ssr` tests run in Node only,** so a server check that needs a browser lives in `.hydration`.
- **Svelte changes to watch:** sveltejs/svelte#18957 (an effect that calls `flushSync` in async mode
  tracks what the commit reads, and may throw: keep the `untrack` around such a `flushSync`) and
  sveltejs/svelte#14784 (`untrack` would stop allowing writes inside deriveds and templates).

## Revisit

Nothing yet.
