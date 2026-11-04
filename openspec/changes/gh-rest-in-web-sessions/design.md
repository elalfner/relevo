# Design

## Context

See `proposal.md` for why. What matters for the approach:

- In a remote session `gh api` works and the GraphQL-backed subcommands do not. Observed: `gh api repos/elalfner/relevo-sandbox` answered with `admin` and `push`; `gh issue list`, `gh label list` and `gh pr list` answered `HTTP 403 ... GraphQL is not available from Claude Code sessions`; `gh auth status` failed with `The token in GH_TOKEN is invalid` while the REST read worked.
- The scripts already read most state through `gh api` (`scripts/lib/github.mjs`, `apiJson`), and those that run on the Actions runners stay as they are. What breaks are the high-level `gh issue` and `gh repo` calls written in the skills (as text the model runs) and in a few scripts: `scripts/doctor.mjs:25`, `scripts/init.mjs:40`, `scripts/lib/init.mjs` (label creation) and the `ghAuth` fact of `scripts/lib/doctor.mjs`. `scripts/issue-hash.mjs`, `scripts/platform-of.mjs` and `scripts/design-fetch.mjs` also call `gh issue view`, but only `go`, `fix` and `review` run them, so they stay out of this change.
- The skills run scripts as `node ${CLAUDE_PLUGIN_ROOT}/scripts/<name>.mjs`, so a new script is called the same way, and the tests inject the client (`gh(args) -> stdout`) instead of using the network.
- `CLAUDE_CODE_REMOTE=true` is how `doctor` already recognizes a remote session (`scripts/lib/doctor.mjs`). `GITHUB_REPOSITORY` is not set there; the repository is in the `origin` remote (`https://github.com/<owner>/<repo>` in the session observed).
- `can-edit-issue` already upper-cases the state and accepts labels as strings or objects, so it tolerates REST shapes; the other consumers have to be checked one by one.

## Goals / Non-Goals

**Goals:**
- A person who works only on the web can write, read and label issues and run `status`, `think`, `init` and `doctor` with the same commands as on a terminal.
- A terminal and the Actions runners run exactly the code they run today.
- The skills keep one way of calling GitHub, with no branch on the kind of session in their text.

**Non-Goals:**
- `/relevo:go`, `/relevo:fix`, `/relevo:ship`, `/relevo:review` and the pull-request subcommands. The script is built so that a later change adds them.
- Working around the block of GraphQL, signing in to `gh`, or using another token.
- Reproducing the whole `gh` CLI: only the subcommands and flags the covered commands use.

## Decisions

**1. One adapter script, `scripts/gh-web.mjs`, with the arguments of `gh`.** The skills and the few scripts call `node ${CLAUDE_PLUGIN_ROOT}/scripts/gh-web.mjs issue view 42 --json title,body` where they called `gh issue view 42 --json title,body`. In a remote session it answers over REST; otherwise it executes `gh` with the same arguments and returns its output and exit code. The logic lives in `scripts/lib/gh-web.mjs` with the client injected.
- Alternative: rewrite each skill to describe `gh api` calls. Rejected: it changes the behaviour on a terminal too, spreads the field mapping over markdown that the model reads, and cannot be tested.
- Alternative: use the MCP tools of GitHub in a web session. Rejected: they depend on a connector the PM may not have, differ from the `gh` output the scripts read, and do not exist on a terminal.
- Alternative: a branch in each skill (`if remote then gh-web else gh`). Rejected: twice the text in every skill and a place to forget it.

**2. REST through `gh api`, not through our own HTTP client.** `gh api` already uses the token and the proxy of the session, which is what worked in the observation. Reading `GH_TOKEN` to call `fetch` would put the token in our code and in our error messages. The adapter never reads or prints the token.

**3. Mapping per field, written as a table in the code and tested against recorded responses.**

