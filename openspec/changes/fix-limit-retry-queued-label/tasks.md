# Tasks

## 1. Tests that fail first

- [ ] 1.1 In `tests/workflow-limit-retry.test.mjs`, make the fake `gh` keep a label set and apply `issue edit` the way GitHub does (additions, then removals), with the labels of the scenario as the start
- [ ] 1.2 Add the scenarios "The issue was building" and "The labels were renamed" (a `relevo.yml` with renamed labels) asserting the final label set; run them on the current template and see them fail
- [ ] 1.3 Add a test over `templates/workflows/*.yml` that no `gh issue edit` adds and removes the same label; see it fail on line 679 of `relevo-go.yml`

## 2. The fix

- [ ] 2.1 In the retry path of `no_outcome` in `templates/workflows/relevo-go.yml`, stop removing `queued` in the command that adds it
- [ ] 2.2 Run the three new tests and the whole suite (`node --test`), and `openspec validate --all`

## 3. Documentation

- [ ] 3.1 Add the entry to `CHANGELOG.md` under Unreleased, in English and where the project keeps the Spanish text, saying that installed `go` workflows need the updated template
