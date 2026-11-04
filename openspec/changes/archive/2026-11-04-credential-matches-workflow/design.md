# Design

## Context

See `proposal.md` for the motivation. What exists today and shapes the approach:

- `credentialLine(workflow, credential)` in `scripts/lib/init.mjs` switches the two credential lines of the template. It is applied only to the text `init` writes for a workflow that does not exist (`wanted`).
- The update of an installed workflow goes through `planUpgrades` (`scripts/lib/workflow-upgrade.mjs`). Its `render` builds `theirs` and every published base from the raw template with the runner, the agent block and the restricted paths, and never with the credential. Because of that, with `ours` on `anthropic_api_key` and an answer of `subscription`, the three-way merge sees no change and the plan reports "up to date (with your own changes)". Checked with a throwaway script over the real template: both an unchanged file and a file switched by hand give `current`.
- `doctor` already computes the line in use (`used`, from the text of the workflow without the commented lines) and the mode from the secret names (`credentialMode`), but compares them only when both secrets exist.
- The secret names reach `init` as `facts.secrets`; `init` never reads a value.
- The gate of `relevo-go.yml` (`HAS_CREDENTIAL`) passes with either secret. It sits in the `credential` marker block, which `build-preflight-gates` also touches.

## Goals / Non-Goals

**Goals:**

- A repository whose secret and workflow line disagree is reported before the first build, with the line to change.
- `init` can bring the credential line of an installed workflow to the mode in force, and never reverts a line the person switched on purpose.

**Non-Goals:**

- Changing the `HAS_CREDENTIAL` gate (a follow-up).
- Storing the mode anywhere: it stays deduced, never in `relevo.yml`.
- Workload identity federation, or how the quota of a subscription is shared.

## Decisions

**1. The credential in force has a fixed order: explicit answer, then the only secret that exists, then the active line of an installed workflow, then `api_key`.**
The secret outweighs the installed line because in the reported case the line is what is wrong and the secret is what the person did. The installed line outweighs the default so that a run with both secrets, or none, cannot undo a deliberate switch. Alternative: take the line first. Rejected: it would leave the reported repository as it is and `init` would have nothing to offer.

**2. `planUpgrades` renders the published bases with the credential line the file has today, and the current template with the credential in force.**
If all three sides shared one credential, the merge would read the file's line as the person's own edit and keep it, so nothing would ever switch (found while implementing). With the bases following the file, a difference between the file and the credential in force is a change of the template side, which the merge applies; a line the person switched is the same on the base and the file, so it is kept; and the choice of the base (`chooseBase`) no longer depends on the credential. A text with no credential lines (an older base, another workflow) is left as it is. Alternative: switch the line after the merge on `ours`. Rejected: the merge result then hides the switch from the diff the person confirms, and a new template that moves the credential lines would conflict silently.

**3. `credentialLine` accepts a workflow that already has the other mode active.**
Today it throws when the exact default lines are missing. For a switched file it needs to recognise either state by the active-line pattern that `doctor` already uses, and to throw only when neither line exists. The active-line detection moves to a shared helper so that `doctor` and `init` cannot disagree on what "active" means.

**4. `doctor` compares only when exactly one secret exists.**
With both secrets the existing warning stays (it already names the line in use), and with none the existing warning stays. With no active line (edited by hand) it says nothing, to avoid a false positive. The result has its own id (`execution.credential-line`) so that a test and a person can tell it from the mode report, and it is a warning, not a failure: the cloud falls back for a missing credential, and this case is a build that fails after the claim.

**5. A contradicting explicit answer changes the plan item, not the file.**
`manual.api-key` is `ok` today for any secret. With an explicit answer and a single secret of the other mode it becomes a manual item that names both secrets. `init` still writes what the person answered.

**6. The command text is one constant.**
The literal `pbpaste | tr -d '[:space:]' | gh secret set CLAUDE_CODE_OAUTH_TOKEN` is written once for the plan item and copied to the guide by a test that compares them, so the three places cannot drift.

## Risks / Trade-offs

- [The merge is shared by every update: a base rendered with a different credential could change which base is closest] → the bases follow the file's own line, so the choice does not depend on the credential; the merge test runs over the historical template in `tests/fixtures/workflows/` for both modes.
- [Deducing from a secret name could surprise a person who stores both secrets for a reason] → with both, nothing is deduced and the installed line decides.
- [The warning of `doctor` assumes the workflow text was read] → `gatherFacts` already keeps it; when it could not be read the check says nothing instead of guessing.
- [A person on a self-hosted runner or a fork has secrets that the listing cannot see] → unchanged from today: `doctor` already treats an unlisted secret as unknown.

## Migration Plan

No data to migrate. Existing repositories get the warning on their next `doctor` run, and the switch of the line on their next `init`, shown as a diff that the person confirms before anything is written. Rollback is reverting the plugin version.