| `gh --json` field | REST source | Shape given |
|---|---|---|
| `number`, `title`, `body`, `url` | `number`, `title`, `body ?? ''`, `html_url` | as is |
| `state` | `state` | upper case: `OPEN`, `CLOSED` |
| `labels` | `labels[]` | `[{name, color?}]` (a string label becomes an object) |
| `assignees` | `assignees[]` | `[{login}]` |
| `milestone` | `milestone` | `{title, number}` or `null` |
| `comments` | `GET .../issues/{n}/comments`, paginated | `[{body, author: {login}, createdAt}]` oldest first |
| `nameWithOwner` (`repo view`) | the repository of the session | `owner/name` |

A field that is asked for and not in the table stops the command (Decision 5). A pull request is not an issue: `issue list` drops the items that carry `pull_request`, as `gh` does.

**4. Search through the search API.** `issue list --search "<words>" --state open` becomes `GET /search/issues?q=<words>+repo:<owner/repo>+is:issue+state:open&per_page=<limit>`. Without `--search` it uses `GET /repos/{r}/issues` and drops pull requests. The search endpoint allows 30 requests a minute when authenticated; the similar-issues step makes one.

**5. Fail closed on what it does not know.** An unknown subcommand, flag or `--json` field stops with a message that names it and exits non-zero before any request is made. `--jq`/`-q` is accepted only for a simple path (`.body`, `.nameWithOwner`, `.[].title`), because the scripts that use it ask for nothing more, and implementing `jq` is not the goal; anything else stops the same way.

**6. The repository of the session is found without GraphQL.** In order: `--repo`, `GITHUB_REPOSITORY`, then the `origin` remote, taking the last two path segments of its URL (and dropping `.git`). `gh repo view` is not used in a remote session. If none gives `owner/name`, the commands stop and ask for `--repo`.

**7. The access check is one function used by `status`, `init` and `doctor`.** In a remote session it reads `GET /repos/{r}` and returns `ok`, or the status and message of GitHub (`401` means no usable token, `404` no access or no repository). The `ghAuth` fact of `doctor` keeps its name and its meaning ("GitHub can be reached") and is computed this way in a remote session; outside one it is `gh auth status` as today. The text of `status` and `init` that says "`gh auth status` must succeed" becomes "the access check must succeed".

**8. The plugin hook gets its spec here.** The hook shipped in 0.13.0 (`install.web-plugin-hook`, `web.plugin-hook`) without a delta; this change adds it to `init-doctor` so the spec matches the code. No code changes for it.

**9. `gh api` goes through unchanged.** The first real use of `/relevo:issue` on the web (0.14.0) sent the milestone lookup, a `gh api` call, through the script as well, the script refused it, and the issue was created without a milestone. The skill says that `gh api` works in both kinds of session, but a model that routes every GitHub call through the script will include `api` too. The script now hands `api` to `gh` in every session, since REST is what the web allows. Alternative: refuse it and tell the skill harder. Rejected: it keeps a trap that only the wording of a skill avoids.

## Risks / Trade-offs

- **A REST response differs from the `gh` JSON in a field a script reads.** Mitigation: the table above, tests that run the mapped output through `can-edit-issue`, `issue-hash`, `platform-of`, `design-fetch` and the update flow of `/relevo:issue`, and recorded responses taken from the sandbox repository.
- **Two code paths, one of them (REST) exercised only on the web.** Mitigation: the passthrough has a test that the arguments reach `gh` byte for byte; the REST path is tested with the injected client; and an end-to-end check in a real web session is a task, not an assumption.
- **A flag that `gh` accepts and the adapter does not.** The skill that uses it fails in a web session with a message that names it, instead of working differently. The list of covered flags is the list in the spec scenarios and the tests.
- **Rate limits.** The search API has the lowest; one search per drafted idea is far from it. The REST calls of one command are a handful.
- **`gh` upgrades.** The adapter does not parse `gh` output, only passes through to it, so a change in `gh` reaches the terminal path as before.
- **Not covered, on purpose.** A PM still cannot ship, fix or go from the web; the install page keeps saying so until a later change covers those subcommands.
