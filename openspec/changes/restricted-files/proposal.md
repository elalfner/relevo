# Proposal

## Why

A project that uses Relevo has files that no agent and no Relevo script should read: environment files, private keys, credential stores. Today that is only prose (the review skill and the Laravel stack say "never read `.env`"), and the existing protected paths cover the opposite direction: what a diff may not write. Nothing stops `cat .env` or a `Read` of a key file, and nothing keeps a Relevo script from printing one into an issue comment, a pull request or a capture.

## What Changes

- A list of **restricted files**: files an agent and Relevo's own scripts must not read. A built-in base list (`.env` and `.env.*` except `.env.example`, private keys and certificates, credential files such as `.npmrc` and `.netrc`, mobile service configuration, `secrets/`), and `restricted_paths:` in `relevo.yml` to add the project's own. The key only adds: it cannot remove a base entry, and a stack profile cannot weaken the list.
- The list is projected to each agent as read denials. For Claude that takes two controls together, because each covers what the other does not: `permissions.deny` with `Read(...)` rules (the file tools, with Grep and Glob on a best-effort basis, and the file commands Claude recognizes in a shell such as `cat`; not a script that opens files itself or `grep -r`) and `sandbox.filesystem.denyRead` (every process; it does not stop the `Read` tool). In the cloud workflow that is `--disallowedTools` plus the sandbox settings; for Antigravity, `read_file(...)` deny rules by exact path, which the documentation does not say reach the shell. A `.gitignore` entry or an ignore file such as `.claudeignore` or `.claudecode.json` is not one of these controls and must not be offered as one. In local use, `init` proposes the matching deny rules for the person's own agent settings.
- Three levels of hiding, documented as what they are: the file is **not in the tree** the agent works in (the only one that gives a real "no such file"); the read is **denied** (the agent learns that something is blocked, and `ls` still shows the name); and the shell is **sandboxed**. Relevo guarantees the first where it builds the tree: `go` works in a git worktree, which holds only versioned files, and no script copies or links a restricted file into it. A restricted file that is versioned is a failure, not something to hide.
- **Cloud runs**: a restricted file that appears in a diff, or in text a Relevo script is about to publish, ends the run in `qa-failed` with the reason "restricted file in the diff", and nothing is pushed.
- **Local use**: `/relevo:doctor` checks, by path name only and never by opening a file, that the deny rules exist, and reports a warning when they do not.
- Relevo's scripts refuse to read or publish a restricted file.
- `docs/security.md` and its Spanish page state, per agent, what is enforced (the read tools and Relevo's scripts), what is partial (a shell command that reads without naming the file, such as `grep -r`, or a script such as `node -e`, and for Antigravity the shell as a whole) and what is not covered (content already in transcripts or logs, a restricted file committed by mistake).
- The skills and stacks that say "never read `.env`" point at the list instead of repeating it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security`: a new requirement, separate from "Protected paths" (which is about writing), that restricted files are not read, with the cloud failure path and the honest limits; the requirement of the security page gains the restricted-file rows.
- `configuration`: `restricted_paths` in `relevo.yml`, additive only, and a profile cannot weaken it.
- `init-doctor`: `init` proposes the deny rules for local use; `doctor` checks them by path name.
- `agent-adapters`: the list is rendered as read denials for each supported agent.

## Impact

- Code: `scripts/lib/protected-paths.mjs` (or a sibling module for the list), `scripts/lib/agent-guard.mjs` (`DENIED` and the settings it renders), `scripts/scan-diff.mjs` and `scripts/commit-change.mjs`, `scripts/validate-config.mjs`, `scripts/init.mjs`, `scripts/doctor.mjs`, and any script that captures or publishes file content.
- Templates: `templates/workflows/relevo-go.yml` and the Antigravity step.
- Skills and stacks: `skills/review/SKILL.md`, `stacks/laravel.md` and any other stack that repeats the rule.
- Documentation: `docs/security.md`, `docs/security.es.md`, the `relevo.yml` reference.
- Still to confirm by a run, listed in the design: whether `claude-code-action` forwards its `settings` input as `--settings`, whether `**/.env` matches at any depth in `sandbox.filesystem.denyRead`, and, for Antigravity, whether a `read_file` deny stops the agent's own file tool and reaches the shell.
- No new dependency. The limit that a prefix-based shell allow list is not an operating-system boundary stays, and the documentation says so.
