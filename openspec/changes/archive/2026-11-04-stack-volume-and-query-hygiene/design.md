# Design

## Context

See `proposal.md` for the motivation. What exists today and shapes the approach:

- A profile in `stacks/<stack>.md` has a header, a body that `dev` and `qa` receive and an optional section `Questions for the issue writer` that the profile command prints only for the role `issue`. The section is read by `/relevo:issue`, which asks the questions the idea leaves open, once, together with the rest, and turns each answer into a scenario, an edge case or a `Constraints` line.
- A `Constraints` line (`C<n>`) is copied into `design.md` under `From the issue:` and is binding for the developer (`agents/dev.md`) and for QA, which rejects a change that breaks one and cites its id (`agents/qa-spec.md`).
- The `laravel` body already forbids an N+1 query and asks for an index per foreign key; the `supabase` body already asks for an index on every foreign key and every column used in a policy. Neither says anything about the size of what a query returns.
- The `vue` body has a guard: the checklist must grow by less than 2 KB (`tests/stack-profiles-shipped.test.mjs`). The section of questions is not part of the body, so it does not count against it.
- Three tests read the shipped profiles: `stack-profiles-shipped.test.mjs` (the body keeps its three parts, and at least five questions for `vue`, `laravel` and `flutter`), `stack-profile.test.mjs` (the Supabase profile and its questions) and `docs-claims.test.mjs` (the documentation).

## Goals / Non-Goals

**Goals:**

- Make the size of the data a question the writer of an issue is asked, so that "this list can be large" can become a binding constraint.
- Give QA two more things to find by reading a diff, in the two stacks whose backends are written by the agent.
- Reuse what exists: the section of questions, the `Constraints` line and the lens that already enforces it.

**Non-Goals:**

- A new section, key or script. No change to how a profile is resolved or to what `dev` and `qa` receive.
- A check that a limit is met at run time. QA still reads code; a numeric limit such as "under 2 seconds" stays under `Left for on-device review`.
- A general performance checklist in the profiles.

## Decisions

### D1. The question goes into the existing section of each profile, one bullet per stack

Each of the four profiles gets one bullet under `Questions for the issue writer`, worded for its stack and ending with what the answer decides, so that the writer can turn it into a `Constraints` line without help. Proposed wording, to adjust when the text is written:

- `laravel`: how many rows can the collection this endpoint returns hold, and does it grow? If it can grow, say how the caller pages through it.
- `supabase`: how many rows will each new table hold after a year, and does a screen read all of them? A table that can grow gets a limit or a range in every query that reads it.
- `vue` and `flutter`: how many items can this list or grid show, and does it grow? If hundreds or more, say whether the list is paged by the server or shown whole.

*Why here:* it is the only place a stack can ask the writer something, and the answer already lands in a binding `Constraints` line. *Alternatives:* a new `Volume` section in the issue template (rejected: it duplicates `Constraints` and needs changes to the parser, the check and both issue-format pages); a rule in the body that the developer assumes every list is large (rejected: it would make QA reject small, fixed collections, which the third scenario of the spec rules out).

### D2. The rules in the bodies are short and checkable by reading

For `laravel`, one line under `Hygiene for the developer` (paginate a collection a caller can read and that can grow; never return a whole table) and one in the `Queries` item of `What the auditor looks for in the diff` (an endpoint that reads all the rows of a table or relation with no limit or page).

For `supabase`, two lines under `Hygiene for the developer` (read related rows in one query, with an embedded relation, a view or a function, instead of calling the client inside a loop; give a query on a table that can grow a limit or a range) and two items under `What the auditor looks for in the diff` (a client call inside a loop or a `map` over the rows of an earlier call; a read of a table that can grow with no limit and no range).

*Why short:* the profile is read on every build, and each rule has to be something QA can quote with a file and a line. *Why not Vue or Flutter:* the rules for long lists already exist (`flutter.md` builders, `vue.md` virtualization), and a rule about server pagination belongs to the backend profile that writes the endpoint.

### D3. The sources are read when the text is written

The profiles cite the official page behind each rule with the date it was read (for example `Source: ... Read: 2026-11-02`). The new lines cite the Laravel pagination page and the Supabase pages on embedded resources and on limiting rows, and the date is the day they are read when the task is done, not a date copied from this document. A rule whose page does not say it is left out.

### D4. Documentation, tests and changelog move with the profiles

`docs/stacks.md` and `docs/stacks.es.md` describe each profile in a paragraph; the paragraphs for `laravel` and `supabase` mention the new rules, and the paragraph about the section of questions mentions volume. The two pages keep the same structure. The shipped-profile tests gain assertions for the new text, and the `supabase` profile test asserts at least five questions. The entry goes under `[Unreleased]` in `CHANGELOG.md`; the version bump and the release are a separate step of the maintainer, as `CLAUDE.md` says.

## Risks / Trade-offs

- [QA rejects a small, fixed collection for having no pagination] → The rule says "that can grow", the third scenario of the spec says a collection the issue declares small is not reported, and the question exists so that the issue says so. If it still happens, the finding is `spec`-class: it needs a decision the specification does not make.
- [One more question tires the writer] → `/relevo:issue` asks only what the idea leaves open and never twice, so an issue that already says how big the list is is not asked. It is one bullet per stack.
- [A rule is wrong for a stack version] → Each rule cites its page and the date it was read (D3); the maintainers already refresh the others the same way.
- [The Supabase API limits rows by itself] → If the documentation says a read is cut at a maximum number of rows, "no limit" is a silent truncation rather than a slow query; the rule keeps its wording and the source says which. This has to be confirmed in the page when the text is written.

## Migration Plan

None. The profiles are text shipped with the plugin: a repository gets the new questions and rules with the next release, and its own `.relevo/stacks/<stack>.md` is joined after the plugin's as before. Rolling back is reverting the commit.

## Open Questions

- The exact wording of the five bullets and of the four rules. It does not change the specs, the approach or the tasks.
