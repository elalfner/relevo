## 1. Next-step table

- [ ] 1.1 Add the `rebuild` variant to `qa-failed` in `scripts/lib/next-step.mjs` with the English and Spanish hint
- [ ] 1.2 Test: `nextStep({ state: 'qa-failed', reason: 'rebuild', issue: 37 })` has no command, owner assignee, and the hint in both languages

## 2. Message

- [ ] 2.1 In `scripts/lib/messages.mjs` use `rebuild` for `branch_state` `unsafe` and `not_pushed` when no `recovery` is given
- [ ] 2.2 Test in `tests/messages.test.mjs`: `unsafe` and `not_pushed` (English and Spanish) end with the rebuild step and do not contain `/relevo:fix`
- [ ] 2.3 Test: `pushed`, `kept` and `existing` keep their next step (`tests/wip-commit.test.mjs` line 64 must still pass unchanged)

## 3. Skill and docs

- [ ] 3.1 Check `skills/go/SKILL.md` failure path and `docs/` for text that says the default recovery is `fix` for unpushed branches, and correct it
- [ ] 3.2 Run the full test suite and `openspec validate qa-failed-rebuild-next-step`
