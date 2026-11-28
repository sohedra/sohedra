# Primitives recipes

What several components do the same way is written once: a shared wiring, a shared part or a core
building block, which every member calls. A component that joins a family uses its recipe; what
differs between members is passed by name. A recipe is confirmed by its first two members: one that
doesn't fit keeps its own code and goes under [Exceptions](#exceptions), with the reason.

"Exists" names where the recipe lives today. "Planned" ones are written with their family's first
member. Paths are under each package's `src/foundation/`.

## The default: a thin part

Most parts read a context and render. They need no wiring and no handler:

```svelte
<script lang="ts">
  // 1. Props
  let { ref = $bindable(null), ...rest }: SwitchThumbProps = $props();

  // 2. Store and context
  const sw = SwitchRootContext.get();
</script>

<Part tag="span" bind:ref state={sw.state} attrs={switchAttributes} user={rest} />
```

Indicators without an exit animation, tracks, values, icons, separators, groups without a label and
most containers are this.

## Popups

| Recipe          | What it does                                                                                                                                                              | Shape                                                                                                                                                                                 | Status                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Popup root      | Joins the tree of nested popups or starts one, unmounts after the exit animations, hears Escape and outside presses; the store attaches itself to a handle in `connect()` | `usePopupRootDeps(defaultPopupId)` spread into the store's `deps`, then `usePopupRoot(store)`. The Root exports `close()` and `unmount()`, one line each                              | Exists: web `popup/popup-root.ts`                |
| Popup trigger   | Finds the trigger's popup (its handle's store, else its root's), registers the element, forwards its data while it owns the popup, wires the interactions its kind has    | `usePopupTrigger(root, () => ({ handle, id, disabled, data, hover }), { part })`; its state from `new PopupTriggerStore(() => ({ popup, id, disabled }))`; the press stays one intent | Exists: web `popup/popup-trigger.svelte.ts`      |
| Popup element   | Hands the element to the store, reports a finished opening after the enter animations, hears Escape and presses inside, keeps a hovered popup open, manages focus         | `usePopupElement(store, () => options)`; the part passes what only it knows (`initialFocus`, `finalFocus`)                                                                            | Exists: web `popup/popup-element.svelte.ts`      |
| Portal          | Renders the popup's subtree in another container, with or without focus managed across the move                                                                           | The shared part `PopupPortal`, on `useFocusPortal`; its state from `PopupPortalStore`                                                                                                 | Exists: web `portal/portal-popup.svelte`         |
| Positioner      | Places the popup against its anchor and publishes the position; the popup's node in the tree, a modal's scroll lock, the move to another trigger                          | The shared part `AnchoredPositioner`, on `usePositioner` and core's `PositionerStore`                                                                                                 | Exists: web `position/`, core `position/`        |
| Arrow, Viewport | The arrow placed by its Positioner; the viewport that shows outgoing and incoming content                                                                                 | The shared parts `AnchoredArrow` and `AnchoredViewport`; each wrapper hands over its state (`positioner.arrowState`)                                                                  | Exists: web `position/`                          |
| Backdrop        | The element behind a popup                                                                                                                                                | The shared part `PopupBackdrop`; what differs (a pass-through style while opened by hover) by name                                                                                    | Exists: web `popup/popup-backdrop.svelte`        |
| Close           | A button that closes the popup it is in                                                                                                                                   | `useButton` and one intent; core's `useClosePart(popup)` counts it, since a modal popup traps focus only with a Close inside                                                          | Exists: core `popup/popup-close-parts.svelte.ts` |
| Handles         | The object for detached triggers and calls from outside                                                                                                                   | One handle base in core; each `<x>-handle.ts` names its store class and public type. Its store sits behind symbol keys                                                                | Exists: core `popup/popup-handle.svelte.ts`      |

- Which interactions a trigger and a popup element have (hover, opening on focus, recording the open
  method, focus guards) is a fixed answer per kind of popup, read from the behavior table
  (`popup/popup-behavior.ts` in core), not a list of `use…` calls in each part. A popup's inner
  wirings take the one `PopupView`.
