# Parameters of the agent runner (task 6.4)

Verified on 2026-10-14 against the documentation and `action.yml` of `anthropics/claude-code-action` (`@v1`), and against the pilot run described in [pilot-findings.md](pilot-findings.md). Re-check this page when the action releases a new major version. `tests/security.test.mjs` fails if the template starts using an input that is not in the list below.

## Inputs the `go` workflow uses

| Input | Use in the template | Notes |
|---|---|---|
| `anthropic_api_key` | the repository secret `ANTHROPIC_API_KEY` | default credential |
| `claude_code_oauth_token` | the secret `CLAUDE_CODE_OAUTH_TOKEN` (commented alternative) | subscription token from `claude setup-token`; remove whitespace before storing it |
| `github_token` | `${{ github.token }}` | the action documents it for a custom GitHub App; it worked with the workflow token in the pilot |
| `prompt` | `/relevo:go <issue number>` | |
| `claude_args` | `--max-turns`, `--max-budget-usd`, `--plugin-dir`, `--allowedTools`, `--disallowedTools` | the documented way to pass CLI flags. `--plugin-dir ${{ runner.temp }}/relevo` loads the plugin from the package the job unpacked; verified on 2026-10-27 on a run that listed the plugin as `relevo@inline` with its nine commands and two agents (see [pilot-findings.md](pilot-findings.md)) |
| `settings` | the `Read` denials and the sandbox read denials of the restricted files, written between the `relevo:restricted` markers by `/relevo:init` | documented as a JSON string or a path. Read in the source of the action at `v1` (`base-action/src/setup-claude-code-settings.ts`): it is not passed as `--settings`; it is merged into `~/.claude/settings.json` of the runner with a shallow spread, so each top-level key it names replaces the existing one, which is why the template gives the whole `permissions` and `sandbox` objects. That file is outside the repository, so a pull request cannot loosen it |
| `allowed_bots` | `github-actions` (only) | the queue starts builds with `gh workflow run`, so the actor is the Actions bot and the action refuses it otherwise (seen in the sandbox: "Workflow initiated by non-human actor"); never `*` |

## Output the template reads

| Output | Use in the template | Notes |
|---|---|---|
| `execution_file` | the path of the agent's execution log, given to `scripts/run-usage.mjs` (turns, cost and tokens for a comment) and `scripts/usage-limit.mjs` (to tell a usage limit from another failure) | listed in `action.yml`; its content is not documented, so both readers are tolerant and say nothing when they find nothing. The real shape is recorded in [pilot-findings.md](pilot-findings.md) once a run has shown it |

## Inputs the template must never set

| Input | Why |
|---|---|
| `plugins`, `plugin_marketplaces` | the plugin comes from the package pinned by `RELEVO_VERSION`; a marketplace without a version installs the latest plugin, and a private plugin repository would need a token. Workflows copied before this change still set them |
| `allowed_non_write_users` | lets people without write access start a run; the action calls it risky |
| `show_full_output` | prints tool results, which may contain secrets; use only while piloting and never leave it on |
| `trigger_phrase`, `label_trigger` | the run is started by Relevo's own label event, not by the action's triggers |

## Deprecated inputs (do not use)

`mode`, `direct_prompt`, `override_prompt`, `custom_instructions`, `max_turns`, `model`, `fallback_model`, `allowed_tools`, `disallowed_tools`, `mcp_config`, `claude_env`. Their replacements go through `claude_args` (for example `--max-turns`, `--allowedTools`, `--disallowedTools`).

## Open points

- `permissions: id-token: write` is no longer in the template. A run of `go` in the sandbox repository without it built the issue and posted the hand-off (see `docs/pilot-findings.md`), because the template passes `github_token`. Add it back only if you stop passing `github_token`.
- The action documents `show_full_output` in `action.yml` but not on its usage page; treat it as available but sensitive.
