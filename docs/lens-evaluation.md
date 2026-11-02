# Evaluation of the QA lenses on seeded defects

This page records one evaluation of the four QA lenses (`spec`, `security`, `code`, `interface`) on defects that were put into small changes on purpose. It was run on 2026-11-02 with `scripts/eval-lenses.mjs`. Read the limits below before you rely on the numbers: the sample is small, and most of the runs were spent finding faults of the evaluation itself.

## What was measured

Each case in `tests/fixtures/lens-defects/<lens>/<stack>/<case>/` has a **bad** variant, with one defect, and a **good** variant, which differs only by the fix. A lens **finds** a defect when it rejects the bad variant with a finding that matches the expected text of the case. A good variant that a lens rejects counts as a **false positive** for that lens. The match is a keyword test on the report, so a lucky match is possible.

Each variant is laid out in a throwaway git repository with the base branch `main` empty, and each lens runs there with the model of its agent file. The receipt of the validation gate is **simulated**: it is written green with a valid hash, and it says that the analysis and the tests were not run. The interface lens receives the rules that `interface-rules.mjs` selects for the stack. The cost is the notional figure of a subscription run, not an invoice.

## Result

Latest valid run of each lens:

| Lens | Cases | Defects found | Good variants flagged |
| --- | --- | --- | --- |
| `code` | 1 | 1 | 0 |
| `security` | 2 | 2 | 0 |
| `spec` | 4 | 4 | 0 of 3 in the first run; the fourth was flagged, and passed once its fixture had a test (see below) |
| `interface` | 3 | 3 | 0 |

The cases: a state update after an `await` without a check (Flutter), an unescaped output (Laravel), a table without a policy (Supabase), a missing scenario implementation, a task checked off with no code, a broken decision of the issue, an altered documentation text, and three interface rules (accessible name, form label, double submit). The hard-coded secret case (`security/vue/hard-coded-secret`) was the only one of the 11 cases that was **not run**.

## How the result was reached

The first runs measured the evaluation and not the lenses, and each was corrected:

| Run | What it showed | Cost |
| --- | --- | --- |
| `code`, `security`, files pasted into the prompt | The lens rejected a change that had no receipt before it read the code, so the "found" of that run is not reliable | 0.39 |
| `code`, again | The same: both variants rejected for the missing receipt | 0.07 |
| `code`, `security`, a real folder and a simulated receipt | Valid. `code` 1/1 and 0/1, `security` 2/2 and 0/2 | 0.44 |
| `spec`, `interface` | `interface` passed everything because it was given no rules. `spec` flagged one good variant, because the fixture had no test | 1.09 |
| `interface`, `spec` (one case) | `interface` found 3/3 and flagged 3/3: the good variants fixed only the seeded defect, and the lens was right to reject them for other rules. `spec` passed the good variant once it had a test | 0.52 |
| `interface`, good variants that meet the other rules | Valid. 3/3 and 0/3 | 0.33 |

The total is about 2.84 USD in model usage. Three of the six runs are valid for their lens.

## What this does not show

- It is a small sample of 10 of the 11 cases; each case was run once, so nothing is known about how much a lens varies between runs.
- The defects are the clearest ones. The evaluation does not say how much a lens misses in a noisy, real change.
- The lenses were run only with the model of their agent file. There is no comparison between models, so **no default model or effort was changed** on this evidence. The maintainer decided on 2026-11-02 to keep the defaults as they are.
- The receipt is simulated and no analysis or test ran.
- The `scenario-without-code` good variant received a test after the run and was not run again.
- The thresholds (how many defects a lens must find, how many false positives it may give) are **not set**: they are the maintainer's decision, and the numbers above are the input for it.

## Run it again

`node scripts/eval-lenses.mjs --lens code,security --cases "state-update|unescaped" --max-budget-usd 0.25` prints an estimate and asks before it spends model usage. `--dry-run` uses a stub and spends nothing. `--without-rule <text>` removes the lines of the lens that contain the text, and `--with-skill <file>` adds a skill, to see what a rule or a skill is worth. The report names what a lens said wherever a result was not the expected one.
