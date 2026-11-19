# Proposal

## Why

A pilot on a real project showed four problems that were visible in the configuration before any build ran: a design file in a private linked repository answered 404 with the automation token (the issue went back twice before the file was copied in), `relevo.yml` declared a self-hosted runner while a repository variable made the builds run on a GitHub-hosted one, the workflows pinned a Relevo version that lacked a fix already published, and nobody had confirmed that the base branch requires status checks. `doctor` caught none of them. Part of #115; this is issue #123.

## What Changes

- `doctor` explains an unreadable linked repository: it names the repository and what to grant (`RELEVO_LINKS_TOKEN` with read on it, or copying the file into this repository), and for a private one it notes that the secret's scope cannot be verified.
- `doctor` resolves the effective runner of a workflow whose `runs-on` comes from a repository variable. When it differs from `runner.labels`, it prints both and says which one wins (the variable).
- `doctor` compares the pinned `RELEVO_VERSION` with the published version of the package and, when the pin is older, warns and names what the newer versions fix. It skips the comparison with a note when the registry cannot be reached or the package is not public.
- `doctor` warns when the base branch does not require status checks, since `ship` relies on them, and says it could not check when branch protection could not be read.
- `init` lists each of these as a step of its plan (manual where only the person can act: tokens, branch protection, the runner variable; the workflow update it already offers for a stale pin). It changes no protection and no secret.
- `doctor` stays read-only (C1). The templates are not changed.

## Capabilities

### New Capabilities

### Modified Capabilities

- `init-doctor`: new checks in `doctor` (linked repositories, effective runner, stale pin, required status checks) and the matching proposals in `init`.

## Impact

- `scripts/lib/doctor.mjs` (facts gathered with read-only calls, new checks), `scripts/lib/init.mjs` (plan items), their tests under `tests/`.
- `skills/doctor/SKILL.md`, `skills/init/SKILL.md`, `docs/commands.md` (section on `doctor`), `CHANGELOG.md` (unreleased entry).
- Not touched: `skills/go`, `skills/issue`, `scripts/lens-plan.mjs`, `scripts/validate-config.mjs`, `docs/configuration.md`, `.claude-plugin/plugin.json`.
