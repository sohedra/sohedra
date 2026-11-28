# Architecture

How the code is shaped: the packages and what each may import, the binding's two threads, and the
primitives (a core without the DOM, one package per platform, and the registry on top). Read it
before you add a package, a component or a foundation job.

## Packages

| Package                                      | Holds                                                           | May import                                                      |
| -------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| `modules/<name>`                             | A Lynx module any Lynx app can use, whatever its framework      | Nothing of this repository. Its `svelte` subpath imports Svelte |
| `packages/lynx` (`@sohedra/lynx`)            | The binding: Svelte's custom renderer on Lynx, its build, tests | Nothing of this repository                                      |
| `packages/primitives-core`                   | The components' state and decisions, for both platforms         | `svelte`, `svelte/reactivity`, `esm-env`, `@floating-ui/core`   |
| `packages/primitives-web`, `primitives-lynx` | The components on one platform                                  | Core; Lynx's also the binding                                   |
| `playgrounds/<name>`                         | Pages that run the packages on a device                         | Any package                                                     |

- A package that runs on both platforms says so in its manifest, as
  `"sohedra": { "runsOn": ["web", "lynx"] }`, and never imports `@sohedra/lynx`: it uses Svelte's
  own APIs and `esm-env`. `pnpm lint` checks it (`scripts/shared-packages.ts`).
- The binding is the one package that touches Svelte's custom-renderer API or Svelte's internals.
- Every package has its own `tsconfig.json`; the root has none, so the editor and `svelte-check`
  read each file with its own package's settings. A Lynx package sets
  `"svelteOptions": { "namespace": "svelteLynx" }` there, and its `svelte.config.js` uses the
  binding's config (`@sohedra/lynx/config/svelte`).
- A package's own settings live in it: build output in its `.gitignore`, anchored (`/lib/`, since
  `lib/` also hides SvelteKit's `src/lib/`), and lint rules in its `.oxlintrc.jsonc`, extending the
  root's. oxlint reads their globs from the package. Which folder may import which is set there
  (`no-restricted-imports`, and `import/no-cycle` everywhere), so a wrong import fails `pnpm lint`.

## The binding and Lynx's threads

Lynx runs a page on two threads. Svelte and the app run on the background thread; the main thread
draws Lynx's elements, runs main-thread functions and, for the first frame, runs the page the way
Svelte's server would. Read `packages/lynx/AGENTS.md` and `packages/lynx/GLOSSARY.md` before you
change the binding.

- A file both threads load reaches thread-specific code only through a package entry that resolves
  by thread (`worker` is the main thread), never by a relative path.
- Each folder of the binding's `src/` is one program and names its thread's globals only in its
  `globals.ts`.
- Svelte's internals are touched only in `packages/lynx/src/svelte/`, and every touch is a row of
  its `manifest.ts`, which a contract test checks.
- **The Svelte minor.** Svelte's custom renderers are experimental and a minor may break them, so a
  Lynx package's Svelte peer range ends at a minor (`~5.59.0`). To support the next one, widen the
  range (`~5.59.0 || ~5.60.0`) on a branch, update the dev copy, and merge once the tests and the
  manifest checks pass.
- **What custom renderers lack:** element `bind:`, `transition:`, `in:`, `out:`, `animate:`,
  `{@html}`, `on:`, `<svelte:window>`, `<svelte:document>`, `<svelte:body>`, `<svelte:head>` and
  `css: 'injected'`. Don't use them, offer them or build stand-ins for them.

## Primitives

Headless, unstyled, accessible components. Three packages: `primitives-core` decides,
`primitives-web` and `primitives-lynx` render. Components move in on the web and in core first; Lynx
follows once they are there, with the web as its reference: a Lynx part has every part and prop of
its web twin that the platform allows, and says in its doc comment why it leaves one out.

### Core decides; a platform wires

