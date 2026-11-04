# Proposal

## Why

The stack profiles already tell the developer to avoid, and QA to look for in the diff, the performance mistakes that can be read in code: an N+1 query and a missing index in Laravel, a missing index in Supabase, an expensive `build()` in Flutter, a list that is not virtualized in Vue. Two things are still missing.

- **Nobody asks how big the data will be.** A declared limit becomes a binding `Constraints` line for the developer and for QA (`C<n>`), but the questions that `/relevo:issue` asks the writer never ask how many rows or items a list will hold or whether it grows. Only the Supabase profile asks anything near it (which columns are filtered). Without that answer no issue says "this list can have tens of thousands of rows", so nothing makes pagination binding.
- **Two common mistakes are not in the auditor's list.** A collection endpoint that returns a whole table with no limit, and a loop that calls the Supabase client once per row (the N+1 of a client, which the Laravel profile covers for Eloquent but the Supabase profile does not mention).

Both are checkable by reading a diff, which is what QA does. The rest of the usual web-performance checklist (caches, CDN, load balancer, connection pooling, minifying, bundle splitting, an audit with Lighthouse) is infrastructure or is done by the tools of each stack, and QA cannot confirm it with evidence, so it stays out.

## What Changes

- **A question about volume and growth in the questions for the issue writer** of the four plugin profiles (`flutter`, `vue`, `laravel`, `supabase`): how many items or rows the list, table or collection will hold and whether the number grows. The answer already has a place to land: `/relevo:issue` turns it into a scenario, an edge case or a `Constraints` line, and from then on it binds the developer and QA.
- **Two rules in the body of the `laravel` profile**: a collection that can grow is paginated, and QA looks in the diff for an endpoint that returns a whole table with no limit.
- **Two rules in the body of the `supabase` profile**: related rows are read in one query and not by calling the client inside a loop, and a query on a table that can grow has a limit or a range. QA looks for both in the diff.
- **The documentation of the profiles** (`docs/stacks.md` and `docs/stacks.es.md`) says so, and the tests that guard the profiles check the new text.
- The body of the `vue` and `flutter` profiles does not change: they only get the question, because their existing rules already cover long lists and the `vue` body has a size limit.

Out of scope: caching, a CDN, a load balancer, connection pooling, minifying and splitting the bundle, finding unused dependencies, and any measurement of performance (an audit, a profiler or a limit that a script verifies). If a project needs one of those, it declares it as a `Constraints` line in its issue. Whether Relevo should ever measure performance is a separate question and is not decided here.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platforms`: the plugin's four profiles ask the issue writer about volume and growth; the `laravel` and `supabase` profiles carry a rule about unbounded collections, and the `supabase` profile carries a rule about calling the client inside a loop.

## Impact

- `stacks/flutter.md`, `stacks/vue.md`, `stacks/laravel.md` and `stacks/supabase.md`: one bullet each under `Questions for the issue writer`, and the new rules in the `laravel` and `supabase` bodies.
- `docs/stacks.md` and `docs/stacks.es.md`: the paragraphs that describe the profiles.
- Tests: `tests/stack-profiles-shipped.test.mjs` and `tests/stack-profile.test.mjs`, which read the shipped profiles; `tests/docs-claims.test.mjs` for the documentation.
- `CHANGELOG.md`, under `[Unreleased]`.
- No script, no `relevo.yml` key, no label and no change to how a profile is resolved. The questions stay out of the body that `dev` and `qa` receive, as the spec of `platforms` already requires.
