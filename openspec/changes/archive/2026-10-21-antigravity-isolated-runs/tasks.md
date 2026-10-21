# Tasks: Antigravity Isolated Local Runs

## 1. Antigravity Skill Renderer Adaptation

- [x] 1.1 In `scripts/lib/adapters/antigravity.mjs`, adapt the `go` skill text so that interactive execution invokes a builder subagent with `Workspace: 'share'` instead of running `git switch` directly on the root workspace. Verify with `node --test tests/adapter-antigravity.test.mjs`.
- [x] 1.2 Update `tests/adapter-antigravity.test.mjs` to verify that the rendered Antigravity `go` skill includes the `Workspace: 'share'` invocation for the builder subagent.

## 2. Antigravity Support in Local Runner (`go-local.mjs`)

- [x] 2.1 Update `scripts/lib/go-local.mjs` (`planLocalRun`) to check `config.agent.build`. When `antigravity`, construct the runner command using `agent-guard.mjs` and `agy -p` with turn and token limits.
- [x] 2.2 Add unit tests in `tests/go-local.test.mjs` verifying that `planLocalRun` produces the correct `agy` runner command when `agent.build` is `antigravity`, and preserves `claude` behavior when `claude`.

## 3. Review Base-Branch Restoration

- [x] 3.1 In `skills/review/SKILL.md`, add step to restore the working tree to the base branch (`git switch <base>`) upon successful pull request creation.
- [x] 3.2 Update `tests/skill-review.test.mjs` to verify that `review` leaves the working tree on the base branch after opening the PR.

## 4. Verification and Documentation

- [x] 4.1 Update `docs/execution.md` and `docs/execution.es.md` describing how background `go` builds remain 100% isolated in worktrees while the repository root is reserved for the developer and `review`.
- [x] 4.2 Run the full test suite (`node --test`) and confirm `openspec validate antigravity-isolated-runs` passes.
