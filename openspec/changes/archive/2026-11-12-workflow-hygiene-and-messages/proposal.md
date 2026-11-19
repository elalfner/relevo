# Proposal

## Why

Two findings of the pilot (#115) edit the same files, the workflow templates and the message catalog, so they ship as one change.

- **#132.** Every run of the go workflow printed a warning that `actions/checkout@v4` and `actions/setup-node@v4` run on Node.js 20, which GitHub is retiring, and downloaded Bun again. The Bun download is not in Relevo's templates: `claude-code-action@v1` installs Bun 1.4.4 itself with `no-cache: true` (read in its `action.yml` at `v1`, commit `4fa93a8`). The action has an input, `path_to_bun_executable`, that skips that install. OpenSpec is also installed from npm on every build.
- **#127.** A queued issue says "the limit of concurrent agents was reached" and nothing else: no run count, no position, no idea how long a build takes. And a repository with `language: es` still received English comments: the usage comment and three comments written inline in `relevo-go.yml` ("the run failed before it could decide", "the run stopped because the usage limit was reached", "the run ended without a result", plus the "kept the work" variant).

## What Changes

- The workflow templates pin the actions that run on Node.js 20 to a newer release **by full commit SHA with the version in a comment**, each verified against the action's own repository: `actions/checkout` v7.0.1, `actions/setup-node` v7.1.0, `actions/create-github-app-token` v3.3.0 and `supabase/setup-cli` v3.2.0. The new cache steps use `actions/cache` v6.1.0 and `oven-sh/setup-bun` v2.2.0 (the commit `claude-code-action` already trusts). `claude-code-action` stays as it is.
- The build job installs Bun itself at an exact version (`BUN_VERSION`, 1.4.4, the one the action installs) and hands it to the action with `path_to_bun_executable`, and caches that Bun and the pinned OpenSpec by version. Both caches are **restored before and saved right after the install, before the agent starts**, never by a post-step that runs after the agent.
- `doctor` reports a workflow that still uses a Node.js 20 pin of those actions; it never changes it.
- The queue comment says how many runs are active and which, how many issues are ahead, and the typical duration of recent builds, each one `unknown` when the data cannot be read. The planner counts the first two from the issues; the typical duration comes from the last completed `build` jobs of the go workflow (needs `actions: read` on the light `decide` job, read-only).
- Every comment follows `language`: the inline texts of `relevo-go.yml` move into the catalog (a new `run_no_outcome` kind with its variants and a `run_failed_early` kind), and the usage comment takes its phrases from the catalog. A language that lacks a key falls back to English, and a test fails Relevo's own build when any supported language misses a key or changes a placeholder of the English one.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `plugin-distribution`: pins of the actions in the templates, the downloads of a build cached by version.
- `init-doctor`: `doctor` reports an old action pin and changes nothing.
- `issue-lifecycle`: the queue comment says position, active runs and typical duration.
- `configuration`: every comment follows `language`; a missing key fails the test, not the user.
- `security`: the caches are written before the agent starts; the new permission is read-only.

## Impact

`templates/workflows/*.yml` (all six, plus `templates/deploy-supabase.yml` for the same pins), `scripts/lib/messages.mjs`, `scripts/render-message.mjs`, `scripts/lib/plan.mjs`, `scripts/lib/github.mjs`, `scripts/go-plan.mjs`, `scripts/lib/run-usage.mjs`, `scripts/run-usage.mjs`, `scripts/lib/doctor.mjs`, tests (`messages`, `plan`, `usage`, `workflow-go`, `workflow-ship`, `security`, `doctor`, a new language-parity test), `docs/action-parameters.md`, `docs/execution.md`, `docs/security.md` (both languages), `CHANGELOG.md` (unreleased). The version in `.claude-plugin/plugin.json` is not changed.

Out of scope: replacing or re-pinning `claude-code-action`; adding languages; updating the position of an issue that stays queued after its first comment; the `version: latest` of the Supabase CLI step (a choice of the project, reported in the design).