- **Members:** Popover now; Tooltip, PreviewCard, Menu, Select, Combobox (and Autocomplete), Dialog
  (and AlertDialog, Drawer) and NavigationMenu as they move in.
- **Differs, by name:** PreviewCard joins a tree only inside another card; NavigationMenu joins only
  when nested and holds its dismissal in its List; Menu, Combobox and Dialog pass their own outside
  press test. A Positioner's default anchor, side and collision rules, its `inert` rule and its
  extra state fields.

## Ids, buttons and controls

| Recipe                                  | What it does                                                                                                                             | Shape                                                                                                                                                 | Status                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| A part whose id another element names   | A Title, Description, Label, GroupLabel, Legend or Error gives its id to its owner while its element is in the document                  | `useClaimedId(owner.titleId, () => ({ id }), { defaultId })` returns `{ props }`, the claim inside                                                    | Exists: web `kernel/kernel-claim.svelte.ts`       |
| Pressable parts                         | Button semantics: keys, focus, disabled, a native or a non-native button                                                                 | `useButton(() => ({ disabled, native, composite, focusableWhenDisabled }))` returns `{ after }`                                                       | Exists: web `button/button-semantics.ts`          |
| Checked control                         | A control whose value is a checked state: its place in a Field, labels, hidden input, press forwarding, focus and blur, button semantics | `useCheckedControl(store, () => ({ type, rootId, native, form, value, uncheckedValue, inputRef }))` returns `{ id, props, after, hidden, unchecked }` | Exists: web `form/form-checked-control.svelte.ts` |
| Indicator with an exit animation        | An indicator that animates out before it unmounts                                                                                        | One `IndicatorStore` in core, one shared part each member renders with its own state                                                                  | Planned, with Checkbox                            |
| A control that holds a value in a Field | Registration with the Field, the native reset, its label, its focus state                                                                | `useFieldValueControl`                                                                                                                                | Planned, with the Field family                    |
| List popup                              | The hidden inputs, items and trigger of a list in a popup                                                                                | `useListHiddenInput(store, () => ({ form, autoComplete, inputRef }))`, `useListItem(item)`, the list trigger                                          | Planned, with Select                              |
| Collections, composites                 | Item order, roving focus, disclosure                                                                                                     | `useCollectionItem`, `useRovingFocusRoot`, `useRovingFocusItem`, `DisclosurePanel`, `DisclosureTrigger`                                               | Planned, with Tabs and Collapsible                |

- **Checked control members:** Switch now; Checkbox and Radio. Their stores stay separate and hold
  what the control's labels and ids need (`id`, `labelledBy`, `label`, the input id). What blur does
  is each store's intent; Checkbox keeps Enter submitting the form, `indeterminate` and the parent
  checkbox, Radio its roving item.
- **Claimed id members:** Popover's Title and Description now; the Labels, GroupLabels,
  Descriptions, Errors and Legends of the form and list families.

## Not a family

Meter, Progress and Slider share part names, not what they do. Their Labels use the claimed id
recipe; nothing else is shared.

## Exceptions

These follow the part shape (sections, one intent per handler) and no recipe.

| Part or module                                     | Why it stands alone                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| Drawer's Viewport, SwipeArea and swipe             | The swipe runs every frame on the platform; only its end is a store call   |
| Slider's Thumb and Control                         | Pointer math against a track, and a script that runs before hydration      |
| Combobox's Input                                   | Text entry with composition, caret and inline completion                   |
| NavigationMenu's Trigger, Positioner, Popup, Arrow | No handle, one store per trigger, its own sizing and guards                |
| ContextMenu's Trigger                              | A region, not a button; opens at the pointer                               |
| Menu's filter and submenus                         | A text filter over a tree of menus, and the pointer's handoff between them |
| Toast                                              | A manager made outside components, a hotkey, a swipe                       |
| ScrollArea                                         | Scroll measuring with no store decision in it                              |
| Tabs' Indicator                                    | Measures the active tab; a script that runs before hydration               |
| OTPField's Input                                   | One input per character, with its own paste and focus rules                |
| The focus manager                                  | One idea in one file: a popup's focus on open, while open and on close     |
