## Why

In a Supabase review with `precheck` or `verify`, a line is proved when the agent's run for it exited 0 with at least one assertion. The script does not check that the pgTAP file asserts the `THEN` of the line, so a file that passes for another reason proves a line it does not cover (found in the manual review of `supabase-review-adapter`, task 6.1, `docs/pilot-findings.md`: "Not caught").

## What Changes

- The agent records, with each pgTAP run for a line, the names of the assertions of the file that cover the `THEN` (`--covers`).
- `precheck ok` and `auto` for a Supabase line are refused unless the run has at least one covered name, every covered name appears in the pgTAP file and none of them is among the run's failing names.
- The pull request lists the covered names for each line proved.
- The check is mechanical: it stops an invented or mistyped name and a run whose covering assertion failed, and it does not prove that a name really asserts the `THEN`. That stays the agent's judgment and the person's confirmation.

## Capabilities

### New Capabilities

### Modified Capabilities
- `review`: the requirement "The agent proves a line of an api review with an existing test".

## Impact

- `scripts/review-state.mjs` and `scripts/lib/review-state.mjs` (`recordRun`, the proof guard, `runsSection`), `skills/review/SKILL.md` (step 5 for Supabase), `tests/review-supabase.test.mjs`, `tests/review-autopilot.test.mjs`.
- `docs/commands.md`, `docs/commands.es.md`, `CHANGELOG.md`, `docs/pilot-findings.md` (the "Not caught" line).
- Laravel, the person's runs and the `off` mode are unchanged.
