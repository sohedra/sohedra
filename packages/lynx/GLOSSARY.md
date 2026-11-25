# @sohedra/lynx

Svelte on Lynx. The background thread runs Svelte's custom renderer and sends its changes to the
main thread as patches. The main thread builds Lynx's elements, draws a first frame before the
background starts, hydrates it with the background's first patch, and runs main-thread functions.

Some names are fixed by the engine or by ReactLynx's wire, such as `_wkltId`, `runWorklet`,
`_isFirstScreen`, `updateCardData` and `initData`. They are spelled that way only where the wire
needs them; everywhere else the terms below are used. Some public names keep Lynx's or ReactLynx's
spelling, such as `InitData` and `unmountRecycled`; the _Avoid_ words don't apply to them.

## Language

### Threads and pages

**Thread**: One of the two JavaScript contexts a Lynx page runs on: the background or the main
thread.\
_Avoid_: context, side, JS context

**Background**: The thread that runs Svelte, the app's components, effects and handlers, and the
renderer.\
_Avoid_: JS thread, app thread

**Main thread**: The thread that makes Lynx's elements, draws the first frame, applies patches and
runs main-thread functions.\
_Avoid_: Lepus, UI thread

**Page**: One running Svelte app in a Lynx view: its root component, its elements, and everything
both threads keep for it.\
_Avoid_: card, app (for the running instance), page (for its number)

**Generation**: The number that tells one life of a page from the next. It starts at 0 and goes up
on each reload or destroy.\
_Avoid_: page, page id, stamp

**Stamp**: What every message between the threads carries: the protocol version and the generation
its content belongs to. A generation alone is not a stamp.\
_Avoid_: header

**Protocol version**: The version of the format both threads speak. Threads from different builds
disagree on it.\
_Avoid_: format version

**Reload**: A restart of the page by the host or a dev tool that keeps the view and starts a new
generation.\
_Avoid_: refresh, app reload

**Root**: The page's top element, bound to Lynx's page element, above every element and layer the
page draws.\
_Avoid_: page element, root node

**Layer**: A component mounted above the page, such as a modal, a sheet or a toast.\
_Avoid_: overlay, portal

**Host**: The native app that embeds the Lynx view and gives the page its data, global props, events
and keyboard state.\
_Avoid_: native app, container, renderer host

**Page data**: The data the host gives the page. The first frame is drawn from it.\
_Avoid_: card data, init data

**Engine**: Lynx's native runtime, which the threads reach through its globals.\
_Avoid_: Lynx core, native, build engine

**Engine gap**: A built-in a thread's engine lacks, which the binding fills before the page's
modules load.\
_Avoid_: polyfill, shim

**Missing global**: A web or JavaScript global a thread lacks and the binding does not fill. The
binding's error names the import of `@sohedra/lynx-polyfill` that fills it, if one does.\
_Avoid_: engine gap, missing API

**Workaround**: Code that exists only because of a known gap in Lynx or a Svelte internal, tagged
with when it can be deleted.\
_Avoid_: hack, fix

**Catalogue**: A program's table of messages. Each entry has a plain sentence, one fix and a docs
page named by its code.\
_Avoid_: diagnostics, error table

**Code**: The stable snake_case name of a catalogue entry and of its docs page.\
_Avoid_: error code

