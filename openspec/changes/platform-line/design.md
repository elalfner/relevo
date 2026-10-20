## Context

See `proposal.md`. The registry, the profiles and the role skills exist (`platform-registry`). The planner (`scripts/lib/plan.mjs`) already parses an issue body with `parseIssueBody` and builds the `start` decision that travels, encoded, to the build job; `go-plan.mjs` writes `action` and `decision_b64` to the workflow output; `commit-change.mjs` is the one place a diff is committed and already checks protected paths.

## Goals / Non-Goals

**Goals:** an issue names one platform; every step that needs the stack gets it from the issue the same way; a front issue cannot silently change the back; a build installs only its stack's toolchain.

**Non-Goals:** links between repositories, execution modes, `review` adapters per target, `status` grouped by platform, writing the Laravel and Vue profiles.

## Decisions

**D1. One pure function resolves the platform.** `scripts/lib/platform-of.mjs` exports `resolvePlatform({ platforms, body })` returning `{ ok: true, name, entry }` or `{ ok: false, reason, message }` with `reason` one of `missing`, `unknown`, `conflict`. The planner, `check-issue.mjs`, `platform-of.mjs` (the command) and the tests use it, so the three commands cannot disagree. The line is parsed by `parseIssueBody` (`platform: string[]`, every name found, in order) so that fenced code in an issue never counts, like `Depends-on:`.

**D2. An unresolved platform is a missing part of the specification.** The planner adds it to `parsed.missing` handling: the same `needs-spec` decision, the same spec writer, the same comment, with the message of D1 in the list. No new decision and no new message kind; the `platform` decision and message of the previous change are removed. Alternative: a dedicated decision: one more state for the person to learn, with the same fix (edit the issue).

**D3. The command that reads the platform again.** `scripts/platform-of.mjs --issue <n> [--repo owner/name] [--config relevo.yml]` reads title and body with `gh issue view --json body` (or `--input file` for tests) and prints `{ platform, stack, path, targets }`; exit 1 when it cannot be resolved (message on stderr), 2 on bad usage. `fix` and `review` run it instead of parsing text themselves.

**D4. Scope is a property of the commit, not of the agent.** `commit-change.mjs` gains `--within <path>`. `scripts/lib/platform-scope.mjs` exports `checkScope(paths, { within, change, allow })` returning the paths outside the folder, ignoring `openspec/changes/<change>/`, `GLOSSARY.md`, `docs/adr/` and any path matching `allow` (the same `Allow-paths:` list that unlocks dependency files). `within` of `.` or empty disables it. A violation has the tier `scope` and the text "outside the platform". The agents are also told the folder, but the guard is what is enforced. Alternative: only tell the agents: not deterministic.

**D5. `go` passes `--platform <name>` to the existing scripts.** `stack-profile.mjs` and `role-skills.mjs` already accept it; the skill takes the name from the decision. Running from the folder is an instruction to the agents (the commands of the profile are relative to it), not a change of the skill's own working directory, because `go` itself needs the repository root for `openspec` and `git`.

**D6. The workflow output.** `go-plan.mjs --github-output` writes `platform`, `stack` and `path` when the decision is `start` (empty otherwise), and the template's `decide` job exposes them. The `build` job guards each stack's setup with `if: needs.decide.outputs.stack == '<stack>'`. The template ships the Flutter step as a commented example, as today, with its guard; Vue and Laravel examples are commented too. Reason: the toolchains are the repository's choice (versions, caching), not Relevo's.

**D7. `issue` deduces, then asks.** The skill compares the paths in the idea with the `path` of each platform (longest prefix wins). The check script gets `--platforms` (JSON of the registry or the names) so a draft is judged the same way the planner would judge it.

## Risks / Trade-offs

- [A repository with several platforms and old issues without the line] → they go to `needs-spec` with a clear message the first time they are labelled `ready`; nothing is built wrongly.
- [`--within` blocks a legitimate change to a shared folder] → `Allow-paths:` authorizes it per issue, in the text a person approved (the hash check protects it).
- [The platform line is edited after the build] → `fix` and `review` resolve again and stop with a message if it no longer resolves; the hash in the hand-off message already tells the reviewer the text changed.
- [Two platforms in one folder (`path: .` twice)] → allowed: the scope guard is off for them, and the profile is chosen by name.

## Migration Plan

Single-platform repositories need nothing. A repository with several platforms adds `Platform:` to its issues; `/relevo:issue` writes it from now on. The workflow template changes: copy `relevo-go.yml` again to get the stack guards.

## Open Questions

- Whether `status` should group by platform (listed as a later change; no spec here).
