# Tasks

## 1. The hook and the fact

- [ ] 1.1 `WEB_PLUGIN_HOOK_COMMAND`: both `claude plugin` commands at `--scope local`; keep the remote-only guard, the log file and `|| true`
- [ ] 1.2 `webPluginHookDeclaration`: `{ declared: true, scope }` from the `--scope` flag of the install command (no flag counts as project); `{ declared: false }` and `{ unreadable }` as before
- [ ] 1.3 Tests of the fact: local, project, no flag, written by hand, other hooks only, missing file, invalid JSON

## 2. Init

- [ ] 2.1 `mergeWebHook(text, 'plugin')`: replace the command of a hook that installs at the project scope with the new one, keeping the rest of the entry and of the file; idempotent; unchanged behaviour when there is no hook or the hook is already local
- [ ] 2.2 The plan item: `todo` with both commands in the detail for an older hook, `ok` for a local one, the same lines as today for the other cases
- [ ] 2.3 `scripts/web-hook.mjs --hook plugin`: the message says "updated" when it replaced a command
- [ ] 2.4 `skills/init/SKILL.md`: the plugin hook item says that it installs at the local scope and that an older hook is updated, after a yes to it alone
- [ ] 2.5 Tests: a new file, both hooks in one file, an older hook updated with other hooks kept, run twice, an invalid file untouched, the person declines

## 3. Doctor

- [ ] 3.1 A check `web.plugin-hook-scope`: warn in a remote session when the hook installs at the project scope, with the cause and `/relevo:init`; nothing on a terminal or without the fact
- [ ] 3.2 Tests: the three scenarios of the spec, and that the existing `web.plugin-hook` check is unchanged

## 4. Documentation

- [ ] 4.1 `docs/install.md` and `docs/install.es.md`: the commands of the hook are the local-scope ones; the note about the reordered `settings.json` is replaced by what is true now and by how to update an older hook
- [ ] 4.2 The pages of `init` and `doctor` (both languages); changelog under Unreleased, and the known limit of 0.14.1 closed

## 5. Check in a real web session

- [ ] 5.1 In a new web session on the sandbox repository, with the version that has this change and the updated hook: after the first message `/relevo:doctor` is available, the plugin is listed at the local scope, `git status` shows no change, and no pull request is opened
- [ ] 5.2 Run `/relevo:init` on a repository with the older hook: the plan shows the update, and a second run reports it as in place
- [ ] 5.3 Run `npm test`; the only failure allowed is the one that comes from a preinstalled Playwright in the environment
