# Proposal

## Why

A person who works only in Claude Code on the web (a PM, for example) gets the Relevo commands listed in the session once the plugin hook is in place, but most of them cannot work there. A session on the web blocks GitHub's GraphQL API: `gh issue list`, `gh label list` and `gh pr list` fail with `HTTP 403: GitHub GraphQL is not available from Claude Code sessions; use the REST API`, `gh auth status` fails with `The token in GH_TOKEN is invalid`, and only `gh api` (REST) works, with full permissions on the repository. Observed in a new web session on the sandbox repository with plugin 0.13.0. The commands that read and write issues use the high-level `gh issue` and `gh repo` subcommands, which go through GraphQL, and `/relevo:status` and `/relevo:init` stop at `gh auth status`. Until this changes, the install page has to tell a PM on the web to write the issues on github.com by hand.

## What Changes

- A new script, `scripts/gh-web.mjs`, that offers the `gh` subcommands the PM commands use, with the same flags and the same `--json` output, and runs them over REST (`gh api`) when the session is remote (`CLAUDE_CODE_REMOTE=true`). Outside a remote session it hands the arguments to `gh` unchanged, so a terminal and the GitHub Actions runners behave exactly as today. The subcommands of the first version: `issue view` (with `--json` and `--comments`), `issue list` (with `--search`, `--state`, `--json`, `--limit`), `issue create`, `issue edit` (title, body, `--add-label`, `--remove-label`), `repo view --json nameWithOwner` and `label create --force`.
- The commands of the person who writes and reads issues call that script instead of `gh`: `/relevo:issue` (and its update flow), `/relevo:status`, `/relevo:think`, `/relevo:init` and `/relevo:doctor`.
- The check "can this session talk to GitHub" stops being `gh auth status` and becomes a read of the repository over REST, in a remote session. `/relevo:status`, `/relevo:init` and `/relevo:doctor` use it; the message names the real cause when it fails.
- `/relevo:init` plans the second `SessionStart` hook (the one that installs the Relevo plugin in a web session) and `/relevo:doctor` warns when it is missing. Both shipped in 0.13.0 without a spec; this change records them.
- The install page drops the limit it states today for the commands covered, and keeps it for the ones that are not.
- Out of scope, and said so in the install page: `/relevo:go`, `/relevo:fix`, `/relevo:ship` and `/relevo:review` (`pr merge`, `pr checks`, `pr edit`, `pr create`, `issue close`, `issue comment`, `workflow run`), the scripts that run on the Actions runners (GraphQL is allowed there), and the OpenSpec CLI. A later change can add subcommands to the same script.

## Capabilities

### New Capabilities
- `web-sessions`: how Relevo reaches GitHub from a session of Claude Code on the web: the REST adapter and the subcommands it covers, that it changes nothing outside a remote session, that its `--json` output has the shape `gh` gives, and the check that a session can reach the repository.

### Modified Capabilities
- `init-doctor`: init plans the hook that installs the Relevo plugin in a web session, and doctor warns when a web session has none (both shipped in 0.13.0 without a spec).

## Impact

- New: `scripts/gh-web.mjs` and `scripts/lib/gh-web.mjs` (parsing of the flags, the REST calls and the mapping to the `gh` JSON), with tests built on recorded REST responses.
- `scripts/lib/doctor.mjs` (`ghAuth` fact), `scripts/doctor.mjs`, `scripts/init.mjs` and `scripts/lib/init.mjs` (repository name, label creation, access check), the skills `issue`, `status`, `think`, `init` and `doctor` and the reference `skills/issue/references/update.md`.
- `docs/install.md`, `docs/install.es.md`, the pages of the commands and the changelog.
- No new dependency. No change for a terminal or for the workflows. The REST search endpoint has its own rate limit (30 requests a minute when authenticated), which the similar-issues search of `/relevo:issue` stays well under.
- Risk: a REST response that differs from the `gh` JSON in a field a script reads (for example `state` is `open` in REST and `OPEN` in `gh`); the mapping is written per field and tested against both.
