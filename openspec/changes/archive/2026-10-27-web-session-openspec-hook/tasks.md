# Tasks

## 1. The fact and the check

- [x] 1.1 `gatherFacts` of `scripts/lib/doctor.mjs`: read `.claude/settings.json` into `webHook` (true when a `SessionStart` command contains `@fission-ai/openspec`; unreadable and missing files give false) and `remoteSession` from `CLAUDE_CODE_REMOTE`. Verify with unit tests in `tests/doctor.test.mjs`: hook present, missing file, other hooks only, invalid JSON
- [x] 1.2 A check `web.openspec-hook`: pass when remote and present, warn with the fix (`/relevo:init`) when remote and missing, nothing outside a remote session. Verify with tests of the three outcomes and that the healthy fixture stays green

## 2. Init

- [x] 2.1 A plan item `install.web-hook` in `scripts/lib/init.mjs`: ok when the hook is there, an install with the exact hook shown when not, a manual line when the file is unreadable; `applyPlan` never runs it. Verify with tests of the item and of the plan rendering
- [x] 2.2 `skills/init/SKILL.md`: name the line, show the hook, merge it into the existing JSON without changing other keys, leave the file to commit, and do nothing on a no. Verify with a test that reads the text and a merge test with existing settings and existing hooks

## 3. Go

- [x] 3.1 `scripts/lib/preflight.mjs`: the `openspec` failure says to stop, gives `npm install --global @fission-ai/openspec` and says nothing is written under `openspec/changes/` by hand. Verify with a preflight test that checks the message
- [x] 3.2 `skills/go/SKILL.md` step 0 repeats it. Verify with the structure test that fails when the text is missing, and that the closed list of OpenSpec commands is unchanged

## 4. This repository

- [x] 4.1 Replace `.claude/hooks/session-start.sh` and its registration with the inline command in `.claude/settings.json`, keeping the attribution settings. Verify by running the command with `CLAUDE_CODE_REMOTE=true` with and without `openspec` on the path, and outside a remote session

## 5. Documentation

- [x] 5.1 `docs/install.md`, `docs/commands.md` (init and doctor) and their Spanish pages; the changelog under Unreleased. Verify with the docs tests (`tests/docs-claims.test.mjs`, `tests/readme-sync.test.mjs`) and `openspec validate --all`
