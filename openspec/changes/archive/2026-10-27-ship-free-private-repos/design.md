# Design

## Context

`requiredChecks(gh, repo, branch)` in `scripts/lib/ship-github.mjs` asks GitHub for the rulesets that apply to the base branch (`rules/branches/<b>`) and then for its classic protection (`branches/<b>/protection`), and returns `{ required, contexts }`. The first call is parsed without a `try`; the second tolerates only a 404 (`notFound`). `runUnattendedShip` calls it after the pull request is judged and, if checks are required and there is no App, stops with `ship_needs_app`. Its outer `catch` handles only its own `Stop`; any other error is rethrown, so the process dies and the template's last step ("Report a run that ended without an outcome") removes the label with a generic comment.

`doctor` already recognises the plan refusal when it lists rulesets (`/Upgrade to GitHub|not available/`) and sets `protectionUnavailable`, but reports it with `warn`. Its per-branch protection call goes through `tryRun`, which already returns null on any error.

## Goals / Non-Goals

**Goals:**
- A plan refusal is "no rules"; any other failure to learn the rules is a stop with a readable reason.
- One shared definition of "plan refusal", used by ship and doctor.

**Non-Goals:**
- Changing what `shipDecision` checks, or who may ship.
- Changing `init` (it already lists protection as manual when unavailable).
- Making a repository with no CI at all ship by label: that still needs `review.ship_without_ci: true`, as before.

## Decisions

**Plan refusal needs both status and text.** A function `planRefusal(err)` (exported from `ship-github.mjs`, reused by `doctor.mjs`) is true when the error text of `gh` contains `HTTP 403` and matches `Upgrade to GitHub|make this repository public`. A 403 for permissions has neither text, so it still propagates. Alternative considered: any 403 means "no rules". Rejected: a token without access would then merge without checking checks that exist, which is the failure the request forbids.

**Both calls tolerate it, the rules call keeps its other failures.** `rules/branches` gets the same `try` as the classic call: plan refusal → no rules; anything else → throw. The classic call tolerates 404 (no protection) and the plan refusal. Alternative: skip the classic call after the rules call was refused for the plan. Rejected: it adds state for no gain; both endpoints answer the same refusal and each is cheap.

**Unexpected errors become stops inside `runUnattendedShip`.** The `catch` turns a non-`Stop` error into `ship_stopped` with the reason `firstLines(err.stderr || err.message)`, which is how `git` and merge failures are already worded. The same path removes the label and comments, so no new message kind is needed. A failure while commenting is left to throw: the template's last step still removes the label. Alternative: wrap only the `requiredChecks` call. Rejected: every `gh` call in the sequence can fail the same way and the person needs the reason in all of them.

**`doctor` uses `note`.** The `protectionUnavailable` branch becomes `note('repo.protection', 'no branch protection is available on this plan; approval and merge are enforced only by the written confirmation in ship')`. `shipChecks` keeps returning early for it. The other read failure (`protectionError`) stays a warning.

**Template.** `checks: read` and `statuses: read` are added to the `permissions` block of `relevo-ship.yml`; the version marker and `RELEVO_VERSION` become `0.9.2`, together with the version line of the other templates (the release process keeps them in step).

## Risks / Trade-offs

- [GitHub changes the refusal text] → the repository falls to the stop path with the message in the comment, not to a merge; the tests pin the current text.
- [A real 403 for permissions carries "Upgrade" in another wording] → unlikely, and the failure mode is a stop, never a merge.
- [Catching every error hides a bug of the script] → the comment carries the message and the run log keeps the stack; nothing is merged.

## Migration Plan

Release 0.9.2 on `dev`, promote to `main`, tag. A consumer sets `RELEVO_VERSION` to `0.9.2` in `.github/workflows/relevo-ship.yml` and adds `checks: read` and `statuses: read` to its `permissions` (`/relevo:init` reports the difference). Rollback: set `RELEVO_VERSION` back.
