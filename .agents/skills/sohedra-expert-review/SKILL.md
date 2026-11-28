---
name: sohedra-expert-review
description:
  Reviews a change with Sohedra's experts (svelte, lynx), only the ones the change reaches, each
  from its last reviewed commit. Use before merging a branch that touches the primitives, the
  binding, a module or a playground, or when asked for an expert review. Pass a base ref, expert
  names, or nothing.
metadata:
  internal: true
---

# Sohedra: expert review

Run the experts on what changed. Each expert lives in `.agents/experts/<name>/`: who it is in
`expert.md`, what it knows in `knowledge.md` and what's decided in `decisions.md`. You orchestrate;
the experts review.

## 1. Find the scope

```sh
node scripts/expert-scope.ts --json                     # each expert from its "Last reviewed" commit
node scripts/expert-scope.ts --base origin/main --json  # a branch before merging
```

Arguments narrow it: a ref becomes `--base`; expert names keep only those experts. An empty plan
means no expert is needed: say so and stop.

Then run the checks on the branch, so the experts spend their review on what a script can't catch:

```sh
pnpm lint
```

## 2. Ask the experts

Spawn one background agent per expert in the plan, all at once, as `<name>-expert` (in a harness
without named agents, a general-purpose agent told to read `.agents/experts/<name>/expert.md` first
and act as it). Prompt:

```
Review mode. Scope: git diff <base>...HEAD.
Your files: <own>. Files both platforms run: <shared>.
Review your files, and the shared ones only for what your platform would meet.
Don't report anything decisions.md lists, or these lint findings: <findings, or none>.
```

An expert that writes throwaway tests works in its own worktree
(`git worktree add ../sohedra-expert-<name> HEAD`), with its own ports, through
`scripts/test-slot.sh`.

## 3. Collect

1. One table: expert, verdict, proven findings by rank, suspected, revisit.
2. Dedupe across experts: a finding in core that both report is one item, listed once, with both
   platforms.
3. Hand the table to the person. Don't fix anything unless asked.

## 4. After triage

Each finding goes one of three ways, in the same turn:

- **Fix now:** fix it with its proof as the test.
- **Later:** one line under "Known and open" in that expert's `decisions.md`.
- **Won't do, or decided otherwise:** one line under "Settled" in `decisions.md`, with the reason,
  so no expert raises it again.

Then set `Last reviewed:` in each expert's `decisions.md` to the reviewed `HEAD`, as
``Last reviewed: `<sha>` (<date>, <what>)``. If an expert said its `knowledge.md` was wrong, fix the
file and its "Last checked" date.
