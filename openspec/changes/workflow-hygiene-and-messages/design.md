# Design

## Context

Observed in the code on `dev` at `3034f73`, not taken from the issues:

- All workflow templates use floating major tags (`actions/checkout@v4`, `actions/setup-node@v4`, `actions/create-github-app-token@v1`, `supabase/setup-cli@v1`, `subosito/flutter-action@v2`, `shivammathur/setup-php@v2`, `anthropics/claude-code-action@v1`). `RELEVO_VERSION` and `OPENSPEC_VERSION` are exact. Tests match these strings (`workflow-go`, `workflow-ship`, `security`, `doctor`) and the stale-version check of `doctor` only compares `RELEVO_VERSION`.
- The Bun download is **inside `claude-code-action`**: its `action.yml` (`v1`, commit `4fa93a88`) installs `oven-sh/setup-bun@0c5077e5… # v2.2.0` with `bun-version: 1.4.4` and `no-cache: true`, unless `path_to_bun_executable` is set. No template mentions Bun.
- `setup-bun`'s cache key is a hash of the download URL, which contains the version, and its post step saves the binary at the end of the job (`src/cache-save.ts`). The action's comment says that this save is not ref-aware and hits a 409 on repeated saves.
- `planGo` (`scripts/lib/plan.mjs`) already knows the running issues (`runningSet`), the order of the candidates (urgent first, then `ready_at`) and the built issues of each assignee. `queued_agents` carries only the issue and the title; `queued_capacity` carries `built` and `limit` but not which issues.
- Inline English in `relevo-go.yml`: the `decide` step that reports a run that failed before it decided; and in the `build` job the three branches of "Report a run that ended without an outcome" (kept the work, usage limit, no result), with their `why`, `next`, `cutnote` and `kept` pieces. `run-usage.mjs` writes the usage sentence in English only. `ship_failed`, `toolchain_missing`, `installed_missing`, `needs_spec` already go through `render-message.mjs`.
- `create-github-app-token` v3 deprecates the input `app-id` in favour of `client-id` (a different value: the Client ID, not the numeric App ID); v2.2.2 still runs on Node.js 20. `supabase/setup-cli` v1 runs on Node.js 20; v3.2.0 is a composite action.

Constraints from the issues: C1 of #132 (exact pins, no floating tags in security-sensitive steps; a cache of a pinned download keyed by the version; `doctor` reports, never changes; `claude-code-action` out of scope); C1 of #127 (messages produced by `render-message.mjs`, a missing language key falls back to English with a test that fails the build); C2 of #115 (no guard is weakened).

## Goals / Non-Goals

**Goals:** no Node.js 20 warning from the templates' own actions; the downloads of a build cached by the version without opening a path for the agent into a cache; a queued issue with real figures; every comment in the configured language.

**Non-Goals:** replacing `claude-code-action`; pinning the other third-party actions that already do not warn (`flutter-action`, `setup-php` are composite or Node 24) by SHA; changing `version: latest` of the Supabase CLI step; refreshing the position of an issue that stays queued; adding languages.

## Decisions

### D1. Pins: full SHA with the version in a comment, verified from each repository
`uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`. A tag can move, a SHA cannot; the comment keeps it readable and lets `doctor` and a person see the release. Each SHA was read with `git ls-remote --tags` and the tree was cloned at the tag to read `action.yml` (`runs.using`) and confirm that the commit is the tag's:

