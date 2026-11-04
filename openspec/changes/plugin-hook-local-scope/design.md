# Design

## Context

See `proposal.md` for why and for how it was reproduced. What shapes the approach:

- The hook text lives in `WEB_PLUGIN_HOOK_COMMAND` (`scripts/lib/doctor.mjs`) and is merged into `.claude/settings.json` by `mergeWebHook(text, 'plugin')` (`scripts/lib/init.mjs`). A hook is recognised by the text `claude plugin install relevo@relevo` (`installsPlugin`), whatever its scope, so an older hook and a new one both count as "declared" today.
- The fact is `webPluginHook` (`{ declared }` or `{ unreadable }`), read by `init` (`install.web-plugin-hook`) and by `doctor` (`web.plugin-hook`).
- Observed with Claude Code 2.1.317: at the project scope the CLI rewrites the whole tracked file with its own key order; at the local scope it writes `.claude/settings.local.json` and leaves the tracked file as it is. A new container that sets up a fresh home folder also gets a global git ignore with `**/.claude/settings.local.json`, so the file is not shown as untracked.
- The declaration that `install.plugin-project` writes (project scope, committed) is for a terminal and stays.

## Goals / Non-Goals

**Goals:**
- A web session that installs the plugin does not modify a tracked file, so it has nothing to commit and no pull request to open.
- A project with the older hook moves to the new one with the commands it already has (`init`, `doctor`), without editing the file by hand.

**Non-Goals:**
- Making the plugin load before the first message of the session (the hook cannot do that; see the install page).
- Stopping a session from committing changes that other things make.
- Changing the declaration for a terminal.

## Decisions

**1. Install at the local scope.** Both commands of the hook take `--scope local`. The marketplace that the committed file declares is added at that scope too, because a cloud session never accepts the trust dialog that would add the declared one. Alternatives: (a) keep the project scope and write the keys of `settings.json` in the order the CLI uses, so the rewrite is a no-op: rejected, because the order of the other keys of a real file (permissions, attribution, sandbox) is not known and the CLI may rewrite them too; (b) let the hook restore the file with `git checkout` after the install: rejected, it discards a person's uncommitted edit in a session that may be theirs; (c) install at the user scope: rejected, it would put the plugin in the home folder of every project in that container.

**2. The hook text changes in one place, and the matcher stays.** `WEB_PLUGIN_HOOK_COMMAND` becomes the local-scope text. `installsPlugin` keeps matching `claude plugin install relevo@relevo`, so a hook written by hand with either scope still counts as a plugin hook, and the scope is a second question.

**3. The fact says the scope.** `webPluginHookDeclaration` returns `{ declared: true, scope: 'local' | 'project' }` for a hook it finds, taking the scope from the `--scope` flag of the install command (a command with no flag counts as project, the default of the CLI). Doctor and init read `scope`; a missing `scope` in a test fixture reads as local, so older callers keep their result.

**4. `init` updates by replacing the command.** The merge, run with the plugin hook, finds the entry whose command installs the plugin at the project scope and replaces that command with the new one, in place and keeping the position, and changes nothing else. If the person had added other commands in the same entry, they stay: only the matching command text is swapped. The plan line is a different one (`install.web-plugin-hook` with status `todo` and the two commands in its detail) so the person sees what is replaced.

**5. Doctor warns, never fails.** The older hook still installs the plugin, so it is a warning with the cause and `/relevo:init` as the fix, like the other web checks, and only in a remote session.

## Risks / Trade-offs

- **The ignore of `settings.local.json` is set by Claude Code, not by Relevo.** If it is missing in a container, the file shows as untracked and the session could commit it. Mitigation: the check of the real session in the tasks looks at `git status` after the install, and the doctor message names the file.
- **A fresh container has the marketplace only at the local scope.** If a later change of Claude Code stops reading the marketplace from the local settings, the hook fails quietly (it never fails the session) and there are no `/relevo:` commands. Mitigation: the log file of the hook and the doctor check on the plugin.
- **Two scopes in one container.** A person who also installed the plugin at the user scope on the same machine sees it listed twice; the project one wins. This is how the CLI already behaves for the declaration.
- **Projects that never rerun `init`** keep the older hook and its pull requests. The warning is the only nudge.
