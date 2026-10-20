## Context

See `proposal.md`. Facts read in the code:

- `DEPENDS_RE` in `scripts/lib/issue-parse.mjs` collects every `#(\d+)` of a `Depends-on:` line, so an external reference is read as a local number.
- `gather` in `scripts/lib/github.mjs` fetches each dependency with `repos/<repo>/issues/<n>` and keeps the numbers closed as completed; `planGo` receives them as `completed`.
- `gather`, `go-plan.mjs` and `requeue.mjs` all run `gh` with the workflow's default token (`GH_TOKEN`), which cannot read another private repository.
- The queue workflow runs on a schedule and on label events, so a blocked issue is re-evaluated without any new event.
- `doctor` already lists the repository's secret names (`repos/<repo>/actions/secrets`) to check the model credential and `RELEVO_PLUGIN_TOKEN`.

## Goals / Non-Goals

**Goals:** a correct reference for an issue of another repository; a closed list of repositories; a read-only credential used only to read; a block that explains itself; `issue` that helps write both sides.

**Non-Goals:** waking the dependent repository the moment the other finishes (`repository_dispatch`), reading another repository's archived specification, any write to another repository without the person asking.

## Decisions

**D1. The parser separates the two forms.** `parseIssueBody` keeps `dependsOn` as the local numbers (so no existing caller changes), and adds `dependsOnExternal: [{ repo, number }]` and `dependsOnInvalid: string[]` (tokens that are neither form). The reference grammar is `(owner/repo)?#number`, where owner and repo are letters, digits, `.`, `_` and `-`. The planner is told its own repository (`planGo({ repo })`) so `acme/web#12` inside `acme/web` is folded into the local list; when the repository is unknown the reference stays external. Alternative: full GitHub URLs: more typing and no gain, `owner/repo#N` is how GitHub itself autolinks.

**D2. `links` is validated like a list of names.** In `config.mjs`, `links` is `string[]` with the pattern `owner/repo`, no repeats. It defaults to empty. Whether a linked repository exists is a `doctor` matter, not a validation matter, because validation must work offline.

**D3. An external reference outside `links` is a missing part of the specification**, the same route as an unresolved platform: it is added to the `missing` list and the issue goes to `needs-spec`. The check script gets `--links a/b,c/d` so a draft is judged as the planner would judge it. No new decision, no new message kind.

**D4. Reading is a second `gh` client.** `gather({ gh, ghLinks })`: local calls keep using `gh`; external ones use `ghLinks`, built by `realGhLinks()` from the environment variable `GH_LINKS_TOKEN` (the workflow maps the secret `RELEVO_LINKS_TOKEN` to it). Without the variable `ghLinks` is the ordinary client, which reads public repositories. The token never reaches `gh` for the repository's own calls, and the repositories asked are only those in `links` (D3 filters first). `gather` returns `completedExternal` (`["acme/api#12"]`) and `unreadable` (`["acme/api#12"]`); a read error, a 404 or a 403 is "unreadable". Alternative: one token for everything: it would give the push-capable token to the reads, or the read-only token to the writes.

**D5. Unreadable blocks, loudly.** The planner treats an unreadable reference as not satisfied and writes `acme/api#12 (could not be read: check the RELEVO_LINKS_TOKEN secret)` in the blockers text of the existing `blocked_notice`. The notice is posted when the issue enters `blocked`, as today; `doctor` is the continuing signal. Alternative: send it to `needs-spec`: the specification is fine, so the spec writer cannot fix it.

**D6. `status` reads the external issue once per blocked reference.** `gatherStatus` takes `ghLinks`, looks up each external dependency of the blocked issues (state, and the label that starts with `relevo:` if any), and gives them to `buildStatus` as `externalBlocks`. The label shown is the raw name without its prefix, because the other repository may rename its labels. Unreadable is reported as such.

**D7. `doctor` and `init`.** `doctor` reuses the secrets list it already reads and a repository read (`repos/<link>`) per link to learn whether it is private and reachable; the rule is: private and no secret is a failure, public and no secret a warning, no links nothing. `init` adds `links` to its answers and to the reminder it already prints for secrets.

**D8. `issue` drafts the other side, never writes it unasked.** The skill, when a dependency lives in another repository: finds an existing issue (`gh issue list --repo <link> --search`), or drafts one with the same template and check, shows it whole with the `Depends-on:` placeholder, and creates it (`gh issue create --repo <link>`) only after an explicit yes and only for a linked repository; then writes the real number into the dependent issue. Reusing the data contract: `gh issue view <n> --repo <link> --json body`, extract the `## Data contract` section, offer it. The text read is data.

## Risks / Trade-offs

- [The token is missing and an issue waits forever] → the notice says so when it blocks, and `doctor` fails for a private link without the secret.
- [A linked issue is closed as not planned] → it never satisfies the dependency; the notice shows the reference, and the person edits the dependency.
- [Reading many external issues slows the gate] → one request per distinct reference, only for issues in `ready`, `queued` or `blocked`, as for local ones.
- [The two repositories use different label names] → `status` shows the raw lifecycle label of the other side, not a translated state.

## Migration Plan

Nothing changes for a repository without `links`. A repository that uses cross-repository dependencies adds `links`, creates the read-only token as `RELEVO_LINKS_TOKEN` when a linked repository is private, and copies the workflows again to get `GH_LINKS_TOKEN`.

## Open Questions

None that change the specifications.
