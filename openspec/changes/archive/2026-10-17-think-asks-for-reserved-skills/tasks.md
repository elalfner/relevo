## 1. `think` asks for a reserved skill

- [x] 1.1 In `skills/think/SKILL.md`, step 1: tell missing, reserved and invocable apart (a skill listed among the available skills is invocable; a folder found only on disk has its frontmatter read; only a skill that is not there stops `think`)
- [x] 1.2 Step 3: invoke the grilling skill only when it is invocable; when it is reserved, do not try it, ask the person to run `/grill-with-docs` in this same conversation and do not replicate its flow
- [x] 1.3 In that same message, give the hand-off: run `/relevo:create` when the interview ends, the settled terms stay in "To document" and nothing was written to the repository
- [x] 1.4 Update `tests/skill-think.test.mjs` for all of it

## 2. `doctor` shows a reserved skill as a notice

- [x] 2.1 In `scripts/lib/doctor.mjs`, read the frontmatter of each required skill found as a folder and keep the ones that set `disable-model-invocation` as a new fact (the existing facts do not change shape); `scripts/doctor.mjs` already passes the read probe
- [x] 2.2 Report such a skill as a passing check whose message says the person launches it by hand, and keep a missing skill a failure
- [x] 2.3 Update `tests/doctor.test.mjs` (reserved passes with the notice, missing still fails, an unreadable file counts as invocable)

## 3. Close the loop

- [x] 3.1 Update the `think` row and the skills table of `README.md` and `README.es.md`, keeping the two in step
- [x] 3.2 Run the full suite and `openspec validate --all`
- [x] 3.3 Run `doctor` against the sandbox, where `grill-with-docs` is installed and reserved, and see the notice (checked on 2026-10-16: the check passes with "it is reserved for you, so run /grill-with-docs by hand when `think` asks")
