# Skills

These skills help you and your agent work on Sohedra itself. Each one is a folder with a `SKILL.md`
written in plain Markdown, so it works in any agent harness.

| Skill                                                     | Use it when                                                                                               | How to run it                                                                                       | What it does                                                                                                                                                                 |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`sohedra-write-code`](sohedra-write-code/SKILL.md)       | You write or change code anywhere in the repo: the primitives, the binding, a module, a test or a script. | `/sohedra-write-code`, or ask "write this the Sohedra way".                                         | Starts from the twin that already does the same job, loads the expert's notes, writes the code, then runs the checks and tests the change reaches and rereads the diff cold. |
| [`sohedra-unslop`](sohedra-unslop/SKILL.md)               | You're finishing a change, or a file reads as generated.                                                  | `/sohedra-unslop`, or ask "clean up this diff". Pass files to go beyond the diff.                   | Removes comments that restate the code, filler doc comments, defensive checks the types rule out, one-caller helpers and vague names. Behavior stays the same.               |
| [`sohedra-expert-review`](sohedra-expert-review/SKILL.md) | Before you merge a change to the primitives, the binding, a module or a playground.                       | `/sohedra-expert-review`, with a base ref (`origin/main`), expert names (`svelte lynx`) or nothing. | Finds which experts the change reaches, runs the checks, asks those experts to review, and hands you one table of findings.                                                  |
| [`open-pull-request`](open-pull-request/SKILL.md)         | You commit, open or update a pull request, or write its title or description.                             | `/open-pull-request`, or ask to open a pull request.                                                | Checks the branch and what the change needs, runs the checks, and writes the title and description the way `CONTRIBUTING.md` asks.                                           |

For code, write with `sohedra-write-code`, finish with `sohedra-unslop`, then run
`sohedra-expert-review` before you merge, and open the pull request with `open-pull-request`. There
is no docs skill yet: the repository has no docs site, and doc comments follow
`contributing/code.md`.

The skills live in `.agents/skills/`, where Codex, Cursor, Gemini CLI and GitHub Copilot find them,
and each is linked from `.claude/skills/` for Claude Code (`pnpm lint` checks the links). Type a
skill's name as a slash command, or describe the task and the skill loads on its own. In a harness
that doesn't load skills, ask your agent to read the skill's `SKILL.md` and follow it.

The experts the review skill asks are in `.agents/experts/` (`svelte`, `lynx`), and Claude Code
loads them as the subagents `svelte-expert` and `lynx-expert` from `.claude/agents/`. Ask one any
question about its platform, or to review code.