| Action | Pin | Runtime at that commit |
|---|---|---|
| `actions/checkout` | `3d3c42e5aac5ba805825da76410c181273ba90b1` # v7.0.1 | node24 |
| `actions/setup-node` | `949feb2413d6458794dcd2491c4babbbce0c15c1` # v7.1.0 | node24 |
| `actions/create-github-app-token` | `64ab729a6294000f5aa4a4bc0b73d1f32bc45510` # v3.3.0 | node24 |
| `actions/cache` | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` # v6.1.0 | node24 |
| `oven-sh/setup-bun` | `0c5077e51419868618aeaa5fe8019c62421857d6` # v2.2.0 | node24 (the SHA `claude-code-action` pins) |
| `supabase/setup-cli` | `689adcfb80d947100a1eab127289b97d1fb07b13` # v3.2.0 | composite |

The apply step repeats this check before writing each pin and records the commands in the PR. Alternatives discarded: moving `@v4` to `@v5`/`@v7` (still a movable tag, against C1); leaving the other actions alone (they would keep warning).

`create-github-app-token` v3 marks `app-id` as deprecated (`client-id` takes the Client ID, a different value than the secret `RELEVO_SHIP_APP_ID` holds). v2.2.2 is Node.js 20. We take v3.3.0 and keep `app-id`: the Node 20 warning goes away, and a deprecation notice about the input stays when the App is used (see Open Questions). Changing the secret to a Client ID would break every repository that stored the App ID.

The other third-party actions are not touched: `flutter-action` is composite and `setup-php` is Node 24 at their current `v2`, so they do not warn. They stay on `@v2` and are named here because C1 would also have them pinned by SHA; that is a separate decision.

### D2. Bun: install it ourselves at an exact version and hand it to the action
Today the action downloads Bun on every run. The input `path_to_bun_executable` is documented by the action ("skips automatic Bun installation"). The build job gets `BUN_VERSION: '1.4.4'` (the version `claude-code-action@v1` installs today) and, before the agent: restore the cache, install if missing, check `bun --version`, and pass `path_to_bun_executable` to the agent step. The input joins the list in `docs/action-parameters.md` and `tests/security.test.mjs`. Alternative discarded: leaving the download to the action (an upstream choice we cannot change); asking the action to enable its cache (no such input).

Risk: `claude-code-action@v1` moves and starts to need another Bun. The action warns that an incompatible version can break it. `BUN_VERSION` is next to `OPENSPEC_VERSION` at the top of the file, and `docs/action-parameters.md` says to re-check it when the action's pin changes. The run is not made fragile by a guess: Bun 1.4.4 is what the action runs today.

### D3. Caches are restored first and saved before the agent, by separate steps
`oven-sh/setup-bun` and `actions/cache` (the combined action) save in a post step, which runs after the agent. The agent has `Bash` and writes to the runner; it could replace the cached binary and the post step would then save it under the key of a later run on the default branch. Instead:

1. `actions/cache/restore` with `key: bun-${{ env.BUN_VERSION }}-${{ runner.os }}-${{ runner.arch }}` and the path of the binary.
2. When there is no hit: `oven-sh/setup-bun` with `bun-version: ${{ env.BUN_VERSION }}` and `no-cache: true` (its own cache is off, so its post step saves nothing), then `actions/cache/save` right there.
3. Always: `"$BUN" --version` must equal `BUN_VERSION`, else the step fails with both versions.

OpenSpec gets the same: the key `openspec-${{ env.OPENSPEC_VERSION }}-…`, the folder `$RUNNER_TEMP/openspec`, and the existing `npm install --prefix … @fission-ai/openspec@$OPENSPEC_VERSION` still runs after a restore (a no-op when present, an exact reinstall when not) so a restored folder is never trusted for the version. The saves are `if: steps.<restore>.outputs.cache-hit != 'true'` and run before "Check the toolchain" and the agent. A test fails when a `cache/save` or a `cache` (combined) step appears after the agent step. If the cache service is unreachable the steps continue (`continue-on-error` on restore and save) and the build installs as before. A cache is visible to runs of the same repository and ref scope, so a restored tool is trusted only as far as the pin and the version check go; the doc says so.

### D4. `doctor` reports old action pins with a small table
`scripts/lib/doctor.mjs` gets a table of `{ action, oldMajors, reason }` for the four Node.js 20 actions, reads the `uses:` lines of the installed Relevo workflows (it already reads them for the runner and pin checks) and warns once per workflow with the line. It is part of the checks that read files only. The fix text is the one of the stale text/pin warnings (`/relevo:init`). Alternative discarded: comparing against the latest release of each action over the network (the registry check of `doctor` is already optional and offline-tolerant; a fixed table of known-bad majors needs no network and cannot report a pin the repository chose on purpose that is still fine).

### D5. The queue position uses what the workflow can read
`planGo` counts, in the loop that already orders the candidates, how many issues are queued for an agent slot before the current one (`ahead`, existing `queued` ones included) and lists the active issues (`running`: the issues labelled `building` plus any given by `--running`). The typical duration comes from `gather`: for the last 10 completed runs of `relevo-go.yml` it reads the `build` job (`started_at`, `completed_at`) and returns `recent_builds_min` (sorted list). The median of at least 3 samples goes in the comment with the number of samples; otherwise `unknown`. The run duration is not used because a run that only decides lasts seconds. Any read error (403 without `actions: read`, 404 without runs) gives `null` and never fails the plan.
The wording says "builds took about N min (median of the last K)": it is what the repository measured, not a forecast. `queued_capacity` gets `built_issues` (`#12, #14`) from the data `planGo` already has. The `decide` job gets `actions: read`; it is read-only and `actions: write` stays in `requeue` (see the security delta). Alternatives discarded: guessing a wait from the limit (an invented number); reading the usage markers of old comments (a lot of calls and a format meant for the digest); updating the comment while it is queued (more writes and a trigger for it).