**Repeats**: The counting of identical errors on one thread for one page, of which Lynx gets the
1st, 10th, 100th and so on.\
_Avoid_: dedupe (that is the plugin's option)

### The patch protocol

**Wire**: The format and names both threads and the build agree on. Only the wire spells a message
between the threads.\
_Avoid_: protocol, channel (for the format)

**Channel**: The background's end of the wire. It sends the renderer's changes as one patch per
batch of updates, and receives messages.\
_Avoid_: bridge, transport

**Renderer**: Svelte's custom renderer on the background, which keeps the page's tree and turns
changes into ops.\
_Avoid_: custom renderer (for the binding's instance)

**Patch**: One message from the background to the main thread: a stamp and an ordered list of patch
items.\
_Avoid_: update, batch, frame

**Patch item**: One entry of a patch: an ops item, a cell item, a call item, a reply item or a
rewrite item.\
_Avoid_: item, entry

**Op**: One element operation as plain data, such as create, set an attribute, insert or release.\
_Avoid_: operation, command, mutation

**Element id**: The number the background gives an element, by which ops, calls, events and
mismatches name it. The root's is 1.\
_Avoid_: node, node id, id

**Handler id**: The number that names an event handler that stays on the background. The main thread
sends it back with each event.\
_Avoid_: handler

**Call**: A request the background makes of the main thread inside a patch, run after the ops before
it.\
_Avoid_: invoke, request, method call

**Reply**: The answer to a call, sent the other way.\
_Avoid_: result, response

**Message**: One stamped event from the main thread to the background, such as an event, a reply, a
context release or a rewrite.\
_Avoid_: event (as the general name), dispatch

**Rewrite**: The main thread asking the background to write a subtree again, with the same element
ids, from what it holds now.\
_Avoid_: re-render, rewrite (for build changes)

**Release**: The op that says an element is gone for good.\
_Avoid_: destroy, free

**Context release**: The main thread telling the background which function contexts it no longer
holds.\
_Avoid_: release, free contexts

**Flush**: The point where the main thread hands a patch's element changes to the engine, which
makes the views and lays them out.\
_Avoid_: commit, paint, flush (for the channel sending)

**To text**: Turning a value into the JSON text that crosses threads. A value that can't be turned
into text fails where it is written. The codes say a value is not copyable (`value_not_copyable`),
and the functions encode (`encodePatch`).\
_Avoid_: serialize

**Lazy bundle**: A dynamic `import()` built as a Lynx bundle of its own, loaded on both threads
before the patch that uses it.\
_Avoid_: chunk, async bundle, split bundle

### First frame and hydration

**First frame**: What the main thread draws from the page data with Svelte's server renderer before
the background starts. Effects and handlers don't run on it.\
_Avoid_: first screen, SSR, initial render

**App's main-thread script**: What the app's entries run on the main thread (`src/first-frame/`). It
records the first frame and holds the main-thread side of every public entry. A program apart from
the main-thread runtime: they never import each other and share one global.\
_Avoid_: page script, first-frame runtime

**First-frame recording**: How the app's main-thread script records the first frame, which the
runtime draws when the engine renders the page.\
_Avoid_: recorded frame

**Drawn tree**: The first frame's elements as the main thread drew them.\
_Avoid_: frame tree

**Rendered items**: The first patch items of a page's first patch, which hold the page as the
background rendered it before any effect ran.\
_Avoid_: initial items

**Hydration**: The background's first patch adopting the first frame's elements instead of making
the page again.\
_Avoid_: takeover

**Match**: Hydration's comparison of the drawn tree with the rendered items, decided whole before
anything changes.\
_Avoid_: diff, compare

**Adopt**: Taking a drawn element under the background's element id, with any differences written
over it.\
_Avoid_: claim, take over

**Mismatch**: A difference between the first frame and the background outside a thread branch. It
refuses hydration and leads to a rewrite of the root.\
_Avoid_: hydration error

**Thread branch**: A part of the page only one thread renders (`{#if background}`).\
_Avoid_: branch, block

**Event log**: The events and background-function calls the first frame heard before hydration,
replayed through the background's handlers after it.\
_Avoid_: replay queue

**Stand-in**: The main-thread version of a background-only export, which throws an error that says
where the export works.\
_Avoid_: stub

**Paint**: The platform showing the first frame. Hydration waits for it.\
_Avoid_: draw, render

### Lists

**List**: Lynx's `<list>`, which makes its cells on demand.\
_Avoid_: recycler

**List of the page**: A list that is not inside a cell. The background holds its cells' ops as kept
text.\
_Avoid_: top-level list

**List item**: A `<list-item>` element: one entry of a list, with its item key.\
_Avoid_: item, row, cell (for the element)

**Cell**: A list item as the main thread shows it: what Lynx asks for at an index and hands back
when it scrolls out.\
_Avoid_: row, component

**Cell item**: A patch item that carries a cell's ops as text.\
_Avoid_: cell text, cell ops

**Kept text**: A cell's ops that the main thread holds unparsed until the list shows the cell.\
_Avoid_: cell text

**Mark**: A flag on a cell item that says the cell is written whole again.\
_Avoid_: whole

**Split**: Sorting the renderer's ops into those the main thread applies now and those held in a
cell item.\
_Avoid_: partition, split (for bundles or style rules)

**Deferred row**: A `<list-item defer>`, whose contents render only when Lynx first asks for it.\
_Avoid_: deferred cell, lazy row

**Show / hide**: The main thread asking the background to render a deferred row's contents, or
telling it that it dropped them.\
_Avoid_: request, unmount

**Handed back**: A cell Lynx stopped showing. The list keeps about a screen of them with their
elements.\
_Avoid_: recycled, enqueued, released

**Let go**: A handed-back cell losing its elements, to be rewritten when Lynx shows it again.\
_Avoid_: released, released row

**Item key**: A list item's `item-key`, by which Lynx and hydration track its cell.\
_Avoid_: key

### Main-thread functions

**Main-thread function**: A function marked `'main thread'` that runs on the main thread, and
travels between threads as an object with its id, captures and handles.\
_Avoid_: worklet, MTF

**Body**: The registered code of a main-thread function on the main thread, found by its function
id.\
_Avoid_: worklet body

**Function id**: The stable id of a main-thread function.\
_Avoid_: worklet id

**Capture**: A value a main-thread function reads from outside itself, narrowed to the members it
reads and copied to the main thread.\
_Avoid_: closure value

**Capture copy**: The background's whole read of a captured `$state` value.\
_Avoid_: snapshot

**Background function**: A function on the background that a main-thread function calls with
`runOnBackground`.\
_Avoid_: JS function

**Function handle**: What a main-thread function holds instead of a background function: the
function's name within its function context.\
_Avoid_: handle, reference, token

**Ref handle**: What a main-thread function holds instead of a main-thread ref: the ref's id.\
_Avoid_: handle, reference

**Function context**: The id the background gives each sent copy of a main-thread function that
reaches background functions, kept until its context release.\
_Avoid_: context, exec id

**Main-thread ref**: A `{ current }` that lives on the main thread, which `main-thread:ref` takes.\
_Avoid_: worklet ref, ref

**Main-thread binding**: What a `main-thread:` attribute attaches to an element: a ref, an event or
a gesture.\
_Avoid_: directive, attribute

**Element wrapper**: The one object that stands for one engine element while it lives, as
main-thread functions see it.\
_Avoid_: element, node

**Settle step**: The point where the main thread runs the function refs bound since it last ran and
sets the changed gestures, before the flush that shows them.\
_Avoid_: settle

**Gesture**: A value of `main-thread:gesture` whose callbacks are main-thread functions. It becomes
Lynx gesture detectors.\
_Avoid_: detector, recognizer

**Native id**: The id Lynx knows a gesture detector by. It stays with its element.\
_Avoid_: detector id

**Loop guard**: The development-only limit on main-thread flushes in a row, which stops an update
loop through layout.\
_Avoid_: loop detector

**Main-thread runtime**: What runs a page on the main thread: it applies patches, answers calls and
draws the first frame.\
_Avoid_: runtime

**Functions runtime**: What registers and runs a page's main-thread functions on the main thread.\
_Avoid_: runtime, worklet runtime

### Build

**Plugin**: `pluginSvelteLynx`, the Rsbuild plugin, which turns each entry into a background entry,
a main-thread entry and one Lynx template.\
_Avoid_: build plugin, build engine

**Bundler layer**: The bundler layer of one thread, which compiles each module as that thread runs
it.\
_Avoid_: layer, thread layer

**Copy**: A module or component compiled for one thread. The background's copy uses the custom
renderer; the main thread's copy uses the server renderer.\
_Avoid_: twin, version, build

**Dedupe**: The plugin's list of packages that resolve from the app's folder on both threads, so a
linked or nested library never brings a second install.\
_Avoid_: single copy

**First-frame copy**: In a test run, a component's main-thread copy, which `render` draws the first
frame with.\
_Avoid_: twin

**Compile step**: Compiling one component: one parse, every pass, their edits applied once, then
Svelte's compiler.\
_Avoid_: prepare, transform

**Pass**: One part of the compile step. It reads the syntax tree and returns edits. `runPasses` runs
every pass and applies their edits once.\
_Avoid_: transform, rewrite

**Edit**: A change a pass makes to a component's text as written.\
_Avoid_: rewrite, patch

**Svelte source edits**: The binding's changes to Svelte's own files at build time.\
_Avoid_: patches

**Background-only**: A module that imports `background-only`, which the main thread gets as a stub.\
_Avoid_: server-only

**Static copy**: A lifeless copy of drawn elements, made from the background's tree with
`createStaticCopy`.\
_Avoid_: clone, snapshot, twin

**Silencing comment**: A `sohedra-ignore <code>` comment that silences one build check on its line
or the line below.\
_Avoid_: ignore comment, disable comment

### Testing

**Test page**: A page run in one Node process: the engine fake as the main thread's globals, a
`lynx` for each thread, and a bridge between them.\
_Avoid_: harness

**Engine fake**: A faithful model of Lynx's main-thread engine on a DOM, which throws where a
behavior is unverified.\
_Avoid_: mock, stub, fake engine

**Bridge**: The one way between a test page's two threads. Everything that crosses it arrives later,
as text.\
_Avoid_: channel

**Test library**: `@sohedra/lynx/testing`: `render`, `fireEvent`, `act` and `screen`.\
_Avoid_: testing utils

## Relationships

- A **Page** lives through **Generations**. A thread drops any **Patch** or **Message** stamped with
  another generation.
- The **Renderer** makes **Ops**. The **Split** sends them as an ops item now or holds them in a
  **Cell item**, and the **Channel** puts **Patch items** and **Calls** in order into one **Patch**.
- The main thread answers with **Messages**: events by **Handler id**, calls, **Replies**, **Context
  releases**, errors, **Rewrites** and **Show / hide**.
- The **First frame** is drawn from **Page data**. The first patch's **Rendered items** are
  **Matched** against the **Drawn tree**: a match is **Adopted**; a **Mismatch** leads to a
  **Rewrite** of the **Root**.
- A **List of the page** has **List items**, each shown as a **Cell** whose **Kept text** is applied
  when Lynx asks for it. A **Handed back** cell may be **Let go** and come back as a **Marked** cell
  item.
- A **Main-thread function** has one **Body**, **Captures**, **Function handles** and **Ref
  handles**. Each sent copy that reaches a **Background function** gets a **Function context**.
- The **Plugin** builds each entry in two **Bundler layers**, one per **Thread**, so each component
  has a **Copy** per thread. The main thread's copy draws the **First frame**.
- A **Test page** is the **Engine fake**, two `lynx` objects and a **Bridge**, driven by the **Test
  library**.
