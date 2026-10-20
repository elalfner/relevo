# Proposal

## Why

A front-end repository and a back-end repository that both use Relevo cannot yet say that one issue waits for the other. `Depends-on:` reads every `#N` as an issue of the same repository, so `Depends-on: acme/api#12` is silently read as local issue 12 (a defect found by reading `DEPENDS_RE`, and it can unblock the wrong issue). Nothing reads the state of an issue in another repository, `status` cannot show a block that comes from outside, and `issue` cannot help write the back-end issue a front-end issue depends on.

## What Changes

- **`Depends-on: owner/repo#N`.** The parser tells a local reference (`#12`) from an external one (`acme/api#12`), so the defect is gone; a reference to the repository itself written in full counts as local.
- **`links:` in `relevo.yml`.** A closed list of repositories (`owner/repo`) an issue may depend on. An external reference to a repository outside the list sends the issue to `needs-spec`; the text of an issue is data and cannot decide which repository a credential is used against.
- **Reading the other repository.** The gate reads whether the other issue is closed as completed, as it does for a local one. A private repository needs a read-only token stored as the secret `RELEVO_LINKS_TOKEN`; public repositories are read without it. An issue that cannot be read is never counted as completed: it stays blocked and the notice says so.
- **Re-evaluation.** The queue already re-evaluates blocked issues on a schedule; that is how an issue notices that the other repository finished (events do not cross repositories).
- **`status`.** A blocked issue shows what blocks it and the state of the external issue ("blocked by acme/api#7, in-review").
- **`doctor` and `init`.** `doctor` checks that each linked repository is reachable and, when `links` is not empty, that the secret exists (its name only). `init` asks for `links` and reminds the person to create the secret.
- **`issue`.** When the feature depends on work in another repository, `issue` drafts that issue, shows it whole with the `Depends-on:` already pointing at it, and creates it there only if the person asks and the repository is in `links`. It can offer to reuse the `## Data contract` of the issue it depends on.

## Capabilities

### New Capabilities

- `links`: references to issues of other repositories, the closed list, how they are read and with which credential.

### Modified Capabilities

- `configuration`: the `links` setting.
- `go`: gate 2 considers external dependencies; an external reference outside `links` goes back to the spec writer.
- `status`: external blocks and their state.
- `init-doctor`: `links` and the secret.
- `issue`: the draft in the other repository and the reuse of the data contract.
- `security`: the credential for linked repositories and the text read from them.

## Impact

- Code: `scripts/lib/issue-parse.mjs`, `scripts/lib/issue-check.mjs`, `scripts/check-issue.mjs`, `scripts/lib/config.mjs`, `scripts/lib/github.mjs`, `scripts/lib/plan.mjs`, `scripts/go-plan.mjs`, `scripts/requeue.mjs`, `scripts/status.mjs` and `scripts/lib/status.mjs`, `scripts/lib/doctor.mjs`, `scripts/lib/init.mjs`.
- Content: `skills/issue`, `skills/init`, `templates/relevo.yml`, `templates/issue.md`, `templates/workflows/relevo-go.yml` and `relevo-queue.yml`, `docs/issue-format.md`, `docs/configuration*.md`.
- Not changed: execution modes, the review adapters, reading the archived specification of another repository, a `repository_dispatch` event to wake the dependent repository sooner.
