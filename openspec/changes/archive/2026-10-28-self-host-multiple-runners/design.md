# Design

## Context

See proposal.md - Why. What the text may claim is limited to what the repository shows or what a third-party tool documents:

- `docs/execution.md` has a "Self-hosted runners" section; its last paragraphs say to add runners with the same labels and that the agent has the permissions of the runner's user. `docs/security.md` says a self-hosted runner is not a sandbox. Both exist in Spanish with the same sections.
- Every Relevo workflow takes its `runs-on` from `runner.labels` (`docs/configuration.md`), so they all compete for the same runners.
- `limits.concurrent_agents` is enforced in `planGo` (`scripts/lib/plan.mjs`): the free slots are the limit minus the issues labelled `building` (plus the ones the caller lists as running). The `decide` job of `relevo-go.yml` has `concurrency: relevo-go-<issue>`, so only gates of the same issue wait for each other; the queue workflow has its own group, `relevo-queue`.
- A runner process runs one job at a time and has its own `_work` folder, with its own `_temp` and `_tool`. Those are properties of the runner, not of Relevo.
- The go skill in the cloud builds in the checkout of the job on a branch of the issue, so two builds never share a branch.
- Parity and claims tests (`tests/docs-claims.test.mjs`) require the same sections in both languages and that every command, label, setting, script and file a page names exists.

## Goals / Non-Goals

**Goals:**
- A person who adds runners to one machine knows beforehand what can collide and how many runners to register.
- The limit on concurrent agents is described as it behaves, not as it is meant to.

**Non-Goals:**
- Fixing the overlap of gates (a concurrency group for `decide`): it changes a template and its version, and the cost of the overlap is at most one build over the limit.
- Describing the runner software in general; only what Relevo's workflows meet.

## Decisions

### D1. One subsection, "Several runners on one machine", inside "Self-hosted runners"

It follows the paragraph that says to add runners, because that sentence is what leads a person there. A table of two columns (kept apart / shared) answers the question at a glance; the rest is three short paragraphs: the number of runners, the limit, and the stacks that do not parallelise. The same heading and order in Spanish, so the parity test holds.

*Alternative: a new page.* Rejected: the pages list is closed by the parity test and the content is a few paragraphs.

### D2. Claim only what can be checked, and say where it comes from

- Kept apart: `_work`, `$RUNNER_TEMP`, the tool cache and the branch of the issue. Stated as properties of the GitHub runner.
- Shared: the home of the runner's user (`~/.claude`, which the page already mentions, and the package caches), the Docker daemon and the ports. Whether two runs writing the same cache or settings file can corrupt it is not verified, so the text says "can" and tells the person to give each runner its own user to avoid the question.
- Supabase: the Supabase CLI starts local containers on the ports of the project's configuration. The text says builds of that stack should not run together on one machine, and cites the stack page, which says the checks run against local Docker containers. This is the one statement that comes from the CLI's behaviour and not from the repository; it is written as a recommendation, not as a proven failure.

### D3. The limit is described with its cause

One paragraph: the gate counts `building` labels, a gate of one issue does not wait for another's, so overlapping gates can exceed `limits.concurrent_agents` by the number of overlaps. With a single runner the gates queue behind the running job, so the limit holds. A later evaluation of the queue sees the true count and starts nothing more until a slot frees. The paragraph does not promise a fix.

### D4. How many runners

The rule given is "more runners than `limits.concurrent_agents`", with the reason (the other workflows and the checks of the pull requests use them), not a fixed number, because the checks of each project differ.

### D5. Security sentence

One sentence in `docs/security.md`, next to the existing self-hosted paragraph, in both languages; it adds the reach across runners of one user and the remedy (a user or a container per runner), and links the new subsection.

## Risks / Trade-offs

- [The shared-state claims are not tested on a machine with several runners] → worded as possibilities, with the remedy that avoids them; revisit if someone reports otherwise.
- [A reader may take the overlap of gates as a bug that will be fixed] → the text says it is a known limit and names the setting that bounds it; the fix stays a separate change.
- [Two languages drift] → the parity test covers headings, links and commands; the table and paragraphs are written together.

## Migration Plan

Documentation only; ships in the next release with the changelog entry. Nothing to roll back.
