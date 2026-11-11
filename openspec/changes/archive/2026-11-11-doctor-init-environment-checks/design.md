# Design

## Context

`doctor` is `scripts/doctor.mjs` over `scripts/lib/doctor.mjs`: `gatherFacts` collects facts with read-only calls (`readOnlyGh`), `runChecks` turns them into pass/note/warn/fail. Already there: `linkChecks` (reads each link with the person's sign-in and checks the secret name), `runnerChecks` (compares literal `runs-on` lines with `runner.labels`; `parseRunsOn` returns null for an expression), `summarizeProtection` (has `requiredChecks`), `pluginInstallChecks` (compares pins with the installed plugin, never the registry). `init` builds its plan in `scripts/lib/init.mjs` with items of kind `manual` or applied ones. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Four new findings in `doctor`, each with a fix next to it; matching plan items in `init`.
- Keep `doctor` read-only and offline-tolerant.

**Non-Goals:**
- Changing protection, secrets or variables automatically.
- Changing the templates or `validate-config`.
- Reading issue bodies for links: only `links` in `relevo.yml` is judged.

## Decisions

1. **Links.** Keep the existing reachability read; reword the failure to name the repository and the two ways out. The value of `RELEVO_LINKS_TOKEN` is never read, so with the secret present and a private repo, add a note that its coverage is unverified. Alternative (probing with the token) rejected: it would read a secret.
2. **Effective runner.** In `runnerChecks`, when `runs-on` contains `vars.NAME`, extract `NAME` and an optional `|| 'fallback'`/`fromJSON` default, read the variable with `repos/{repo}/actions/variables/NAME`, and compare. A mismatch is a warning (not a fail: the person may intend it) that prints both sides and says the variable wins. Unparseable → note "not judged"; variable unreadable → note, never a pass.
3. **Stale pin.** Fact `publishedVersion` from `npm view @elalfner/relevo version` (via the injected `tool`, 5 s timeout). Failure of any kind → `null` → a note. The "what newer versions fix" text comes from `CHANGELOG.md` of the installed plugin (sections with version greater than the pin and at most the published one, headings and first sentence of each bullet); if the installed plugin lacks those sections, point to the changelog URL. This is separate from the existing "pin differs from installed plugin" warning, which stays.
4. **Required checks.** New check `repo.protection.checks` for the base branch from `summarizeProtection(...).requiredChecks`: warn when false. Protection already unavailable/unreadable gives a `could not be checked` warning (reusing `protectionError`), never a pass. `ship.app` keeps its logic.
5. **Init.** Add plan items from the same facts: `manual.links-token` (already exists, extended to the unreadable case), `manual.runner-variable`, `manual.branch-checks`, and no new apply item for the pin (the existing workflow merge already updates it).

## Risks / Trade-offs

- `npm view` needs the network; it is skipped with a note, so offline runs are unchanged except for one note.
- A variable-driven `runs-on` has many shapes; unsupported ones are reported as not judged rather than guessed.
- A warning on missing required checks may annoy repositories that deliberately have none; it is a warning, not a failure.
