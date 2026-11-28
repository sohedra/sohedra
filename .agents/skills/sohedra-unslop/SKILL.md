---
name: sohedra-unslop
description:
  Removes generated-looking code from a Sohedra diff or files (comments that restate the code,
  filler doc comments, defensive checks for impossible cases, one-caller helpers, vague names)
  without changing behavior. Use as the last step of any change, or when asked to clean up, trim
  comments or remove slop.
metadata:
  internal: true
---

# Unslop

Scope is the diff (`git diff` against the base) unless you're given files. Behavior never changes:
the same tests pass before and after, and nothing public is renamed.

## What goes

Each pattern, with what replaces it.

**A comment that says what the next line does.** Delete it. If the line isn't clear without it,
rename something.

```ts
// Close the popup when Escape is pressed.
if (event.key === "Escape") close();
```

**A comment that explains the design:** what a value holds, where it's kept, which attribute it
lands on, who reads it. The code says that. Keep the one fact it can't show, in a line, or delete
the comment.

**A comment longer than three lines.** Cut it to the reason. An explanation that needs more goes in
`contributing/`, a test title or the pull request. `pnpm lint` flags it in the primitives.

**A comment that narrates history or the task:** "Now we", "Updated to", "Fixed the bug where", "As
requested", a review round, a list number. Delete it. The pull request holds the history.

**A section banner** that isn't one of the numbered sections (`// ---- Helpers ----`, `// State`).
Delete it. Split the file by idea if it needs signposts.

**A doc comment that repeats the name.** `/** The value. */ value`. Say what the reader can't see:
the default, the unit, when it's called, what happens on change, what it refuses.

**A hedge or a sales word:** "robust", "seamless", "comprehensive", "simply", "just", "easily",
"ensure", "leverage", "utilize", "note that", "it's important to". Cut the word; if nothing is left,
cut the comment.

**A defensive check the types already rule out:** `if (!items) return` on `items: Item[]`, `?? []`
on a value that's never undefined, `try` around code that can't throw. Delete it. Narrow `unknown`
at a boundary instead.

**A cast or `!` with no reason.** Make the type right, or give it its `Boundary:` comment.

**A one-caller helper, or a wrapper that only renames.** Inline it, unless its name explains
something the call can't. A pure decision stays in its rules file even with one caller.

**A name that says nothing:** `data`, `result`, `item2`, `handleClick2`, `temp`, `flag`. Name what
it is: `highlightedItem`, `isOpen`, `onTriggerPress`. Names follow the word list in
`contributing/code.md`.

**An option nobody passes,** a parameter with one value, a config object for one setting. Delete it.

**An `untrack` where no reaction runs** (a teardown, a handler Svelte attaches, a constructor called
from component setup, a timer or promise callback). Delete it; `contributing/code.md` § Effects says
where it counts.

**Logs, probes and commented-out code.** Delete them.

## What stays

- A comment that says why, in three lines at most: a browser or engine bug and where, a trade-off, a
  link to the test that pins the behavior.
- The numbered section markers of parts and stores, and the comment above every effect and `watch`.
- `WORKAROUND(<target>)` lines, `@workaround` tags, `Boundary:` comments and `TODO(refactor)`.
- Doc comments on every public API, every part's `@component`, every exported function, every public
  store member and every field of a `…StoreProps`, `…StoreDeps` and `…Options` type. Make them say
  more; don't delete them.

## Steps

1. List what you'll change, by file, before touching anything.
2. Make the changes.
3. Run `pnpm lint`, `pnpm format:check`, `pnpm -F <package> check` and `pnpm test:affected`. Check
   exit codes.
4. Delete each comment left in the diff and reread the code. If it still reads right, leave it
   deleted.
5. Read the diff once more. Revert any change that doesn't make the code easier to read.
6. If one pattern showed up in three or more files, propose a check for it in `scripts/` (wired into
   `scripts/check-repo.ts`).