### D6. Language: one catalog, a fallback and a parity test
- `renderMessage` uses `CATALOG[lang][kind] ?? CATALOG.en[kind]`, so a missing kind renders in English instead of throwing.
- `tests/messages-language.test.mjs` fails when a language of `SUPPORTED_LANGUAGES` lacks a kind of English, has an extra kind, or a line has a different set of placeholders; it also covers the phrase tables of D7 the same way and renders every kind in every language with sample data to check that nothing is left as `{{…}}`.
- The comments that were inline become two kinds, with the variants decided by data the shell passes, in the same style as `qa_failed`: `run_failed_early` (the `decide` step) and `run_no_outcome` with `situation` = `kept` | `usage_limit` | `no_result` and the optional `cut` (`turns`|`cost`), `rescue_state`, `rescue_branch`, `rescue_detail`, `job_status`, `run`, `assignee`, `issue`. The workflow builds a JSON with `node -e` as the other steps do, pipes it to `render-message.mjs --config relevo.yml`, and posts the result. The commands in the text (`/relevo:fix`, the labels) are the ones of the English text.
- The `decide` step runs when the install itself may have failed. If `render-message.mjs` is missing or fails, it posts the English sentence it carries (the only text left in the templates) and the requirement says so. In `build` the package is in `$RUNNER_TEMP/relevo` (the "Check the toolchain" step has verified `render-message.mjs` there), and the same fallback applies if that step did not run.
- The detail of a refused rescue (`RESCUE_DETAIL`) is produced by `rescue-work.mjs` in English and is quoted, like a finding. Auditing every other path that posts a comment is task 4.4; any that is found is moved to the catalog or listed in the PR.

### D7. The usage sentence takes its phrases from the catalog
`usageLine` in `lib/run-usage.mjs` composes a sentence from many parts (agents, models, checks, plan, escalations). Moving that into one catalog line is not natural, so the phrases (`This run used`, `turns`, `by subagents`, `By agent:`, `Cost by model:`, `Models chosen:`, …) go into a `USAGE_TEXT` table in `messages.mjs`, exported with `usageText(language)`, and `usageLine(usage, { …, language })` uses it; `run-usage.mjs` reads `--language` or the `language` of `--config`. The parity test of D6 covers the table. This keeps the composition in `run-usage.mjs`, where its tests are, and the words in the one catalog. Alternative: a `run_usage` kind rendered by `render-message.mjs` from a JSON of the figures; it moves 40 lines of composition into the catalog module for no gain in coverage. The step "Report what the run used" passes `--language` through `--config`, which it already does.

## Risks / Trade-offs

- **Not tested against GitHub.** The pins are verified in each action's repository, but nothing runs a real workflow here. A bad pin shows as a failed step on the first run; the PR lists the manual test.
- **`checkout` and `setup-node` v7 need a recent runner.** `checkout` v6/v7 requires Actions Runner ≥ v2.329.0 for authenticated git from a container action and v2.327.1 for Node 24 actions generally; GitHub-hosted runners are well above it, a self-hosted runner that is older fails at the first step with a clear message. The docs say so; `doctor` cannot see the runner version.
- **Deprecation notice of `app-id` remains** for repositories that use the App (see Open Questions).
- **Cache poisoning is reduced, not removed:** a restored binary is as trusted as the cache of the repository, plus the version check. A different binary that reports the same version passes. The save-before-agent rule is what keeps the agent out of it.
- **The typical duration is a median of builds that may include failures** and says nothing about the queue ahead; the text says what it is.
- **`claude-code-action@v1` may move** its Bun version; D2 names it.

## Migration Plan

No version bump (the maintainer releases). A repository that copied older templates keeps working; `doctor` warns about the old pins and `/relevo:init` merges the new text. The text stamp `# relevo-template:` is unchanged and moves with the release.

## Open Questions

- **`app-id` vs `client-id` of `create-github-app-token` v3.** Recommended: keep `app-id` now (no change of secret) and leave the deprecation notice; the alternative is to add `RELEVO_SHIP_APP_CLIENT_ID` in a later change. The maintainer decides; the apply step does the recommended one.
- **Should the other third-party actions (`flutter-action`, `setup-php`, `setup-cli`'s `version: latest`) also be pinned exactly?** Not needed for the warning; C1 could be read to ask for it. Left out here and listed in the PR.
