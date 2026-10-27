# Design

## Context

- All six workflow templates in `templates/workflows/` use `runs-on: ubuntu-latest`. `relevo-go.yml` has two jobs (`decide`, `build`), so there are seven `runs-on` lines to keep in step.
- GitHub evaluates `runs-on` before any step runs, so a workflow cannot read `relevo.yml` to choose its runner. Whatever `relevo.yml` says has to be written into the workflow file, or come from a repository variable.
- A project that uses Relevo already runs on `[self-hosted, linux-build]` by hand-editing the five workflows it has (it was on 0.7.0 and has no ship workflow yet). A version bump there was done with a `sed` on `RELEVO_VERSION`, which kept the edit; a regeneration by `init` would not.
- Today the jobs install OpenSpec with `npm install --global`, the Antigravity step writes `$HOME/.local/bin/agy` and `$HOME/.gemini/antigravity-cli/settings.json`, and the plugin is unpacked in `.relevo-plugin` inside the workspace. None of that is cleaned.
- Not verified: where `claude-code-action` leaves files on a persistent runner (a token, a cache under `~/.claude`). Task 1 finds out before any claim about cleanliness is written.

## Goals / Non-Goals

**Goals:**
- One place in `relevo.yml` to say which runner the Relevo workflows use, which survives `init` and is checked by `doctor`.
- The same workflow text is safe on a GitHub-hosted, an ephemeral and a persistent runner, with one code path.

**Non-Goals:**
- Telling an ephemeral runner from a persistent one. Relevo cannot detect it, and a declared value could not be verified.
- Different runners per workflow or per job, runner groups, or sizing the pool of runners.
- Making a persistent runner a sandbox. The agent's code still runs with the runner user's permissions.
- The project's own CI (`ci.yml`): it is the project's and Relevo does not touch it.

## Decisions

### D1. A list of labels in `relevo.yml`, rendered into the workflows

`runner.labels` is a list, because `runs-on` takes a list of labels (`[self-hosted, linux-build]`) and one string cannot express it. `init` writes the value into every `runs-on` when it generates a workflow, and `doctor` compares the files on the default branch with it.

Alternative: a repository variable read in the workflow, `runs-on: ${{ fromJSON(vars.RELEVO_RUNNER || '"ubuntu-latest"') }}`. It survives regeneration without any rewrite and can change without a commit. Rejected as the primary mechanism because the value then lives outside the repository, `doctor` needs the variable API (and a permission) to see it, and the repository would no longer show where its builds run. It stays a possible follow-up.

Alternative: leave it to hand edits and only document it. Rejected: this is the current state, and its failure is silent when a workflow is regenerated.

### D2. No persistence key; one path that assumes persistence

Relevo cannot verify `ephemeral`, so a flag would be an unchecked claim that gates a security property. A cleaning step costs almost nothing on an ephemeral runner, so the workflows always do it. `doctor` states the assumption instead of asking for it.

Alternative: `runner.ephemeral: true|false`. Rejected for the reason above and because it creates a second, untested code path.

### D3. Install per job in `$RUNNER_TEMP`, pinned

OpenSpec is installed with `npm install --prefix "$RUNNER_TEMP/openspec" @fission-ai/openspec@<version>` and `$RUNNER_TEMP/openspec/node_modules/.bin` is added to `GITHUB_PATH`. The path change lasts for the job only. Pinning removes the drift of an unversioned global install on a machine that keeps it. The Antigravity binary and settings move under `$RUNNER_TEMP` too, and the agent is pointed at that settings file.

`$RUNNER_TEMP` is emptied by the runner between jobs, which is assumed, not verified here (task 1). Where something has to live outside it, the final `if: always()` step removes it.

Alternative: cache the installs on the runner for speed. Rejected: it is the persistence this design avoids, and the install is small.

### D4. The final step cleans only what the job added

The step removes `.relevo-plugin` and any other file a Relevo step created in the workspace, and nothing else. It does not run `git clean` on the workspace, because a persistent runner may hold a cache of `node_modules` that the project's own jobs rely on.

### D5. Assumed tools are checked, not installed

`git`, `gh`, `jq` and Node are on GitHub's images and may be missing on a self-hosted one. Installing them needs privileges the job should not have, so the existing toolchain check, which already stops before a model turn, also verifies them and names what is missing.

### D6. `doctor` compares files on the default branch

It reuses the existing rule that the default branch is what runs. Comparison is of the `runs-on` value of each `relevo-*.yml` job with `runner.labels`; a workflow with no Relevo marker is ignored.

## Risks / Trade-offs

- [The labels in `relevo.yml` and in the workflows can drift] → `doctor` fails on it and names the file; `init` rewrites it.
- [A persistent runner still keeps what the agent's code writes elsewhere] → documented as outside Relevo's control; `docs/security.md` recommends an ephemeral runner or a container.
- [Pinning OpenSpec means a version to maintain] → one `OPENSPEC_VERSION` value beside `RELEVO_VERSION`, bumped in the release process.
- [One runner with `limits.concurrent_agents: 1` serves the project's CI too, so a 60-minute build holds up pull request checks] → documented; the fix is more runners with the label, not a Relevo setting.
- [Existing hand-edited workflows now fail `doctor`] → intended; the fix is one line in `relevo.yml`, and the CHANGELOG says so.

## Migration Plan

1. Release with `runner.labels` optional. Nothing changes for a repository without it.
2. A repository on a self-hosted runner adds `runner.labels: [self-hosted, linux-build]`, runs `doctor` (passes, with the persistence note) and keeps its workflows. A new ship workflow is generated with the same labels.
3. Rollback: remove the key and restore `ubuntu-latest` in the workflows.

## Open Questions

- Which OpenSpec version to pin, and whether `OPENSPEC_VERSION` shares the file with `RELEVO_VERSION`. Settled at implementation: `1.14.3`, a separate `env` value beside `RELEVO_VERSION` in `relevo-go.yml` and `relevo-ship.yml`.
- What `claude-code-action` leaves outside the workspace of a persistent runner, and whether the runner empties `$RUNNER_TEMP` between jobs (assumed in D3). Not checked on a real runner when this change was archived; it is a follow-up (see the end of `tasks.md`), and the docs say so.
