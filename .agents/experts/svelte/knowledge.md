# Svelte expert: knowledge

What the Svelte expert knows. Part 1 is Svelte itself, part 2 is how the primitives are built, part
3 is the checklist a review walks. Pinned to what the repository installs: Svelte 5.59.0 in every
package (`svelte` `~5.59.0` as a dev dependency). The primitives' peer range is `svelte ^5.57.0`:
anything newer than 5.57 that they use needs the floor raised, which is the maintainer's call. Lynx
packages pin `~5.59.0`, because custom renderers are experimental.

Last checked: 2026-11-28, against `node_modules/svelte` 5.59.0 (exports checked: `createContext`,
`getAbortSignal`, `fork`, `settled`, `hydratable`, `createRawSnippet`, `flushSync`, `tick`,
`untrack`; `svelte/attachments`: `createAttachmentKey`, `fromAction`; declaration tags in the
parser).

## 1. Svelte, as its docs write it

### Runes

- `$state` makes deep reactive state: objects and arrays become proxies. `$state.raw` is shallow
  (replace to update). `$state.snapshot` gives a plain copy for code outside Svelte. A proxy handed
  to a library isn't `===` the object it came from.
- `$derived(expr)` and `$derived.by(fn)` for anything computed. Deriveds are lazy and notify only
  when their value changes. A derived can be written to (5.25), which overrides it until its inputs
  change.
- `$effect` runs after the DOM updates, `$effect.pre` before. Effects don't run on the server.
  `$effect.tracking()` says whether code runs in a tracking context; `$effect.root` makes an effect
  outside a component's lifetime.
- **Effects are an escape hatch.** Writing `$state` in an effect to keep it in step with other state
  is the classic mistake: use `$derived`.
- `$props()` destructures props, with defaults and `...rest`; props stay reactive when destructured.
  `$props.id()` (5.20) gives an id stable across server and client. Type them with an
  `interface Props` (here, a named `<X><Part>Props` type) declared above.
- `$bindable()` marks a prop the parent can `bind:`. Without `bind:`, the parent's value only flows
  down, and a local write diverges until the parent passes a new value.
- Runes classes: `$state` and `$derived` fields are Svelte's own way to share reactive state. A
  field initialiser runs before the constructor body, so a derived that reads a constructor argument
  is `$derived.by(() => this.#props()…)`.
- Declaration tags (5.56): `{const label = $derived(labelOf(id))}` inside a block, replacing
  `{@const}`.

### Tracking

A read becomes a dependency exactly when a reaction is running and no `untrack` surrounds it.

