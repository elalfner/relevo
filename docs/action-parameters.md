# Parameters of the agent runner (task 6.4)

Verified on 2026-10-14 against the documentation and `action.yml` of `anthropics/claude-code-action` (`@v1`), and against the pilot run described in [pilot-findings.md](pilot-findings.md). Re-check this page when the action releases a new major version. `tests/security.test.mjs` fails if the template starts using an input that is not in the list below.

## Inputs the `go` workflow uses

| Input | Use in the template | Notes |
|---|---|---|
| `anthropic_api_key` | the repository secret `ANTHROPIC_API_KEY` | default credential |
| `claude_code_oauth_token` | the secret `CLAUDE_CODE_OAUTH_TOKEN` (commented alternative) | subscription token from `claude setup-token`; remove whitespace before storing it |
| `github_token` | `${{ github.token }}` | the action documents it for a custom GitHub App; it worked with the workflow token in the pilot |
| `prompt` | `/relevo:go <issue number>` | |
| `claude_args` | `--max-turns`, `--max-budget-usd`, `--allowedTools`, `--disallowedTools` | the documented way to pass CLI flags |
| `plugins`, `plugin_marketplaces` | `relevo@relevo` and the plugin repository URL | a private repository needs a read-only token in the URL |

## Inputs the template must never set

| Input | Why |
|---|---|
| `allowed_non_write_users` | lets people without write access start a run; the action calls it risky |
| `allowed_bots` | `*` on a public repository lets outside apps start runs |
| `show_full_output` | prints tool results, which may contain secrets; use only while piloting and never leave it on |
| `trigger_phrase`, `label_trigger` | the run is started by Relevo's own label event, not by the action's triggers |

## Deprecated inputs (do not use)

`mode`, `direct_prompt`, `override_prompt`, `custom_instructions`, `max_turns`, `model`, `fallback_model`, `allowed_tools`, `disallowed_tools`, `mcp_config`, `claude_env`. Their replacements go through `claude_args` (for example `--max-turns`, `--allowedTools`, `--disallowedTools`).

## Open points

- `permissions: id-token: write` is in the template. The action documents it for workload identity federation and the OIDC app-token exchange. Because the template passes `github_token`, it was not exercised in the pilot. It is a candidate to remove (least privilege) once a run without it has been seen to work.
- The action documents `show_full_output` in `action.yml` but not on its usage page; treat it as available but sensitive.
