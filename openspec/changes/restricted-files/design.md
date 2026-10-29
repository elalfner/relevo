# Design

## Context

See proposal.md for the motivation. What exists today:

- `scripts/lib/protected-paths.mjs` holds the **write** rules (`HARD_PATTERNS`, `SOFT_FILES`, `checkProtected`) and `matchesGlob`. `commit-change.mjs` calls it, then the diff scanner, and refuses to commit.
- The cloud build of Claude is closed in `templates/workflows/relevo-go.yml` (`--allowedTools`, `--disallowedTools "WebFetch,WebSearch,Bash(curl:*),Bash(wget:*)"`). Antigravity gets its denials from `agySettings` in `scripts/lib/agent-guard.mjs` (`DENIED`), written to a user-level file outside the repository.
- `go` in local use builds in a git worktree (`scripts/lib/go-worktree.mjs`), which holds only versioned files.
- The rule "never read `.env`" exists only as prose in `skills/review/SKILL.md` and `stacks/laravel.md`.

Facts taken from the official documentation (Claude Code: permissions, sandboxing and settings reference; Antigravity: its permissions page), and what is still not confirmed:

**Claude Code**
- `permissions.deny` with `Read(...)` rules blocks the `Read` tool, Grep and Glob (best-effort, in the documentation's words) and the file commands Claude Code recognizes in Bash (`cat`, `head`, `tail`, `sed`, `tee` and redirections). It does **not** cover a command that reads files without naming them (`grep -r pattern .`) or a script that opens files itself (Python, Node). A `Read` deny also blocks Edit and Write on the path.
- `sandbox.filesystem.denyRead` is OS-level and covers every process, but does not stop the `Read` tool. The two are merged into one sandbox configuration, so both are rendered.
- `denyRead` paths resolve by prefix: `//path` or `/path` absolute, `~/` the home folder, `./` or none the project root for project settings. The documented glob form is `~/**/.env`. Whether `**/.env` matches at any depth in `denyRead` is not documented (it is, in the permissions grammar, where `Read(.env)` and `Read(**/.env)` are equivalent), so the renderer writes the documented form and a test checks it.
- `claude-code-action` has a `settings` input ("Claude Code settings as JSON string or path to settings JSON file") and `claude_args`; it has no input for allowed or disallowed tools. Read in its source at `v1` (`base-action/src/setup-claude-code-settings.ts`, commit `ea2298e`): the input is **not** forwarded as `--settings`. It is parsed (JSON, else a file path) and merged into the user-level `~/.claude/settings.json` on the runner with a shallow spread, so a top-level key it names (`permissions`, `sandbox`) replaces the existing one, and the file is outside the repository, so a pull request cannot loosen it. The workflow must therefore give the whole `permissions` and `sandbox` objects it wants.
- On Linux the sandbox needs `bubblewrap` and `socat`; `sandbox.failIfUnavailable` makes a missing dependency stop the run instead of running unsandboxed. In a container `bwrap` fails to start, which is documented. Headless `claude -p` is not covered by the pages read.
- `Read(./.env)` is in the permission grammar that `--disallowedTools` takes; an explicit `--disallowedTools` example was not found.
- `.claudeignore` "has no effect" according to the permissions page; `.claudecode.json` is not documented.

**Antigravity**
- `permissions.deny` in `~/.gemini/antigravity-cli/settings.json` accepts `read_file(/path)`, `read_file(dir)` and `read_file(*)`, with Deny over Ask over Allow. A directory covers what is under it; no globs are documented. A `read_file` deny also blocks `write_file` on the path.
- The documentation does not say whether `read_file` rules reach shell commands; `cat` goes through `command`, whose prefix rules are easy to bypass. The sandbox (`--sandbox`) allows the workspace by default and has no documented way to carve a file out of it.
- No ignore file was found. Project-level rules are reported (by a third party) as not versionable in the repository.
- Not confirmed: that a `read_file` deny stops the agent's own file tool on a workspace file; filename-only matching; behavior under `--dangerously-skip-permissions`. A local test with `agy` and a throwaway file settles them.

## Goals / Non-Goals

**Goals:**
- One list, one module, used by every consumer: the renderers of the workflows, `init`, `doctor`, the commit guard and the scripts that publish text.
- Say exactly what each agent enforces.

**Non-Goals:**
- Hiding a file from a person, from CI or from the platform.
- Removing a secret that is already in the history, or in a transcript.
- Making a shell allow list an operating-system boundary.

## Decisions

**1. A new module, `scripts/lib/restricted-paths.mjs`, separate from `protected-paths.mjs`.** Protected paths answer "may this diff change it?"; restricted paths answer "may anything read it?". They differ in direction, in tiers (restricted has no soft tier and no `Allow-paths:` escape) and in consumers. Merging them would make `Allow-paths:` look like it could lift a read ban. It reuses `matchesGlob` by importing it.

**2. The list is data, with the base as a constant and `restricted_paths` only added.** `restrictedList(config)` returns `[...BASE, ...config.restricted_paths]` and nothing else can subtract. A profile of the repository cannot reach it, which follows the existing rule that a profile only adds. `.env.example` is exempt by an explicit exception in the matcher (so `.env.*` does not swallow it), and the exception is tested.

**3. The match is by path name, at any depth for file patterns and anchored for folders.** `.env`, `.env.*`, `*.pem`, `*.key` and similar match at any depth, like `.gitignore`; `secrets/` is anchored at the root and at each platform folder. This is the behavior `matchesGlob` already has, so no new glob engine.

**4. Four levels, each with its own consumer.**

```
   level 1  not in the tree      go-worktree + commit-change: refuse a versioned restricted file
   level 2  read denied          Claude: Read(...) in --disallowedTools / settings
                                 Antigravity: deny rules in agySettings, if the tool has them
   level 3  shell sandboxed      Claude: sandbox.filesystem.denyRead
   level 4  scripts of Relevo    restricted-paths.mjs checked before a script opens or publishes a file
```

Level 1 needs no setting: it is a property of the worktree plus a check that fails when a restricted file is versioned. It is the only level that answers "no such file".

**5. In the cloud the failure is hard, and the check runs in `commit-change`.** The existing guard already stages paths, refuses and names file and line. A restricted path in the staged set adds the reason "restricted file in the diff" next to "protected path in the diff". A versioned restricted file is found by listing `git ls-files` against the list before the run builds, and ends in `qa-failed` with the same reason.

**6. In local use Relevo proposes and checks, never enforces.** `init` shows the deny entries and writes them only after a yes, merging into the existing settings without touching other entries. `doctor` warns when a denial is missing and fails only for a versioned restricted file. This keeps `doctor` read-only and the person's settings theirs.

**7. Scripts that gather or publish content call one function, `assertNotRestricted(path)`.** A script that lists files to attach (captures, digests, evidence) filters through it and reports what it left out. Review each script that reads a path it was not given by name; the ones that only take a path the person names are checked too, because a person can name `.env` by mistake.

**8. No ignore file is ever written.** Decision recorded because it came up: `.claudeignore` has no effect according to the documentation, and `.claudecode.json` is not documented at all. Renderers write only settings that the tool's documentation lists as denying a read.

**Alternatives considered:**
- *Extend `protected-paths.mjs`.* Rejected, see decision 1.
- *Only `Read` denials.* Rejected: `cat .env` works. This is the main limit and it is why level 3 exists.
- *A fake "not found" answer.* Rejected: it cannot be done without lying to the tool, and no control of Relevo should depend on it.
- *Block the run on any restricted file on disk.* Rejected: in local use the real `.env` is expected to exist; the check is about versioned files and about reads.

## Risks / Trade-offs

- [A shell command that reads a restricted file where the sandbox is not available] → documented as partial; level 1 removes the file from the tree where Relevo builds it, and the security page says so.
- [The `settings` input replaces whole top-level keys] → the workflow renders the complete `permissions` and `sandbox` objects, and a test checks that no other entry the workflow relied on is lost; a run in the sandbox repository confirms that the sandbox denials take effect, and if they do not, the cloud relies on level 1 (the file is not in the checkout) plus `Read` denials, which already cover the file tools and `cat`, and the page lists arbitrary processes as not covered.
- [The sandbox may not start on the runner (a container, or a restricted user namespace)] → set `sandbox.failIfUnavailable` so a run stops instead of running unsandboxed, and say so in `doctor` for a self-hosted runner.
- [Antigravity denies by exact path only, with no documented globs and no stated reach into the shell] → the renderer writes one `read_file(...)` entry for each restricted path that exists in the tree, and the page lists the control as partial; level 1 does the real work there.
- [A false positive on a name such as `key.json` that is not a secret] → the extension in `relevo.yml` only adds, so a project that finds the base too wide reports it; the base list stays conservative and the exception is by explicit name (`.env.example`), not by pattern.
- [Content already in a transcript or a log] → out of scope; the page lists it as not covered.

## Migration Plan

Nothing to migrate for a repository that does not use the new key. A repository whose base branch has a versioned restricted file starts to fail its runs with a clear reason; the message names the path and says to remove it and rotate the secret. `doctor` reports it first, so the person sees it before a run. Rollback is a revert of the change: no data format changes.
