---
name: open-pull-request
description:
  Prepare and open a pull request in sohedra/sohedra, or write its title, description or commit
  messages. Use when the person asks to commit, open or update a pull request, or write a PR title
  or description.
---

# Open a pull request

Open a pull request only when the person asked for one. Show them the title and description before
you create it.

## Before you start

1. Check the branch and status: `git status`, `git branch --show-current`. Never commit on `main`.
2. Keep it to one change, in one package, unless the change must land in several packages together.
   If the work holds two changes, propose two pull requests.
3. Check what the change needs:
   - a change in behavior: a test that fails without it (not one that already passes, and not one
     that only checks a mock of the changed code);
   - an API change: its docs and doc comments updated in the same pull request;
   - a deprecation: `@deprecated` naming the replacement and a development warning;
   - a change to a published package: a changeset (`pnpm changeset`), once `.changeset/` exists.
4. Run the checks from the repository root: `pnpm lint`, `pnpm format:check`, `pnpm check`,
   `pnpm build`, `pnpm test`.

## Title

`type(scope): summary`, at most 72 characters. It becomes the commit on `main`.

- Type: `feat`, `fix`, `perf`, `refactor`, `test`, `docs` or `chore`.
- Scope: the package folder (`lynx`), a UI component (`slider`), `deps` for dependency updates, or
  none for a change across the repository. A Lynx or Svelte upgrade is typed against the package it
  changes: `feat(lynx): move to Lynx 3.10`.
- Summary: lowercase, starts with a verb, no period, says what changed for the user. A platform goes
  in the summary: `fix(haptics): stop the double tap on Android`.
- Breaking change: `!` before the colon, plus a `BREAKING CHANGE:` paragraph in the description.

Branch commits use the same style.

## Description

Fill the template's three sections in short sentences, and delete its comments:

- **Why:** the problem and its cause; `Closes #12` when there is an issue.
- **How:** what changed and what else was considered. A contributor names any AI tool used, in one
  line. Follow the person's own instructions on attribution: the maintainer's own pull requests
  carry none, and nobody adds tool trailers such as `Co-Authored-By` for an AI.
- **Test plan:** what ran, where (device, simulator or browser), and the result; screenshots for
  visible changes on each affected platform. Say which checks you couldn't run.

No checklists: the description becomes the commit message.

## Open it

```sh
git push -u origin <branch>
gh pr create --draft --title "<title>" --body-file <file>
```

Open it as a draft. Mark it ready (`gh pr ready`) once the test plan has run and the checks pass.
