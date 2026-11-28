# Pitfalls

Things that cost real debugging time. Read them before you write primitives or binding code, and add
one when something bites.

## Svelte 5.59

- **A prop read in an effect teardown can be stale.** A `$bindable` prop read inside a teardown
  returns the value its own component last wrote, even when a replacement part has bound another
  element since; a microtask later it reads the binding's current value. An unbound `$bindable()`
  written locally and read through a `$derived` in a teardown is stale too. Teardowns read values
  captured when the effect ran; `attachRef` reads the bound ref a microtask after detaching, as
  `bind:this` does.
- **An already-resolved `await` inside a `<svelte:boundary>` renders after a microtask.** Focus
  queued with one microtask runs before that content exists. Wait for `tick()` before focusing
  something that may sit in a boundary.
- **Synchronous DOM events run inside the reaction that fired them.** A listener added with
  `addEventListener` (not by Svelte) runs within whatever effect, derived or attachment called
  `el.focus()`, `el.click()` or `dispatchEvent`, or removed a focused node (which fires `blur`), and
  its reads become that reaction's dependencies. Svelte's own handlers are protected; ours are not.
  `untrack` those reads.
- **A function is tracked where it runs, not where it is written.** A callback that one path calls
  from a promise and another calls synchronously inside an effect is tracked on the second path. A
  store built inside a `$derived`, an effect or an attachment runs its constructor tracked.
- **`flushSync` inside an effect, in async mode,** can make the effect depend on what the commit
  reads (an `{#each}` collection), and can throw. Keep the `untrack` around a `flushSync` that can
  run inside an effect.
- **An attachment key made inside a getter** is a new key on each read, so the attachment detaches
  and attaches again. Make the key once, when the wiring is called.
- **A component beside an element adds a `<!---->` marker** to the server HTML. Markup beside a
  part's element is a plain element with a spread; a part whose only node is one component adds
  none.
- **Svelte delegates common events to the app's root,** so a handler written in markup runs after a
  native listener on the element itself. `on()` from `svelte/events` keeps the order with delegated
  handlers below it.
- **`on()` isn't a drop-in for `addEventListener`.** It adds pointer, touch and wheel listeners a
  microtask late, so one that must be live at once stays native. A non-capture `on()` listener on an
  element a portal moved outside the app root stops Svelte's delegated handlers on it and above: a
  user's `onfocusout` on a portalled part stops running. Keep those native, with a comment.
- **A component can't tell a `bind:` to an `undefined` variable from no binding** by the value
  alone.

## Lynx

Measured on Android and iOS with Lynx Explorer 4.2. Re-measure on a device rather than guess.

- **Transitions to or from `auto` don't animate** and send no event.
- **Removing a class starts a full-length transition** even when the value doesn't change; a real
  change then sends `transitioncancel` and starts again. A wait that counts starts and ends must not
  count below zero.
- **`transitionstart` comes late:** 6 to 43 ms after the change on Android, 1 to 8 ms on iOS, and
  later still for a popup inside a native `<overlay>`. A 50 ms window for an animation to start has
  little margin. An element can't be asked whether it animates: `getComputedStyleProperty` reads
  `transition-duration` as `""`.
- **An element drawn in the first frame never gets its first `layoutchange`** when its listener is
  added in code. Measure once when it attaches.
- **`boundingClientRect` and transforms:** Android leaves transforms out unless you pass
  `{ androidEnableTransformProps: true }`; iOS always counts them, so an element measured while it
  or a parent is scaled reads the scaled size. Under `display: none` it answers 0×0.
- **Android draws a view that isn't fully opaque through a layer the size of its box,** so a child
  outside the box (a popup's arrow) disappears for the whole fade. `overlap={false}` (Android only)
  turns the layer off, and then overlapping children show through each other. Draw arrows that end
  at the popup's edge.
- **A main-thread `setStyleProperty("--x", …)` is dropped,** and logs `illegal css key`. A
  main-thread drag writes `transform` itself, never a CSS variable.
- **Attribute selectors parse but never match** in Lynx's style engine. Style by class.
- **The background thread has no `Intl`.** Locale work comes from the platform's locale service.
- **An event's `timestamp` is wall-clock milliseconds,** so the Lynx scheduler's `now` is
  `Date.now()`.
- **`height: inherit` gives 0;** `height: 100%` under a parent with a pixel height fills it. On iOS
  a column flex parent with `height: 0; overflow: hidden` gives a shrinkable child 0 height (Android
  gives its natural height).
- **The engine ignores `role` and `aria-*`.** Accessibility is `accessibility-*` attributes
  (`accessibility-traits`, plural). Android has no checked state and needs `enableA11y`, which the
  binding's plugin sets.
- **A page whose background thread threw at start still shows its first frame** and ignores every
  tap. Read the console before debugging the tap.
- **A page that awaits outside a `<svelte:boundary>` with a `pending` snippet has no first frame.**

## Browsers

- **Safari** fires `compositionend` before the `keydown` that ended the composition; keeps a stale
  `labels` list after a control's id changes; may scroll to the bottom when a focused input inside a
  popup unmounts; and shifts a scroll-locked page on pinch zoom. VoiceOver's virtual cursor fires
  `focus` only on `role="button"`.
- **iOS** sends a tap's `click` without a pointer type, and its scrollbars always overlay the page.
- **Android** gives a screen reader's click a pointer type, and real presses can report a zero size.
- Each of these has a `WORKAROUND(<target>)` line where the code handles it.

## Tests and tools

- **Check exit codes, not output.** A piped command can print nothing while the first command
  failed.
- **A failure under load isn't proof.** Rerun the file alone, several times, before you trust it.
- **Two dev servers in one checkout share `node_modules/.vite`,** and one re-optimizing can break
  the other's pages. Give parallel sessions their own git worktree.
- **`pkill -f` matches its own shell's command line,** so a shell running `pkill -f vitest` can kill
  itself. Kill by port: `lsof -iTCP:<port> -sTCP:LISTEN -t`.
- **The import sorter moves a comment written right above an import** with that import. A file's
  first comment, which says what the file covers, needs a blank line after it.
- **Edits that silently don't land.** The formatter rewrites wrapping, so a later exact-match edit
  can miss. Re-read a file after editing it and before trusting a test result.
- **The Svelte autofixer can't parse a file named `*.svelte.test.ts`.** Check the same content saved
  as `*.svelte.ts`.
- **Vitest's browser mode saves a screenshot of every failure** under the package's `.vitest/`.
  Delete it after long runs.
- **In a shallow clone there is no merge base.** The comment check then compares with `origin/main`
  itself, as CI does after fetching it.
