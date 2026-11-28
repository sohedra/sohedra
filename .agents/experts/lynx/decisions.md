# Lynx expert: decisions

What's already decided about the binding, the modules and the Lynx primitives, and what's known and
open. The expert never re-raises a **Settled** item as a finding.

Last reviewed: none yet. Pass `--base` to `scripts/expert-scope.ts` until the first review sets a
commit here.

## Settled

- **Svelte runs on the background thread, in one mode;** the main thread only applies patches and
  runs main-thread functions.
- **The first frame is on by default,** drawn with Svelte's server renderer and adopted by the
  background. The main thread is Svelte's server: every import loads there, and `BROWSER` from
  `esm-env` is false there. A `<svelte:boundary>` with `pending` keeps its children out of the first
  frame only.
- **One Lynx version at a time:** Lynx 4.2 and later. No compatibility path for older engines or
  options while there are no users.
- **Svelte's spelling where the meaning is Svelte's** (`ontap`, `main-thread:ontap`); Lynx's own
  concept where the behavior differs (the main thread, native gestures, `overlay`,
  `accessibility-*`), never simulated; and a build error, naming the Lynx way, for a web habit that
  can't work.
- **The Lynx peer range of Svelte ends at a minor** (`~5.59.0`), widened one minor at a time.
- **No Lynx for Web target** for now: neither a browser preview nor production web.
- **HarmonyOS is not tested.**
- **Lynx parts set every stable `accessibility-*` attribute that describes them,** also where an
  engine bug drops it today; the fix belongs in the engine. Attributes still only proposed upstream
  wait until Lynx's maintainers agree on their names.
- **The Lynx registry styles parts by class** (`slot-<component>-<part>`), since attribute selectors
  never match.
- **Arrows end at the popup's edge,** so a fade on Android never cuts them off; Popover and Tooltip
  popups set `overlap={false}` only while they have an Arrow.
- **The Positioner is laid out at the page's corner and moved with `transform`,** as on the web, so
  a shrink-to-fit popup near the right edge keeps its width.
- **A main-thread drag writes `transform` itself,** never a CSS variable.
- **Web-only components:** CSPProvider and PreviewCard. Their stores still live in core.
- **The Lynx primitives move in after the web's:** once every component is in core and on the web,
  the Lynx parts follow, with the web as their reference. Until then no part moves to Lynx.

## Known and open (don't report again, check whether fixed)

- **A close without an animation finishes about 50 ms later on Lynx** than on the web, and the 50 ms
  window for an animation's start has little margin on Android.
- **On iOS a popup's Arrow sits 0.7 to 0.8 px off the trigger's centre:** the arrow is measured at
  the popup's starting scale. Taking its size from `layoutchange` would fix it.
- **A Lynx popup reopened during its exit animates from where it was.**
- **A popup inside a native overlay reports "opened completely" before its slide ends** (Android).
- **A part with text inside is two screen-reader stops on Android** (engine).
- **A popover opened inside a modal dialog is out of the screen reader's reach.**
- **Nothing stops the Lynx primitives from using a built-in the engines lack** beyond what the
  binding's build refuses.
- **The Lynx focus manager** will need the web's `tick()` wait for initial focus when it moves in.
- **Core changed shape since the Lynx trial:** stores and building blocks take `(props, deps)`, a
  popup's wirings read one `PopupView`, a part's state comes from core, and lifetime work stops with
  `stop()`. The Lynx parts follow core as it is when they move in.
- **The newest `Intl` polyfill leaves a page blank.**

## Revisit

Nothing yet.
