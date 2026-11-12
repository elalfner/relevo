# Tasks

## 1. The resumed build finds its template

- [ ] 1.1 Write a test that fails on the current code: the checkpoints of a first run (`1/4`, `2/4`) and a resumed `tasks.md` with two groups; `replica-plan.mjs template --section 1` must print the files of the first checkpoint. Show it failing.
- [ ] 1.2 `checkpoint.mjs --tasks`: validate the ids and write the `Relevo-Tasks:` trailer through `rescueWork` and `wip-commit.mjs` (a helper to write and read it); tests that the trailer is there, that bad ids are dropped, that the hash trailer is still read, and that the resume check and the scans are unchanged.
- [ ] 1.3 `replica-plan.mjs template --section K`: find the checkpoints by the marker; exit 1 with a detail when none names the section. Keep `--k/--of`. Show the test of 1.1 passing, and a case where the numbers repeat.
- [ ] 1.4 `skills/go/SKILL.md`: pass `--tasks` to the checkpoint and ask for the template by `--section`; docs and the Spanish docs that name the lookup.

## 2. The usage comment shows the replicas apart

- [ ] 2.1 Write a test that fails on the current code: a log with a normal developer and two replica launches (one twice); `readUsage` must give `replicas` and keep them out of `agents`; the line and the marker show them. Show it failing. Add the case with no replica (unchanged output).
- [ ] 2.2 `lib/run-usage.mjs`: recognise `replica <id>`, build `usage.replicas`, write the phrase and the `replicas` marker key, and read it back in `parseUsageMarker`; a cost left out when any launch has none.
- [ ] 2.3 Catalog phrases in English and Spanish; the language test passes.
- [ ] 2.4 `skills/go/SKILL.md`: the launch `description` of a replica and of its fix launch.

## 3. Close

- [ ] 3.1 `CHANGELOG.md`: one entry under Unreleased. No version bump.
- [ ] 3.2 Run `npm test` and `openspec validate replica-usage-and-resume-167 --strict`; list what is not verified in the PR. Do not archive.
