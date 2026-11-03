# Tasks

## 1. Record what the REST API gives

- [ ] 1.1 In a web session on the sandbox repository, record read-only responses for an issue, its comments, a search, an issue list, a repository and a label list (`gh api`), with the token and headers removed, as fixtures under `tests/fixtures/rest/`; note the `origin` URL of that session
- [ ] 1.2 Check from those recordings that the `origin` remote gives `owner/name` in a web session; if it does not, say so in `design.md` (Decision 6) before going on

## 2. The adapter

- [ ] 2.1 `scripts/lib/gh-web.mjs`: remote detection, repository discovery (`--repo`, `GITHUB_REPOSITORY`, `origin`), the flag parser for the covered subcommands, and the passthrough to `gh` that returns its output and exit code unchanged outside a remote session
- [ ] 2.2 `issue view` (`--json` with the fields of the mapping table, `--comments`, `--repo`), `issue list` (`--search`, `--state`, `--json`, `--limit`), `repo view --json nameWithOwner`
- [ ] 2.3 `issue create` (`--title`, `--body-file`/`--body`, `--milestone` by title, `--assignee`, `--repo`) and `issue edit` (`--title`, `--body-file`/`--body`, `--add-label`, `--remove-label`), and `label create --force`
- [ ] 2.4 `--jq`/`-q` for simple paths only; any other subcommand, flag, `--json` field or `--jq` expression stops naming it, before any request, and exits non-zero
- [ ] 2.5 Errors: the HTTP status and the message of GitHub, a non-zero exit, nothing on stdout; the token and the authorization header never appear in an output
- [ ] 2.6 `scripts/gh-web.mjs`: the command line over the library
- [ ] 2.7 Tests with the injected client and the recordings of 1.1: every scenario of `web-sessions`, the passthrough byte for byte, the mapped output through `can-edit-issue`, `issue-hash` and `platform-of`, a `404`, a `401`, an unsupported flag, a pull request dropped from a list

## 3. The access check

- [ ] 3.1 One function that reads `repos/{r}` over REST and returns ok or the status and message; the `ghAuth` fact of `doctor` uses it in a remote session and `gh auth status` otherwise
- [ ] 3.2 `scripts/doctor.mjs` and `scripts/init.mjs`: the repository name without `gh repo view` in a remote session
- [ ] 3.3 Tests: a remote session whose sign-in status fails and whose read works (pass), a `401` (stop with the cause), a terminal (unchanged)

## 4. Use the adapter

- [ ] 4.1 `scripts/issue-hash.mjs`, `scripts/platform-of.mjs` and `scripts/design-fetch.mjs`: read the issue through the adapter
- [ ] 4.2 `scripts/lib/init.mjs`: label creation through the adapter; `readOnlyGh` still refuses anything that writes
- [ ] 4.3 `skills/issue/SKILL.md` and `skills/issue/references/update.md`: `gh issue list/view/create/edit` become `gh-web.mjs`; `gh api` calls stay as they are
- [ ] 4.4 `skills/status/SKILL.md`, `skills/think/SKILL.md`, `skills/init/SKILL.md`, `skills/doctor/SKILL.md`: the adapter, and "the access check must succeed" instead of `gh auth status`
- [ ] 4.5 Tests of the skill texts: no covered command still names `gh issue` or `gh repo` directly, and the init and doctor descriptions mention the plugin hook

## 5. The plugin hook of 0.13.0

- [ ] 5.1 Check that the code matches the `init-doctor` delta (the hook text, the plan item, the doctor check, both hooks in one file) and fix the delta or the code where they differ

## 6. Documentation

- [ ] 6.1 `docs/install.md` and `docs/install.es.md`: the limit narrows to the commands that are not covered; the stopgap stays for them
- [ ] 6.2 The pages of `issue`, `status`, `think`, `init` and `doctor` (both languages) say what changes in a web session; changelog under Unreleased

## 7. Check in a real web session

- [ ] 7.1 In a new web session on the sandbox repository, with the version that has this change: `/relevo:doctor` and `/relevo:status` pass the access check; a person types `/relevo:issue` and creates a small issue with a milestone and an assignee without labelling it `ready`; `/relevo:think <n>` reads it; record the result
- [ ] 7.2 Run the same commands on a terminal and compare with the output before this change
- [ ] 7.3 Run `npm test`; the only failure allowed is the one that comes from a preinstalled Playwright in the environment