- Core holds the stores, the rules, the popup pipeline, the behavior table and the types. It names
  no element, no DOM type and no web global, and targets ES2019 (`lib: ["ES2019"]`, no DOM library).
  Its lint config refuses the globals by name.
- A platform tells core what it saw as plain facts (`"mouse"`, a size, an element handle, "the press
  began here"), and core decides what that means. How a platform learns a fact stays in it.
- A finding on Lynx changes core only if the change is right for the web too. An addition to core is
  fine when it takes nothing away from the other platform.

### The Platform contract

`foundation/kernel/kernel-platform.ts` in core. It is everything core gets from where it runs:

| Service     | Gives                                                                     |
| ----------- | ------------------------------------------------------------------------- |
| `scheduler` | `timeout`, `frame`, `microtask`, `now`. Core takes time from nothing else |
| `order`     | `compare(a, b)`: document order of two element handles                    |
| `focus`     | `focus(target, options)`                                                  |
| `locale`    | Number formatters and collators                                           |
| `form`      | What a form submission needs                                              |

- It is synchronous, and facts travel with the calls that need them. A scheduler never runs a
  callback before the call that scheduled it returns.
- It only grows: a new optional member, a new optional trailing parameter or a wider return type.
  Any other change needs the maintainer's word.
- A capability one platform lacks is an input of the store that needs it, not a member of
  `Platform`. A handle's detached store runs on `inertPlatform`.

### Stores

A store is a runes class in core: one per component (`SwitchStore`), a `<X><Part>Store` for a part
that holds state its root doesn't, and in a job, a store for what a shared part holds
(`PopupTriggerStore`, `PositionerStore`). Every class in a component folder is a `…Store`, or the
component's `…Handle` (`PopoverHandle`). Building blocks a store owns keep a plain noun and live in
`foundation/`: `Controllable`, `ClaimedValue`, `CommittedValue`, `Presence`, `Timeout`,
`DismissInteraction`, `HoverInteraction`, `FieldControlLink`. A popup's open pipeline is
`PopupStore`'s own.

- **Five numbered sections, in order:** `// 1. Inputs`, `// 2. Owned objects`, `// 3. Public state`,
  `// 4. Intents`, `// 5. Lifetime`. `pnpm lint` checks them.
- **Built one way:** `new XStore(props, deps)`. `props` is one function returning everything that
  can change, called inside deriveds and intents, never copied. `deps` is one object with what is
  fixed: each `$bindable` as a `Bound` under the prop's name (`checked: bound(get, set)`), contexts
  and peer stores, ids made once (`defaultPopupId`), the platform, a fixed variant. A store with no
  props takes `(deps)`; one that needs nothing takes no argument. A popup's store calls
  `super(props, { ...deps, kind })`. A building block takes `(props, deps)` too, named `…Props` and
  `…Deps`; a value class (`SafePolygon`, `Timeout`) takes its values in order.
- **The constructor is pure.** It reads no context and starts no effect, so a handle can build a
  store at module scope. `connect()` holds the lifetime work (effects, `watch`es, registrations);
  the part that builds the store calls it once, and a store connects what it owns.
- **Intents are the only writers.** An intent is an arrow-function field (a method only when a
  subclass overrides it). Its arguments are the value it proposes, the change details, then the
  source facts. One that can be refused returns `boolean`. An intent refuses a user's change on a
  control that is not interactive, so a part never decides that.
- **Pure decisions** live in `<x>-rules.ts`: plain values in, plain values out. Rule functions keep
  the arguments they have.
- **State comes from core.** A part's public state is `store.state`, a `$derived` named
  `store.<part>State` (`popover.titleState`, `positioner.arrowState`), the `state` of a store the
  part builds (`PopupTriggerStore`), or a rule when it reads two stores. The web and Lynx render the
  same object.
- Controlled and uncontrolled values go through `Controllable` with a `Bound`. Nobody hand-writes
  `value`, `defaultValue` and `onValueChange` handling.
- One level of inheritance at most (`PopoverStore extends PopupStore`). Public fields state their
  type; private state is a `#` field.

### Contexts

Defined with `defineContext` in the platform's `<x>-context.ts`, named `<X><Part>Context`; core
never reads one. The root calls `Context.set(store)`, the others `Context.get("<X>.<Part>")`, which
names the part in its error, or `Context.getOr(fallback)` when the context is optional. A context
holds a store, a null store, a building block (`PopupTree`), a `…View` (an interface of getters)
where a group hands its items less than a store, or a plain id (a popup node's). A context two
components read lives in the `foundation/<job>/` of its idea.

### Parts

A part is one `.svelte` file: a `<!-- @component -->` doc comment, a script with numbered sections,
then one `<Part>` (or, for a part built on a shared part, that component as its only node).

| Section                   | Holds                                                                                           | Never holds                   |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------- |
| `// 1. Props`             | `$props()` with `$bindable` props, `ref = $bindable(null)`, `...rest`; `$props.id()`            | Logic                         |
| `// 2. Store and context` | `Context.get()`, or `new XStore(…)`, `store.connect()`, `Context.set(store)`                    | Effects                       |
| `// 3. Shared behaviours` | `use…` calls and the one-line values they take or give (`bound(…)`, `$derived(trigger.popup)`)  | A behavior `if`               |
| `// 4. Own wiring`        | Handlers, the part's own attachments, one merged `own` props object, functions the root exports | A decision about what happens |

- A section with nothing in it is left out; the others keep their numbers. `pnpm lint` checks the
  names and the order.
- **`Part`** renders the element: `tag`, `state`, `attrs`, `bind:ref`, `user`, `after`, `body`, and
  the part's own props. One merge order: state hooks, own props, `bind:ref`, the user's props,
  `after`. The user's `class` goes in front of the part's, the user's `style` after it. Without
  `attrs`, each state field renders as `data-<field>`; `attrs` takes the component's `…StateMapping`
  where that isn't enough.
- **Handlers** are `const`s typed with Svelte's handler types
  (`const onclick: MouseEventHandler<HTMLElement> = …`), and a handler calls one intent. A platform
  guard stays in the handler: a prevented event, a mouse button other than the main one, IME
  composition, a virtual click. Own props that handle the same events as a wiring's are merged once,
  in a stated order: `const own = $derived(mergePropsN([{ onclick }, trigger.props]))`.
- Markup beside the part's element (a hidden input, focus guards) is a plain element with one
  spread, never a component: a component beside a node adds a hydration marker to the server HTML.
- Both platforms use the same Svelte features: an attachment for an element, `on` from
  `svelte/events` for a listener (except where § Wiring keeps a native one), `bind:` only for what
  the user binds.
- No DOM while a part initialises. Parts render on the server.

### Wiring

A wiring function is what a part calls in section 3. It translates events into intents and applies
store state; it decides nothing.

- **Two forms.** The store form, `useX(store, () => options, fixed?)`, or `useX(store)` without
  options. The options form, `useX(() => ({ popup, … }), fixed?)`, for a trigger-side wiring whose
  popup can change while the trigger is mounted, because a handle gives it another store:
  `useHoverTrigger`, `useDismissTrigger`, `useOpenMethod`, `useTriggerFocusGuards` and core's
  `useTriggerRegistration`. `fixed` is read once: ids and the part's public name.
- **Options** are read inside deriveds and handlers, never destructured at init. A value the wiring
  writes back (`bind:inputRef`) is a `Bound` the part makes once.
- **It returns `{ props, …named }`:** `props` for the part's element, one named props object per
  element beside it (`hidden`, `guardBefore`), and read-only values the part needs (`popup`,
  `guarded`). Its attachment rides inside the props, under a key made once when the wiring is
  called, so one spread applies everything.
- **Props types:** `Props` for what reaches `Part`; Svelte's element attribute types
  (`HTMLAttributes<…>`) for props spread on a plain element. `Props` doesn't spread on a typed
  element without a cast, because of its symbol attachment slot.
- **`after`** is a function for `Part`'s `after`, for handlers that must wrap the ones merged before
  them (button semantics, a field's validation props).
- It starts its own effects when it is called. Its result has no `connect()`. `attach…` returns one
  attachment for a part's own work on its element.
- **Listeners outside the element** use `on` from `svelte/events`, inside an effect or an
  attachment, except where it is unsafe: pointer, touch and wheel listeners that must be live at
  once (`on` adds them a microtask late), and non-capture listeners on elements a portal renders
  outside the app root (they stop Svelte's delegated handlers there and above). Those stay native
  `addEventListener`, each with a comment saying why.
- A popup's inner wirings take the one `PopupView`.

### Folders and files

Each package's `src/` has two folders, `components/<name>/` for one component's code and
`foundation/<job>/` for code several components share, and the package entry `index.ts`. What nearly
everything uses is the job `kernel`. `pnpm lint` checks every rule here
(`scripts/primitives-layout.ts`).

- **Flat.** No folder inside a component or a job.
- **Every file starts with its folder's name,** `<folder>-<idea>`, in kebab-case, Svelte components
  too: `foundation/form/form-validity.ts`, `components/switch/switch-root.svelte`. The one exception
  is `index.ts`, the folder's face, whose first line says what the folder is for.
- **`.svelte.ts` exactly when the file uses runes.**
- **One idea per file, named as a noun.** State, decisions and helpers of one idea stay together. No
  `utils`, `helpers`, `common` or `shared` files or folders.
- **The file and its main export name the same idea,** so a symbol leads to its file and a file to
  its symbol: `useHoverTrigger` lives in `hover-trigger.svelte.ts`, `class SafePolygon` in
  `hover-safe-polygon.ts`. Every exported `use…` and `attach…` function and every class contains its
  file's idea words; `wiring` is not a file word. The few exceptions are listed, with their reasons,
  in the check.
- **When code gets its own file:** a class (one per file), a component (always), pure decisions
  (`<x>-rules.ts` from the start), a wiring once a second part needs it (`<x>-<thing>.svelte.ts`, or
  a job once a second component does), and any other function once a second file needs it. Moving is
  part of the change that needs it. Code nobody uses yet moves in with its first user, unless that
  user is the next component to move in.
- **Types** shared in a folder go in `<folder>-types.ts`, null objects in `<folder>-null.ts`,
  styling hooks in `<folder>-attributes.ts`.

A component's file set. `primitives-lynx` uses the web's names.

```
primitives-core/src/components/switch/
  switch-store.svelte.ts   the store
  switch-types.ts          state, change reasons and details, generic over the platform
  index.ts                 what the platforms import
primitives-web/src/components/switch/
  switch-root.svelte       one file per public part: <x>-<part>.svelte
  switch-thumb.svelte
  switch-attributes.ts     styling hooks: the data attributes, and the state mapping
  switch-context.ts        the component's contexts, typed for the platform
  switch-types.ts          public types: props, and core's types at the platform's types
  switch-parts.ts          the namespace: Root, Thumb
  index.ts                 the namespace, the types, the attribute constants
```

Added only when needed: `<x>-rules.ts`, `<x>-<part>-store.svelte.ts` and `<x>-handle.ts` in core;
`<x>-<thing>.svelte.ts`, `<x>-<part>-<piece>.ts` and `<x>-<part>-rules.ts` on a platform.

### Folder map

Every `foundation/<job>/` folder. A job has the same name in core and on each platform, and exists
on a platform when it has code there. A new job, or a file that fits no job's line, adds or changes
its row in the same change: `pnpm lint` fails on a job without one.

| Job        | What it is for                                                               | Holds (core / web)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kernel`   | What every store and every part uses                                         | Core: contexts, ids, logging, change details and reasons, `Bound`, `Controllable`, `ClaimedValue`, `CommittedValue`, `watch`, `keepShallowEqual`, `Timeout`, calling a user's callback, the Platform contract and the facts a platform passes in (pointer types, event types, key input). Web: the web platform, `Part`, props merging, attachment props, refs, styles, state attributes, server-safe props, change details, event facts, synthetic clicks, DOM and shadow-DOM queries, tabbability, the focus queue, the user agent, visually hidden styles, the text direction, claimed ids (`attachClaim`, `useClaimedId`) |
| `form`     | What a form control shares with its field, fieldset, form and labelable      | Core: the field link, control id, control labels, validity, null contexts. Web: the form contexts, `useCheckedControl`, the label fallback                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `button`   | Web only (button semantics are DOM keyboard and focus work): pressable parts | `useButton`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `popup`    | What every popup shares                                                      | Core: `PopupStore` with its open pipeline, `PopupView`, the behavior rows, `ActiveTriggerStore` and the trigger map, trigger registration, `PopupTriggerStore`, `PopupPortalStore`, the Close-part count, the handle base, the popup tree, the event emitter, popup rules and types. Web: `usePopupRootDeps`, `usePopupRoot`, `usePopupUnmount`, `usePopupTrigger`, `usePopupElement`, the shared `PopupBackdrop` part, the tree, node and dialog contexts, `PopupLayoutStore` and its context, popup styling hooks                                                                                                           |
| `dismiss`  | Closing a popup with Escape, a trigger press or a press outside it           | Core: `DismissInteraction` and the dismiss rules. Web: the Root's document listeners, the trigger's and the popup's handlers, Escape, where a press began, the inside marker                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `focus`    | A popup's focus                                                              | Core: the trigger focus guards. Web: the focus manager, the open method, the trigger guards, focus guards, focus history, marking outside elements, tabbability of a popup, the markers the popup wiring finds elements by                                                                                                                                                                                                                                                                                                                                                                                                    |
| `hover`    | Opening and closing a popup by hovering                                      | Core: `HoverInteraction`, `HoverTriggerStore`, `HoverPopupStore`, the hover rules, the safe polygon. Web: `useHoverTrigger` and `useHoverPopup`                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `position` | Placing a popup against its anchor                                           | Core: placement rules, the positioning steps (on `@floating-ui/core`, imported only here), `PositionerStore` (which also remembers a move to another trigger), `ViewportContentStore` and the viewport rules, the state of an anchored popup's parts. Web: `usePositioner` and the Positioner style, the shared `AnchoredPositioner`, `AnchoredArrow` and `AnchoredViewport` parts, `useViewport` and the viewport size, the page scroll lock and the anchored scroll lock, position styling hooks                                                                                                                            |
| `portal`   | Web only (core has no portal code): moving a popup's subtree elsewhere       | The portal wiring (`useFocusPortal`), `PortalStore` and its context, the shared `PopupPortal` part                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `presence` | Whether a part is mounted and where its transition is                        | Core: `Presence`. Web: waiting for animations, the transition-status hooks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### Imports

- **Order:** Svelte, other packages, core, then this package's `foundation/`, then the component's
  own files. Types with `import type`, or `type` inline in a mixed import.
- Specifiers name the file with `.js`. Inside a package imports are relative; across packages they
  use the package name. Web tests import the web source through `#lib`.
- **Through the face:** a component reads a job, and a platform reads core, only through an
  `index.js`. A job imports its own files by name, another job through its `index.js`, and no
  component. The kernel imports nothing else of its package. The packages' lint configs hold this.
- **Imports point down:** components → foundation; a platform → core; never back.
- **A component imports another only from a written list:** one built on another (AlertDialog and
  Drawer on Dialog; ContextMenu and Menubar on Menu, and Menu on them; Autocomplete on Combobox;
  Accordion on Collapsible; Input on Field), a control and its group or container (Checkbox, Radio
  and Toggle with their groups; Menu, Popover, Select and ToggleGroup in a Toolbar), and Separator
  as it is. A concept two components share that isn't on the list moves to a job.

### The public API

- A value a user can control has three props: `bind:<x>`, `default<X>` and
  `on<X>Change(value, eventDetails)`. The details carry `reason`, `event`, `trigger`, `cancel()`,
  `allowPropagation()`, `isCanceled` and `isPropagationAllowed`; the callback runs before the value
  is written, and `cancel()` stops the write.
- `render` is a snippet that receives `{ props, state }` and spreads `props` on one element;
  `children` receives the state; `ref` is `$bindable`.
- Calls from outside are functions the root exports (`close()`, `unmount()`), reached with
  `bind:this`, and a handle (`Popover.createHandle()`) for detached triggers. A handle's store sits
  behind symbol keys, off its public type.
- Each component is a namespace (`Switch.Root`, `Switch.Root.Props`), and its types are also
  exported flat (`SwitchRootProps`). Exports are explicit, with no wildcard: web and Lynx export one
  subpath per component and a root entry; core adds one `./foundation/<job>` subpath per job for the
  platforms.
- Not public: stores, contexts, wiring, rules, and a handle's store.
- An improvement over the behavior users expect is fine when it is clearly better and cheap; it is
  written down as behavior. While there are no users, a public change needs the maintainer's word,
  with no deprecation period.
- Modules have no side effects (`sideEffects: false`): no listener, registration or DOM read at the
  top level. Page-wide facts at module level are the narrow exception, each with a comment saying
  why, and none is written while a component renders on the server.

### Rendering contract

- **Accessibility.** Role and state attributes are written on the `<Part>` tag from store state.
  Attributes that link elements (`aria-labelledby`, `aria-controls`) come from the wiring that owns
  the link, and name an id only while its element is in the document. Ids come from `$props.id()`
  through `sohedraId(uid, suffix)`. Core moves focus only through `platform.focus`. On Lynx, a part
  sets every stable `accessibility-*` attribute that describes it, also where an engine drops it
  today.
- **Styling hooks.** The web exports `<X><Part>DataAttributes` (`data-<state>`) and
  `<X><Part>CssVariables`, each entry with a doc comment, and maps state to them with a
  `…StateMapping` in `<x>-attributes.ts`. Every `data-…` and `--…` name is spelled once, in its
  component's or job's constant (an internal marker in `<job>-markers.ts` or a `…_ATTRIBUTE`
  constant); `pnpm lint` checks it. Lynx exports `<X><Part>Classes`, one `ui-<state>` class per web
  attribute. `<x>-attributes.ts` holds styling hooks only, never ARIA. A value that changes every
  frame is a CSS variable on the web and a main-thread value on Lynx, never store state.
- **Server rendering.** Effects and attachments don't run on the server, so code that needs an
  element lives in one. Ids match between server and browser. Before hydration, only an attribute
  naming a claimed id, a Positioner's position and focus guards may differ.
- **Events.** `mergeProps` chains handlers of one event, rightmost first, so `after` runs first,
  then the user's handler, then the part's own: a user calls `event.preventSohedraHandler()` to skip
  ours. A component stops an event's propagation only where its behavior needs it. Core never makes
  an event: the platform passes its own with the details (`{ event, trigger }`).

### The registry

Sohedra UI, the copy-paste registry, styles the primitives. The primitives set no slot marker. A web
registry component sets `data-slot="<component>-<part>"` on each part it renders; a Lynx one adds
the class `slot-<component>-<part>` beside the user's, since Lynx's style engine parses attribute
selectors but never matches them. The registry also owns loading states
(`<svelte:boundary pending>`); the primitives ship none.
