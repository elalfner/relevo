# Design

## Context

See proposal.md for the motivation. What exists today, read in `dev` on 2026-10-29:

- `recommendedSkillFacts` in `scripts/lib/doctor.mjs` looks for the skills of the default set under `.claude/skills` for Claude Code and under `.agents/skills` for Antigravity only, in the folder of each platform and at the root. `init` plans its optional installs from the same facts.
- `resolveSkill` in `scripts/lib/role-skills.mjs` looks in `.agents/skills` and `.claude/skills`, in the folder of the platform first and then at the root, and `go` gives each agent the path of the `SKILL.md` it found.
- `doctor` also reports one note per skill that the plugin's profile lists and the repository lacks (`skills.default.<platform>.<skill>`), next to the note of the stack (`recommended.flutter.claude`).
- Observed on 2026-10-29 with the `doctor` of `dev` on two real repositories: with the skills under `.agents/skills` and none under `.claude/skills`, `scripts/role-skills.mjs --role dev` and `--role qa` gave both skills their paths in `.agents/skills`, and `doctor` still reported the note for Claude Code and no per-skill note. In a monorepo with Flutter in `app/` and nothing installed, `doctor` reported three notes: one per skill and the general one.

## Goals / Non-Goals

**Goals:**

- `doctor` and `init` say about the skills of Claude Code what `go` does with them.
- One cause, one note.

**Non-Goals:**

- Changing what `go` hands to `dev` and `qa`, which was right.
- Telling a skill that is in the working tree from one that is on the base branch. `doctor` judges the working tree and `go` the base branch, so a skill that is not committed yet shows as present to `doctor` and as left out to `go`; this existed before and stays.

## Decisions

**Claude Code counts both folders.** The reason `.agents/skills` did not count was that Claude Code documents only `.claude/skills` for finding skills by name. That matters when the agent is left to discover them. It does not matter here: the profile lists the skills under `skills`, and `go` gives `dev` and `qa` the path of each `SKILL.md`, wherever `resolveSkill` found it. So the facts for Claude Code look in the four places `go` looks (`<path>/.agents/skills`, `<path>/.claude/skills` and the same two at the root), and the facts for Antigravity keep only `.agents/skills`. The install command offered to Claude Code stays `--agent claude-code`, which writes `.claude/skills`, because that is the folder Claude Code reads by itself, and that is what a new install should use. Alternative: also tell the person that the skills are not in the folder Claude Code reads. Rejected: the run does not need it, and the note would again contradict what `go` does.

**The note of the stack replaces the per-skill note when the stack has one.** The per-skill note was written for stacks without a note of their own, and the only stack with default skills has one. Today that is a test of whether `RECOMMENDED` has the stack, in the block of `doctor.mjs` that reports `skills.default.*`. The general note names the missing skills and gives the command for all of them, which is what the person needs; three notes for one cause hide that. Alternative: keep the per-skill notes and drop the general one. Rejected: the general note also carries the plugin sentence and the Antigravity route, and it is reported once per agent.

**`init` needs no rule of its own.** It plans from the same facts, so once `doctor` counts `.agents/skills` for Claude Code, `init` shows the line as done and offers no install for it; a test says so.

## Risks / Trade-offs

- **A repository with the skills only under `.agents/skills` never gets them in `.claude/skills`** → intended: `go` finds them; a person who wants Claude Code to discover them by name too can install them there, and the docs say so.
- **A future stack with default skills and a `RECOMMENDED` entry gets only the general note** → the general note must then name the missing skills; the test for it covers a missing skill by name.
- **The scenario "Only `.agents/skills` and Claude Code" of the archived change changes meaning** → it is modified here and the changelog line of the earlier change is corrected, so the history says what was found.
