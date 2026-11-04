# Proposal

## Why

The hook that installs the Relevo plugin in a web session (0.13.0) runs `claude plugin marketplace add` and `claude plugin install` at the **project** scope. Both commands rewrite the repository's tracked `.claude/settings.json`, and they write its keys in another order than the one `init` wrote: `hooks`, `enabledPlugins`, `extraKnownMarketplaces`. The content is the same, but the session now has an uncommitted change, its stop hook asks it to commit and push, and the session opens a draft pull request for it. The sandbox repository got one (#70, "Reorder keys in .claude/settings.json") from a person's first web session, and every later session of every project that has the hook repeats it.

Reproduced on 2026-11-04 in a scratch repository with the plugin 0.14.1 installed: with the settings file committed, the project-scope install leaves `.claude/settings.json` modified (14 lines added and 14 removed, keys reordered, stable on a second run). At the **local** scope, on a fresh home folder (a new container): the marketplace is added and the plugin installed and enabled (`Scope: local`), the tracked files are untouched, `git status` is clean, and the entries go to `.claude/settings.local.json`, which a global ignore that Claude Code creates (`**/.claude/settings.local.json`) keeps out of git.

## What Changes

- The plugin hook of `/relevo:init` installs at the local scope: `claude plugin marketplace add elalfner/relevo --sparse .claude-plugin --scope local && claude plugin install relevo@relevo --scope local`. A new container has nothing to roll back, and a repository that has the hook no longer gets a modified tracked file or a pull request from it.
- `/relevo:init` updates a hook that already installs at the project scope: the plan shows the old and the new command and replaces only that command after a yes, keeping every other setting and hook of the file.
- `/relevo:doctor` warns, in a web session, when the plugin hook installs at the project scope, says why it matters (the session may open a pull request for a rewritten settings file) and gives `/relevo:init` as the fix. It stays a warning: the hook still installs the plugin.
- The declaration in `.claude/settings.json` that `install.plugin-project` writes for a terminal does not change.
- The install page and the changelog say so. English and Spanish.
- Out of scope: stopping a session from committing other changes it finds, and any change to what the declaration for a terminal does.

## Capabilities

### New Capabilities

### Modified Capabilities
- `init-doctor`: the plugin hook installs at the local scope and leaves tracked files alone; init updates an older hook; doctor warns about an older hook.

## Impact

- `scripts/lib/doctor.mjs` (the hook text, a fact that says which scope an existing hook uses, a check), `scripts/lib/init.mjs` (the merge replaces the command of an older hook, a plan item), `scripts/web-hook.mjs` (reports the update), `skills/init/SKILL.md`, the install and command pages, the changelog and the tests.
- A project that has the 0.13.0/0.14.x hook keeps working without doing anything; it gets the warning and the update when it runs `doctor` and `init`.
- Risk: in a container where Claude Code cannot create its global ignore for `.claude/settings.local.json`, the file would show as untracked. Not seen; the doctor message and the design say how to check it.
