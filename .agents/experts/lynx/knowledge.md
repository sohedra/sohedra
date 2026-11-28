# Lynx expert: knowledge

What the Lynx expert knows. Part 1 is Lynx itself, part 2 is how the binding is built, part 3 is how
the Lynx primitives are built, part 4 is the checklist a review walks. Pinned to what the repository
installs: Lynx 4.2 and later (the binding's `MIN_ENGINE_VERSION`,
`packages/lynx/src/build/plugin/engine-version.ts`), `@lynx-js/types` 4.4.2, `@lynx-js/rspeedy`
0.18.6, Svelte 5.59.0 (`~5.59.0`), Rstest 0.12.

Last checked: 2026-11-28, against `packages/lynx` and its README. Engine facts were measured on an
Android phone and an iOS simulator with Lynx Explorer 4.2; re-measure on a device rather than guess.

## 1. Lynx, as it runs

### Threads

- A page runs on two JavaScript threads. The **background** runs Svelte, the app's components,
  effects and handlers. The **main thread** makes Lynx's elements, draws the first frame, applies
  patches and runs main-thread functions. They talk only by messages.
- The **first frame** is drawn on the main thread from the page data with Svelte's server renderer,
  before the background starts; the background's first patch then adopts those elements (hydration).
  The main thread is to Lynx what the server is to SvelteKit: every module a page imports loads
  there too, and code behind `BROWSER` from `esm-env` (false there) or in an effect runs on the
  background only.
- A **main-thread function** (`main-thread:ontap={fn}`, `main-thread:ref`) runs on the main thread
  with no round trip; it calls the background through `runOnBackground`, and the background calls it
  through `runOnMainThread`.
- Globals differ per thread. `NativeModules` is background only; Lynx's element functions are main
  thread only. The background has no `Intl`; its `URL`, `fetch` and `AbortController` miss parts of
  the standard until `@sohedra/lynx-polyfill` replaces them.

### Elements and events

- Elements are Lynx's (`view`, `text`, `image`, `scroll-view`, `list`, `list-item`, `overlay`…), not
  the DOM's. A `<list>` makes its cells on demand; a `<scroll-view>` with more than 200 direct
  children is slow.
- Events in the binding's spelling: `ontap`, `oncatchtap` (stops the bubble), `ontapcapture`,
  `oncatchtapcapture`, `main-thread:ontap`. Lynx's raw names (`bindtap`, `catchtap`) also work but
  aren't written here.
- A screen reader's double tap arrives as a normal `tap`.
- An event's `timestamp` is wall-clock milliseconds.

### Layout, style and animation

- Lynx's style engine matches tag, class, id and pseudo selectors. It parses attribute selectors and
  never matches them.
- Transitions to or from `auto` jump and send no event. Removing a class starts a full-length
  transition even when the value doesn't change; a real change then sends `transitioncancel` and a
  new start.
- `transitionstart` comes 6 to 43 ms after the change on Android, 1 to 8 ms on iOS, later inside a
  native `<overlay>`. `getComputedStyleProperty("transition-duration")` reads `""`, so presence ends
  come from transition events with a window for the start.
- `boundingClientRect` answers asynchronously (Android 20 to 95 ms, iOS 3 to 8 ms), in page
  coordinates with scroll taken off; 0×0 under `display: none`. Android leaves transforms out unless
  `{ androidEnableTransformProps: true }`; iOS always counts them.
- An element drawn in the first frame never gets its first `layoutchange` when its listener is added
  in code. A `layoutchange` `detail` carries the unscaled size on both platforms.
- Android draws a view that isn't fully opaque through a layer the size of its box, cutting off
  children outside it during a fade; `overlap={false}` (Android only) turns that off.
- A main-thread `setStyleProperty("--x", …)` is dropped; `setStyleProperty("transform", …)` works.
- `height: inherit` gives 0; `height: 100%` under a pixel-high parent fills.

### Accessibility

- The engine ignores `role` and `aria-*`. Accessibility is `accessibility-*` attributes:
  `accessibility-element`, `accessibility-label`, `accessibility-traits` (plural; values differ per
  platform), `accessibility-value`, `accessibility-exclusive-focus` for modals.
- Android has no checked, enabled or range state; iOS has `selected` and `disabled` traits. Android
  needs the page setting `enableA11y`, which the binding's plugin sets.
