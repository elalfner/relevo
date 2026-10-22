# Design: Antigravity Isolated Local Runs

## Context

See `proposal.md` for motivation. In Antigravity IDE, developers frequently open multiple concurrent chat conversations within the same workspace window. Because all chat tabs execute commands in the shared root workspace, concurrent branch switching (`git switch -c feature/...`) and OpenSpec file creation (`openspec/changes/...`) cause race conditions and commit cross-contamination.

Meanwhile, interactive reviews (`/relevo:review`) involve human interaction with connected mobile devices (`adb`), simulators, and IDE tooling (Flutter Hot Reload). Reviewing inside temporary folders creates heavy friction because developers would have to open secondary windows or `cd` into background worktrees to launch `flutter run`.

Relevo resolves this with a clear separation of domains:
1. **Automated agents (`go`)** never touch the repository root; they always operate in isolated worktrees.
2. **The repository root is reserved for the human developer and `review`**, allowing native device testing in the primary IDE window without conflicting with background agents.

## Goals / Non-Goals

**Goals:**
- Provide zero-friction, collision-free execution when running multiple issues concurrently across different chat tabs in the same Antigravity window.
- Ensure the main repository root stays on its base branch (`dev`) and is never hijacked by an automated `go` build.
- Enable `go-local.mjs` to work with `agent.build: antigravity` via `agent-guard.mjs` and `agy -p`.
- Keep the human review workflow directly in the primary workspace where connected devices, hot reload, and editor extensions are configured.

**Non-Goals:**
- Running multiple concurrent reviews at the exact same second (a human only tests one app on one physical phone at a time).
- Modifying Claude Code workflows or CLI behavior.

## Decisions

### Decision 1: Pure subagent isolation with `Workspace: 'share'` in Antigravity

- **Decision**: In `scripts/lib/adapters/antigravity.mjs`, render the Antigravity `go` skill so that when invoked interactively in chat, it delegates the build execution to a builder subagent with `Workspace: 'share'`.
- **Rationale**: Antigravity natively creates an ephemeral git worktree when `invoke_subagent` is called with `Workspace: 'share'`. The subagent operates within that isolated directory, meaning all branch switches, OpenSpec files, and commits are sandboxed. The parent chat simply receives progress updates and the final completion report. The root repository is never switched.

### Decision 2: Unified `go-local.mjs` runner with `agent.build` switching

- **Decision**: Update `scripts/lib/go-local.mjs` (`planLocalRun`) to inspect `config.agent.build`.
  - When `claude` (default): Spawns `claude -p "/relevo:go <issue>"`.
  - When `antigravity`: Spawns `node <pluginRoot>/scripts/agent-guard.mjs run -- agy -p "/relevo:go <issue>"`.
- **Rationale**: Keeps a single, canonical local entrypoint (`node scripts/go-local.mjs <issue>`) for both Claude and Antigravity environments.

### Decision 3: Repository Root Reserved for Human and Review

- **Decision**: Since automated `go` builds run 100% in background worktrees, the repository root remains clean on `base` (`dev`). When the developer triggers `/relevo:review <issue>`, it operates directly in the primary workspace root, checking out the feature branch so the developer can run `flutter run` with hot reload directly on their connected phone.
- **Decision**: When the review completes and opens the pull request, `review` switches the repository root back to `base` (`git switch <base>`).

## Risks / Trade-offs

- **[Risk: Subagent token and turn limits in Antigravity]** → Mitigation: Use Antigravity subagent parameters and/or `agent-guard.mjs` token guards to enforce ceiling limits and prevent runaway loops.
- **[Risk: Shared dependency caches (e.g. `~/.pub-cache` in Flutter)]** → Mitigation: Git worktrees decouple the project code while safely sharing toolchain read caches.
- **[Risk: Review device contention]** → Mitigation: Flutter testing in `go` only runs `flutter test` (headless CPU), so the physical mobile device/simulator remains 100% available for the human review session in the root workspace.
