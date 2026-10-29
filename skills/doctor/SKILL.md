---
name: doctor
description: Checks that this machine, the repository and GitHub are ready for Relevo and reports what needs action first (failures, then warnings, then notes, with the fix next to each failure and warning) and counts the checks that passed; --all lists them too. It covers the required tools (OpenSpec, git, the GitHub CLI, the toolchain and the targets of each platform's stack profile), the skills that /relevo:think invokes, the extra skills of each role, the optional skills that a stack works better with, relevo.yml, labels and branches, branch protection and approvals, the automation secret and workflows, what the ship workflow needs, in a web session whether the repository installs OpenSpec at its start, and a CI check. Read-only: it never changes anything. Use when asked to check, diagnose or verify the Relevo setup.
argument-hint: "[--all]"
---

# Relevo doctor

Report whether Relevo can run here. This command only reads; it never changes anything.

Scripts live in `${CLAUDE_PLUGIN_ROOT}/scripts/`. Run them with `node`. They hold the checks; use them instead of judging the setup yourself.

## What you must never do

- Never run a command that writes: no `gh` call except the reads inside the script, no `git add`, no install, no file edit. If something is wrong, tell the person the fix; do not apply it. `/relevo:init` is what applies fixes.
- Never read, print or ask for the value of a secret. The script lists secret names only.
- Never hide a failure or turn it into a pass.

## Steps

1. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs` from the repository root. It finds the repository itself; pass `--repo owner/name` only when it cannot. Add `--all` when the person asked for it, to list the checks that passed.
2. Show its output as it is. The first line says what was judged. Then come the `FAILURES`, the `WARNINGS` and the `NOTES`, each with its count; every `[FAIL]` and `[warn]` line has its fix on the next line. A `[note]` asks for nothing: do not present it as a problem. A `recommended.` note says that a stack works better with optional skills (the default Dart and Flutter ones, say) that are not committed to the repository, and carries the install commands; it judges what is committed because the cloud runner reads only that, so a plugin installed on a machine does not clear it. It is not a requirement, and `/relevo:init` offers the installs. A `skills.default.` note says that a skill the plugin's profile gives to a role is not on the base branch and is left out of the run; it carries the command, or `skills.disable` in `.relevo/stacks/<stack>.md` switches the skill off. A `recommended.laravel` note says that Laravel Boost, which installs skills for the packages the project uses, is not in `composer.json` or that none of its skills is committed; it carries the commands and is optional. A `skills.ignored.` warning says that a skill folder exists and git ignores it, so the cloud runner, which reads only what is committed, will not see the skills in it; its fix is to remove the ignore rule and commit the folder. A skill that a profile uses only when installed and that is absent gets no line at all. A `review.` line is about how the review of a platform runs (an api review needs `vendor/` and a known test database; a replaced `review` key of the profile is a note); a warning there carries its fix. The checks that passed are only counted, and `--all` lists them as `[pass]`.
3. If there are failures, say which command fixes most of them: `/relevo:init` for labels, branches, protection, workflows and the ignore line; the install commands shown for tools and skills; adding the model credential to the repository secrets by hand.
4. If a `ship.app` check fails, say that the `relevo:ship` label cannot ship in this repository until a GitHub App and its two secrets exist, because the base branch requires checks, and that `/relevo:ship` still works meanwhile.
5. If the output says branch protection is not available, say plainly that approving and merging are then enforced only by the written confirmation `ship` asks for, not by the platform.

## Exit status

`doctor.mjs` exits 0 when no check failed (warnings allowed) and 1 when at least one failed. Report the result in one line after the output.
