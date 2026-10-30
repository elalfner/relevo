# Design

## Context

`requiredChecks(gh, repo, branch)` in `scripts/lib/ship-github.mjs` reads `rules/branches/<b>` and then `branches/<b>/protection`. It accepts the plan refusal from both, and also a 404 from the second. In the ship workflow `gh` runs with `GH_TOKEN: github.token`, and the App token reaches only `GH_PUSH_TOKEN`. `branches/<b>/protection` needs `administration: read`, which the `permissions:` block of a workflow cannot grant, so the workflow token gets `Resource not accessible by integration (HTTP 403)`. That is neither a 404 nor the plan refusal, so the error reaches `runUnattendedShip` and becomes `ship_stopped`.

The design of `ship-free-private-repos` rejected skipping the classic call after a plan refusal, on the grounds that "both endpoints answer the same refusal". That holds for a personal token and not for the workflow token.

## Goals / Non-Goals

**Goals:**
- `requiredChecks` works with the workflow token on every plan.
- Keep the rule that a failure to read the rules stops the run and never counts as "no checks".

**Non-Goals:**
- Changing which token `gh` uses in the workflow, or the App's permissions.
- Changing `doctor`, which reads the protection with the person's own token.

## Decisions

**Read the classic protection from `branches/<b>`.** GET `repos/<r>/branches/<b>` returns `protected` and `protection.required_status_checks` (`enforcement_level`, `contexts`, `checks`) to anyone who can read the branch. It answers without a token on public repositories, for example `enforcement_level: "everyone"` with five contexts on a large public repository. Checks are required when `enforcement_level` is present and is not `"off"`; `non_admins` counts too, because the ship never acts as an administrator. The contexts are `contexts` plus `checks[].context`, the same union as today. A missing `protection` or `required_status_checks` means no checks.

Alternatives:
- Give the App `administration: read` and read with the App token. Rejected: it makes every repository with classic protection set up an App just to read, and a repository without the App still fails.
- Treat the permissions 403 as "no checks". Rejected: checks that exist would be skipped.
- A new stop kind telling the person to configure the App. Rejected: it gives a clear message for a failure that this decision removes.

**Skip the classic read after a plan refusal of the rules.** This reverses the earlier decision. On the free plan a private repository has neither rulesets nor classic protection, so the second call adds nothing. The call to `branches/<b>` would answer 200 with `enforcement_level: "off"` anyway, so this is defense in depth rather than the fix itself.

**Every error from `branches/<b>` is thrown.** It no longer accepts a 404 or the plan refusal. A 404 now means that the base branch does not exist, which is a real fault, and the endpoint is not one that the plan restricts. The error reaches the existing `ship_stopped` path with GitHub's message.

## Risks / Trade-offs

- [The summary may drift from the admin endpoint (GitHub could stop filling it in for some tokens)] → the run would see no classic checks; when they exist, GitHub still refuses the merge of the archive commit and the ship reports that refusal (requirement "No bypass of protections"). Nothing is merged around a protection.
- [Not yet checked with a real workflow token on a branch with classic protection] → the sandbox run listed in the tasks covers it before the release.

## Migration Plan

Release 0.11.1 on `dev`, promote to `main`, tag. A consumer sets `RELEVO_VERSION` to `0.11.1` in `.github/workflows/relevo-ship.yml`; the permissions are unchanged. Rollback: set `RELEVO_VERSION` back.
