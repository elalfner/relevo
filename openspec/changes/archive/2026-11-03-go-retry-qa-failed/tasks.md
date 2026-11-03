## 1. Planner

- [x] 1.1 `scripts/lib/plan.mjs`: accept `retry: { issue, by }`; a `qa-failed` retried issue is a candidate and takes the `ready` gates with `by` as the person; a retried issue that is not `qa-failed` gets a `skip` decision
- [x] 1.2 `scripts/lib/github.mjs`: with a retry, read the retried issue even when it is `qa-failed` and read the permission of `by`
- [x] 1.3 `scripts/go-plan.mjs`: `--retry` (needs `--only`), login from `gh api user`, refuse with a message when `feature/<n>-*` exists on the remote
- [x] 1.4 Tests of the planner: start without `ready`, denied for read access and for a non-maintainer in a public repository, gates still apply, ignored without the flag

## 2. Local run and skill

- [x] 2.1 `scripts/go-local.mjs` and `scripts/lib/go-local.mjs`: `--retry` goes into `/relevo:go <n> --retry` for both runners and the cloud warning is skipped
- [x] 2.2 `skills/go/SKILL.md`: argument hint, `--local --retry`, and `--retry` in the `go-plan.mjs` call of step 1
- [x] 2.3 Tests of the local run (`--dry-run` shows the flag) and of the skill text

## 3. Message and docs

- [x] 3.1 `scripts/lib/next-step.mjs`: the `rebuild` hint mentions `/relevo:go <n> --local --retry` (which runs `go-local.mjs <n> --retry`) as the way that does not start the cloud; update its tests
- [x] 3.2 `docs/execution.md` and the guides: the retry command and its preconditions
- [x] 3.3 Run the full test suite and `openspec validate go-retry-qa-failed`