| Context                                                                                                                                                     | Tracked               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `$derived`, `$effect`, `$effect.pre`, template expressions, render effects                                                                                  | Yes                   |
| `{@attach}` bodies                                                                                                                                          | Yes                   |
| Component setup (the script's top level, constructors called there), `{#if}`/`{#each}`/`{#key}` branches, `mount`                                           | No                    |
| Effect teardowns                                                                                                                                            | No                    |
| Handlers Svelte attaches (delegated, `on…` props, spread handlers)                                                                                          | No                    |
| Attribute setters, bindings                                                                                                                                 | No                    |
| Promise callbacks, `queueMicrotask`, timers, `requestAnimationFrame`, events the browser dispatches                                                         | No                    |
| A listener we add with `addEventListener`, for an event a reaction fires synchronously (`focus()`, `click()`, `dispatchEvent`, a removal that fires `blur`) | Yes, by that reaction |

`untrack(fn)` only turns tracking off around `fn`, and `$effect.tracking()` is the same condition,
so it tells you exactly whether an `untrack` at that spot does anything.

### Bindings

- `bind:value={x}` writes back to `x`. Function bindings (5.9) `bind:value={() => get, (v) => set}`
  let the parent validate or refuse; a refused write leaves the parent's value.
- A component can't tell "bound to a variable that is `undefined`" from "not bound" by the value.

### Snippets, attachments and rendering

- Snippets (`{#snippet name(args)}`) replace slots; `children` is the default snippet, rendered with
  `{@render children?.()}`; typed `Snippet<[Args]>`.
- `<svelte:element this={tag}>` renders a dynamic element.
- `{@attach fn}` (5.29) runs `fn(element)` when the element mounts and again when its dependencies
  change; the returned function cleans up. Attachments pass through props and spreads under a key
  from `createAttachmentKey()`; actions can't. `fromAction` turns an action into one.
- When a block is destroyed, Svelte removes its DOM first and runs effect and attachment cleanups
  after, so a cleanup can't find its element in the page. During an outro, effects are paused, not
  destroyed.
- `<svelte:boundary>` catches errors, and with async Svelte shows a `pending` snippet.

### Events

- Handlers are attributes: `onclick={fn}`. No `on:` directive and no modifiers in runes mode.
- Svelte delegates common events (`click`, `input`, `keydown`, `pointerdown`…) to the app's root, so
  a handler in markup runs after a native listener on the element itself. `on()` from
  `svelte/events` keeps the order with delegated handlers below it.
- `on()` adds pointer, touch and wheel listeners a microtask late, and a non-capture `on()` on an
  element outside the app root (a portal's) stops Svelte's delegated handlers there and above. Such
  listeners stay native `addEventListener`.
- Component events are callback props (`onCheckedChange`), never `createEventDispatcher`.

### Context

`setContext`, `getContext`, and `createContext<T>()` (5.40), which returns a typed pair whose getter
throws when nothing set it. Context is set during component init only.

### Server rendering and hydration

- A component's `<script>` runs on the server; `$effect`, `$effect.pre`, `onMount` and attachments
  don't. Hydration must match: no `typeof window` branches in markup, no locale-dependent text,
  `$props.id()` for ids.
- A component beside an element adds a `<!---->` marker to the server HTML.
- Module-level `$state` in a `.svelte.ts` file is shared by every request on the server.

### Async mode

`compilerOptions.experimental.async` enables `await` in markup and deriveds. In 5.59 an
already-resolved `await` inside a `<svelte:boundary>` renders after a microtask. An effect that
calls `flushSync` in async mode can depend on what the commit reads, and can throw.

### Custom renderers

Svelte 5.59 ships custom renderers (`svelte/renderer`), which `@sohedra/lynx` uses. They have no
element `bind:`, `transition:`, `in:`, `out:`, `animate:`, `{@html}`, `on:`, `<svelte:window>`,
`<svelte:document>`, `<svelte:body>`, `<svelte:head>` or `css: 'injected'`. Component `bind:prop`,
`{@attach}`, `use:`, `class:`, `style:`, spreads, `<svelte:element>`, `{#await}`, `{#key}`, snippets
and `<svelte:boundary>` work.

### Common mistakes to flag

- An `$effect` writing state a `$derived` should compute.
- `untrack` hiding a dependency, or written where no reaction runs.
- Props copied into `$state` (`let x = $state(props.x)` reads once).
- A prop read in a teardown instead of a captured value.
- DOM access during component init.
- An attachment key made inside a getter.
- Svelte 4 idioms: `on:`, `createEventDispatcher`, `<slot>`, `$:`, `export let`.
- `bind:this` or a transition in a part, which Lynx can't have.

## 2. How the primitives are built

Read `contributing/architecture.md`, then Switch (`primitives-core/src/components/switch/`,
`primitives-web/src/components/switch/`) and Popover. Core decides; the platform wires.

- **Stores** are runes classes in core with five numbered sections, built as
  `new XStore(props, deps)`. `props` is one function the store calls inside deriveds; `deps` holds
  each bindable as a `Bound` (`bound(get, set)`), contexts, ids and the platform. `Controllable`
  takes the `Bound` and knows when a function binding declined a write.
- **Intents** are arrow-function fields and the only writers; the part's handler calls one.
  `connect()` holds the store's effects and `watch`es; the root part calls it once.
- **`watch`** (`foundation/kernel/kernel-watch.svelte.ts`) is the one way a store reacts to another
  store, in `connect()`.
- **Parts** are `.svelte` files with four numbered sections and one `<Part>`
  (`primitives-web/src/foundation/kernel/kernel-part.svelte`), which renders `<svelte:element>` or
  the user's `render` snippet with `{ props, state }`, merging state hooks, own props, `bind:ref`,
  the user's props and `after` in that order.
- **Wiring** takes one of two forms, `useX(store, () => options, fixed?)` or, on a trigger whose
  popup a handle can swap, `useX(() => ({ popup, … }), fixed?)`. It returns `{ props, …named }` with
  its attachment inside the props, under a key made once. `Props` reaches `Part`; Svelte's element
  attribute types type what spreads on a plain element.
- **Contexts** come from `defineContext` (over `createContext`); a root sets the store, others get
  it with their part's name (`get("Popover.Title")`), or `getOr(NULL_…)` when it's optional.
- **State comes from core:** a part renders `store.state`, `store.<part>State` or the state of a
  store it builds (`PopupTriggerStore`), never an object of its own.
- **Refs** go through `attachRef` (`primitives-web/src/foundation/kernel/kernel-ref.ts`), which
  reads the bound ref a microtask after its element detaches, as `bind:this` does: a `$bindable`
  read inside a teardown still returns what its own component last wrote.
- **Async mode** is a test mode: both packages run their suites with `experimental.async` on.

## 3. Review checklist

1. `$props`, `$bindable`, `bind:`: `bind:checked` to an empty variable, a value passed without
   `bind:`, function bindings, a parent that refuses.
2. Snippets: `render` and `children` read naturally; attachments pass through spreads; nothing leans
   on `use:` or `bind:this`.
3. Effects: no `$effect` that should be a `$derived`, every effect commented, no state written in an
   effect causing a second pass, no `untrack` hiding a dependency or doing nothing, teardowns read
   captured values.
4. The store: `(props, deps)`, five sections, pure constructor, intents the only writers, state from
   core.
5. Context: a part outside its root gets the clear error; typing.
6. Server rendering and hydration: nothing touches the DOM during init, no marker beside a part's
   element, `$props.id()` ids.
7. Both platforms: only Svelte features custom renderers have.
8. Both modes: the behavior is the same with `experimental.async` on.
