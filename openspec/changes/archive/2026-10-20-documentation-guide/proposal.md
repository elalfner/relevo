# Proposal

## Why

Relevo now has nine commands, three stacks, three execution modes, two credentials, a format for the issue, an audit with waivers and an autopilot, and the documentation still reads as it did when there was one command. Facts read in the repository:

- `docs/commands.md` is a table with one row per command, then three short sections added by later changes. It says what each command does but not what to type after it, what it asks, or an example.
- There is no page that answers "what do I do when…": a review found a failure, a reviewer asked for changes, QA failed, the quota ran out, or I do not know the correct behaviour. The answers exist, scattered in the skills and in `docs/execution.md`.
- `docs/issue-format.md` is English only and is not in the list of pages that the parity test checks (`PAGES` in `tests/readme-sync.test.mjs`), so its Spanish never existed and nothing noticed.
- `docs/configuration.md` has the settings in a table, but not `skills.allow_scripts`, `platforms.<name>.checks`, how a profile of the repository adds to the one of the plugin, or what a limit means with a subscription instead of an API key. Nothing checks that every setting the code accepts is written down.
- There is no page on security. The measures are in the specifications (closed tool list, protected paths, no web, skills read from the base branch, a read-only token for linked repositories, `trust: public`), but a person deciding whether to use Relevo on a public repository has no honest summary of what is protected and what is not.
- The plan decided that the guide would come last, because it describes behaviour that has to be final and tried.

## What Changes

- **A guide** (`docs/guide.md`, `docs/guide.es.md`): the life of an issue with the command of each step and who runs it; "what do I do when…" for the cases above; when to use `fix` and when to write a new issue; cloud, local or both and how to switch; credentials and limits by mode; the practice for public repositories.
- **A page on the security model** (`docs/security.md`, `docs/security.es.md`): what Relevo protects, how, and what it does not (prompt injection has no complete answer; code that runs in the runner is only partly contained; the human review of the pull request is the last barrier).
- **The format of the issue in Spanish** (`docs/issue-format.es.md`) and both added to the pages the parity test checks.
- **Commands** with the arguments of each (read from its skill) and an example, in both languages.
- **Configuration** with `platforms`, the profile layers, `checks`, `skills.allow_scripts`, and the meaning of the limits by credential; a test that every setting the code accepts appears on the page.
- **Tests that the documentation does not lie**: every `/relevo:*` command named in any page exists; every one of the nine commands appears in the guide and in the commands page with the argument of its skill; every label, setting, script and file named in the guide exists.
- **The index and the cover** link the new pages.

## Capabilities

### New Capabilities

- `documentation`: what the documentation must contain and what is tested about it.

### Modified Capabilities

None.

## Impact

- Content: `docs/guide.md` and `.es.md`, `docs/security.md` and `.es.md`, `docs/issue-format.es.md`, `docs/commands.md` and `.es.md`, `docs/configuration.md` and `.es.md`, `docs/README.md` and `.es.md`, `README.md` and `README.es.md`, `CHANGELOG.md`.
- Tests: `tests/readme-sync.test.mjs`, `tests/docs-claims.test.mjs` (new).
- Not changed: behaviour, scripts or skills. The pilot findings stay in English only, as they are a log.
