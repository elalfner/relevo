# Tasks

## 1. Laravel profile

- [x] 1.1 `stacks/laravel.md`: add the question about volume and growth under `Questions for the issue writer` (D1), after the question about the database. Verify with `node --test tests/stack-profiles-shipped.test.mjs`, extended to assert that the questions of `laravel` mention how many rows a collection can hold and that its body does not contain the question.
- [x] 1.2 `stacks/laravel.md`: add the pagination rule under `Hygiene for the developer` and extend the `Queries` item of `What the auditor looks for in the diff` with an endpoint that reads all the rows of a table or relation with no limit or page (D2). Read the Laravel pagination page first and cite it with the date it was read, as the other rules do (D3). Verify with a test in `tests/stack-profiles-shipped.test.mjs` that the body names pagination and the unbounded read, and that it still keeps its three parts (`Verification`, `Hygiene for the developer`, `What the auditor looks for in the diff`).
- [x] 1.3 `docs/stacks.md` and `docs/stacks.es.md`: mention the new question and rule in the description of the `laravel` profile, with the same structure in both languages. Verify with `node --test tests/docs-claims.test.mjs`.

## 2. Supabase profile

- [x] 2.1 `stacks/supabase.md`: add the question about volume and growth under `Questions for the issue writer`, which brings the section to five items (D1). Verify with `node --test tests/stack-profile.test.mjs`, extended to assert the new question, the old ones (`Authorization & RLS` among them) and at least five items, and that the body does not contain the question.
- [x] 2.2 `stacks/supabase.md`: add the two rules under `Hygiene for the developer` and the two items under `What the auditor looks for in the diff` (D2): a client call inside a loop or a `map`, and a read of a growing table with no limit and no range. Read the Supabase pages on embedded resources and on limiting rows first, cite them with the date read (D3), and write down in the commit message whether the page says a read is cut at a maximum number of rows (risk in the design). Verify with a test that reads the body for the four lines and that the section `Review` is untouched.
- [x] 2.3 `docs/stacks.md` and `docs/stacks.es.md`: mention the new question and rules in the description of the `supabase` profile, in both languages. Verify with `node --test tests/docs-claims.test.mjs`.

## 3. Vue and Flutter profiles

- [x] 3.1 `stacks/vue.md` and `stacks/flutter.md`: add the question about how many items a list or grid can show, and whether that grows, under `Questions for the issue writer`; leave both bodies as they are (D1, D2). Verify with `node --test tests/stack-profiles-shipped.test.mjs`: the question is in each `questions` and not in each body, and the existing guard that the Vue checklist grew by less than 2 KB still passes unchanged.
- [x] 3.2 `docs/stacks.md` and `docs/stacks.es.md`: extend the sentence about the section `Questions for the issue writer` so that it names volume as one of the things asked, in both languages. Verify with `node --test tests/docs-claims.test.mjs`.

## 4. Record and close

- [x] 4.1 `CHANGELOG.md`: an entry under `[Unreleased]` that says that the profiles ask about volume and growth, and that `laravel` and `supabase` look for unbounded collections and, in Supabase, a client call in a loop. Do not change the version in `.claude-plugin/plugin.json` or `package.json`: the release is a separate step. Verify with `node --test tests/changelog.test.mjs`.
- [x] 4.2 Run the whole suite and the OpenSpec validation, which are what the CI runs: `npm test` and `openspec validate --all`. Check `git branch --show-current` before the commit (the work goes on `dev` or on a branch made from it) and that the commit has no attribution trailer, as `CLAUDE.md` says. Verify that both commands exit 0 and that `git status` shows only the files named in these tasks.
