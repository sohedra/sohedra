# Contributing

Thanks for your interest in Sohedra. The project is in early development and nothing is published
yet.

Everyone taking part follows the
[Code of Conduct](https://github.com/sohedra/.github/blob/main/CODE_OF_CONDUCT.md). To report a
security vulnerability, follow the
[security policy](https://github.com/sohedra/.github/blob/main/SECURITY.md) instead of opening an
issue.

## Where to start

- **A bug:** open an issue with the bug report form. Search first: someone may have reported it
  already.
- **A question:** ask in [Q&A](https://github.com/sohedra/sohedra/discussions/categories/q-a).
- **A feature idea:** post it in
  [Ideas](https://github.com/sohedra/sohedra/discussions/categories/ideas).
- **A design proposal:** open an
  [RFC](https://github.com/sohedra/sohedra/discussions/categories/rfcs) (see
  [How decisions are made](#how-decisions-are-made)).

Bug fixes, docs and tests can go straight to a pull request. A new feature, an API change or a new
package needs the approach agreed in an issue or an RFC first, before you write code.

## Reporting a bug

The bug report form asks where the bug happens (web or native, which platform, Lynx Explorer or your
own build) and for the versions you use.

- **A reproduction is required.** While nothing is published, that is a branch in your fork of this
  repository that changes a playground until it shows the bug.
- **Does it happen without Sohedra?** If you can check it in plain Svelte, SvelteKit or Lynx, say
  so: it tells us whether the bug belongs upstream. "Didn't try" is a fine answer.
- An issue without a reproduction gets `status:needs-repro` and is closed after 7 days without one.
  An issue waiting for your answer gets `status:needs-info`; we remind you after 14 days and close
  it after 21.

## Setup

You need Node.js 26.13.1 or later and pnpm 12.21 or later (see `devEngines` in `package.json`). On
Windows, clone with symbolic links on (`git clone -c core.symlinks=true`), which the agent skills in
`.claude/skills/` are.

```sh
pnpm install
```

`pnpm install` also sets up git hooks: they format and lint the files you commit, and run the checks
before you push.

pnpm refuses a dependency version published less than a day ago. Use an older version; exceptions
are the maintainer's call.

## Checks

Run these before you mark a pull request ready for review.

```sh
pnpm lint
pnpm format:check
pnpm check
pnpm build
pnpm test
```

`pnpm -F <package> test` runs one package's tests, and `pnpm test:affected` runs what your change
reaches in every mode (see [contributing/tests.md](contributing/tests.md)). `pnpm lint:fix` and
`pnpm format` fix most problems automatically. `pnpm lint` also checks the repository itself
(labels, agent files and package setup). CI also checks spelling with
[typos](https://github.com/crate-ci/typos); with [pipx](https://pipx.pypa.io) installed,
`pipx run typos` runs it locally. A word it flags that is spelled as it must be goes in
`.typos.toml`, with the reason.

## Pull requests

Pull requests are squash-merged: the title becomes the commit on `main`, and the description becomes
its message.

- **One change, in one package,** unless the change must land in several packages together.
- **Open it as a draft** while you work, and mark it ready once its test plan has run. Drafts run
  only the fast checks.
- **Allow edits from maintainers,** so small fixes don't need another round. Pull requests that
  don't allow it may be closed.
- **Tests:** a change in behavior comes with a test that fails without it. Don't add a test that
  already passes, or one that only checks a mock of the code you changed.
- **Docs:** an API change updates its docs and its doc comments in the same pull request.
- You can have at most 2 pull requests open at a time.
- A pull request waiting on you gets `status:needs-info`; we remind you after 14 days and close it
  after 21.

### Title

Use [Conventional Commits](https://www.conventionalcommits.org): `type(scope): summary`.

- **Type:** `feat`, `fix`, `perf`, `refactor`, `test`, `docs` or `chore`.
- **Scope:** the package's folder name (`lynx`, `haptics`), or the component in the UI packages
  (`slider`). Use `deps` for dependency updates. Leave it out for a change across the repository.
- **Summary:** lowercase, starting with a verb, with no period at the end. Name a platform in the
  summary, not the scope. The whole title is 72 characters at most.
- **Breaking change:** add `!` before the colon, and start a paragraph of the description with
  `BREAKING CHANGE:` saying how to migrate.

An upgrade of Lynx or Svelte changes what users run, so it gets its own pull request, typed against
the package it changes.

```text
feat(lynx): add the Svelte binding for Lynx
fix(haptics): stop the double tap on Android
refactor(slider)!: rename the onValueChange prop to onChange
chore(deps): update oxlint to 1.94
feat(lynx): move to Lynx 3.10
```

Commits on your branch use the same style.

### Description

The template has three sections: **Why** (the problem, its cause, and `Closes #12`), **How** (what
changed and what else you considered) and **Test plan** (what you ran, on which device or simulator,
and the result, with screenshots for visible changes on each platform). Leave out checklists: the
description stays in the history.

## AI tools

AI tools are welcome, and the maintainer builds Sohedra with AI agents too: the repository's agent
instructions and skills are public. These rules protect review time:

- **You are the author.** Understand every line you submit and be able to explain it.
- **Write in your own words.** Don't paste model output into issues, pull requests or comments.
- **A person sends every message.** Don't let an agent open issues or pull requests, or post reviews
  or comments, on its own. Don't mass-submit.
- **Say how you used AI** in one line in your pull request's How section. Don't add tool trailers
  such as `Co-Authored-By` for an AI tool.
- **Keep the license clean.** Don't submit output that copies third-party code unless its license is
  compatible and you credit it, and use only tools whose terms let you license the output under
  Apache-2.0.

Issues and pull requests that don't meet these rules may be closed without review.

## Code

[contributing/](contributing/README.md) holds everything about writing code here, for people and
agents alike: the architecture, the code rules, the primitives' recipes, every kind of test and the
exact command, and the pitfalls. Read [contributing/code.md](contributing/code.md) before you write
code, and [contributing/tests.md](contributing/tests.md) before you write a test.

## Releases, deprecation and support

Nothing is published yet. Once it is:

- **Versions:** each package has its own semantic version. Before 1.0, a breaking change bumps the
  minor version and still comes with migration notes.
- **Experimental options** (under `experimental`) may change in any minor release and are not
  covered by semantic versioning or security advisories.
- **Deprecation:** an API is deprecated in a minor release. It keeps working, its doc comment names
  the replacement, and it logs a warning in development. It is removed in the next major release. A
  replacement becomes the default only once it does everything the old API did.
- **Majors** come with a migration guide, and with a codemod when the change is mechanical.
- **Support:** the latest minor release gets all fixes. The previous major's last minor gets
  security and critical fixes for 6 months after the new major ships. Older versions get none.
- **Platforms:** Sohedra supports one Lynx version at a time, and the Node.js versions in Active or
  Maintenance LTS.

## How decisions are made

The maintainer decides. A design question starts as an
[RFC](https://github.com/sohedra/sohedra/discussions/categories/rfcs): the problem, the design, how
we teach it, the drawbacks and the alternatives. A big feature ships first under `experimental`
options, with a feedback discussion. Decisions are recorded in the discussion and in the docs, and
planned breaking changes are announced in
[Announcements](https://github.com/sohedra/sohedra/discussions/categories/announcements).

## How issues are triaged

1. A new issue gets `status:needs-triage` from its form.
2. The maintainer checks its type and closes it if the form was ignored, or as a duplicate.
3. A bug without a reproduction gets `status:needs-repro`.
4. A bug that needs a fix in Lynx, Svelte or SvelteKit first gets `blocked:lynx`, `blocked:svelte`
   or `blocked:sveltekit`, with a link to the upstream issue.
5. Otherwise it gets a `pkg:` label, a `platform:` label when only some platforms are affected, and
   a priority, and `status:needs-triage` is removed. An open issue without it is accepted.

Priority is GitHub's Priority field: **Urgent** for something broken or vulnerable for most users,
**High** for something that breaks documented behavior, **Medium** by default, and **Low** for an
edge case. Accepted issues are never closed for age. Closed issues are locked after 14 days; open a
new issue instead of commenting on a closed one.

## License

By contributing, you agree that your contributions are licensed under the license of the package you
change: the [Apache License 2.0](./LICENSE) unless the package's own license says otherwise.