- `requestAccessibilityFocus` works on Android and iOS. `lynx.accessibilityAnnounce` exists on the
  background, in no typings.

## 2. How the binding is built

Read `packages/lynx/AGENTS.md` (the folder table), `README.md` and `GLOSSARY.md`.

- **One program per folder of `src/`** (`wire/`, `build/`, `background/`, `main-thread/`,
  `first-frame/`, `svelte/`, `testing/`, `gesture/`, `env/`), importing another only through its
  `index.ts`, as `.oxlintrc.jsonc` enforces and `tests/contract/lint/` pins. A thread's globals are
  named only in its folder's `globals.ts`.
- **Svelte on the background:** a custom renderer (`svelte/renderer`) keeps the page's tree and
  sends its changes as ops, one patch per flush, over the wire; the main thread applies them.
  Svelte's internals are touched only in `src/svelte/`, each touch a row of its `manifest.ts` that
  `tests/contract/svelte/` checks. A Svelte upgrade bumps the dev copy and the peer range and lets
  the failing row name what to revisit.
- **The build** (`src/build/`): `pluginSvelteLynx()` for rsbuild and rspeedy, a bundler layer per
  thread; one parse per component, every pass returns edits against the source as written. Every
  build message is an entry of `build/diagnostics/catalogue.ts`. The build refuses, at file, line
  and column, what type-checks and fails on Lynx: a global the thread lacks (with the polyfill
  import that fills it), the DOM, the other thread's APIs, Svelte's own `mount`, `MediaQuery`,
  `svelte/motion`. `// sohedra-ignore <code>` silences one on its line.
- **`sideEffects`** lists every `src/` file that acts on load, or production drops it.
- **Testing:** `@sohedra/lynx/testing` renders a component on both threads on an engine fake that
  has only what a device has (`render`, `fireEvent`, `act`, `rerender`, `waitFor`), with
  `withSvelteLynx()` for Rstest or `svelteLynx()` for Vitest. `lynx: { firstFrame: true }` draws the
  first frame first and hydrates it.
- **Async mode** works; a page that awaits outside a `<svelte:boundary>` with a `pending` snippet
  has no first frame, and a development build warns.

## 3. How the Lynx primitives are built

`packages/primitives-lynx` follows the web's shape (`contributing/architecture.md`): the same core
stores, the same file set, sections, wiring contract and names. What a Lynx part does differently,
and only this:

- Lynx's elements and the binding's event spellings (`ontap`), never `onclick` on a `view`.
- State classes (`ui-<state>`, one per web `data-` attribute, exported as `<X><Part>Classes`)
  instead of data attributes; `accessibility-*` attributes instead of ARIA.
- No hidden input: a form reads values through Field. Layers (the binding's `mount`) instead of
  portals.
- A gesture's per-frame work runs in a main-thread function that calls core's pure math; the
  background hears only its end.
- Its focus, order and timing reach core through a Lynx `Platform`: `scheduler.now` is `Date.now()`;
  order and containment use an element's `compareOrder` and `contains`; page-wide listeners go on
  the page's root (`root` from `@sohedra/lynx`, for `on()`).
- **The web twin's parts:** every part and prop of the web twin that Lynx allows. An omission states
  its platform reason in the part's doc comment: hover, keyboard focus, `nativeButton`,
  `initialFocus` and `finalFocus`, Escape, native forms.
- Its tests run on Rstest with `@sohedra/lynx/testing`, and run Lynx's twin of the part conformance
  suite.

## 4. Review checklist

1. Threads: does each piece of code run on the thread it needs? Any background-only import at a
   module's top level, any main-thread function calling a plain function without `runOnBackground`?
2. First frame: does the page draw the same first frame the background hydrates? Anything only one
   thread renders, outside a thread branch?
3. Svelte: only what custom renderers support; Svelte's spelling where the meaning is the same.
4. Engine facts: measured on both platforms, or marked as one-platform; no wait counted below zero,
   no `auto` transition, no CSS variable written from the main thread.
5. Accessibility: every stable `accessibility-*` attribute that describes the part.
6. Every part and prop of the web twin, and every omission's reason.
7. Core: does a Lynx finding change core only where the change is right for the web too?
8. Size: does a thread's budget move? Growth there usually means code leaking across threads.
