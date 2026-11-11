# Evaluation of the QA lenses on seeded defects

This page records one evaluation of the four QA lenses (`spec`, `security`, `code`, `interface`) on defects that were put into small changes on purpose. It was run on 2026-11-02 with `scripts/eval-lenses.mjs`, and a second run on 2026-11-04 covered every case and timed each lens. Read the limits below before you rely on the numbers: the sample is small, and most of the runs were spent finding faults of the evaluation itself.

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

The cases: a state update after an `await` without a check (Flutter), an unescaped output (Laravel), a table without a policy (Supabase), a missing scenario implementation, a task checked off with no code, a broken decision of the issue, an altered documentation text, and three interface rules (accessible name, form label, double submit). The hard-coded secret case (`security/vue/hard-coded-secret`) was the only one of the 11 cases that was **not run** in the first runs; the second run covered it.

## Second run, 2026-11-04: all 11 cases, with the time of each lens

`scripts/eval-lenses.mjs` now also measures the wall-clock time of each lens call (it includes starting the `claude -p` process). The 11 cases were run once more, 22 runs, with the same setup as above (simulated receipt, the model of each agent file, no rule removed, no skill added):

| Lens | Cases | Defects found | Good variants flagged | Cost (USD) | Time (s) | Time per run (s) |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | 1 | 1 | 0 | 0.11 | 20.6 | 10.3 |
| `interface` | 3 | 3 | 0 | 0.37 | 62.2 | 10.4 |
| `security` | 3 | 3 | 0 | 0.63 | 82.5 | 13.8 |
| `spec` | 4 | 4 | 0 | 1.01 | 130.1 | 16.3 |

The total was 2.11 USD and 295.4 s. This run includes `security/vue/hard-coded-secret`, which the first runs did not cover: it found the defect and did not flag the good variant. Every lens met the threshold on all 11 cases.

The lenses run one at a time, so a pass of the four on one small change takes about the sum of one run of each, around 50 s here, against 10 to 16 s for a single lens. These are small seeded changes; a real change will take longer. There is no measurement of the single QA agent that preceded the lenses, so the table does not say how much slower the four lenses are than it.

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

## Cheaper models (2026-11-06)

`--model <name>` runs every selected lens with one model instead of the one in its agent file, to check the models that `model: auto` can pick. One run per case, so the sample is small.

| Lens | Model | Defects found | Good variants flagged | Cost (USD) |
| --- | --- | --- | --- | --- |
| `spec` | sonnet (default: opus) | 4/4 | 0/4 | 0.44 |
| `security` | sonnet (default: opus) | 3/3 | 0/3 | 0.33 |
| `code` | haiku (default: sonnet) | 1/1 | 1/1 | 0.01 |
| `interface` | haiku (default: sonnet) | 3/3 | 1/3 | 0.04 |

By the threshold above (every defect found, no good variant flagged): sonnet passes for `spec` and `security`; haiku does not pass for `code` and `interface`. It finds the seeded defects but also rejects clean changes (a missing `pubspec.yaml` in the fixture, a stub without a marker, one form), which would send correct work back to the developer. So `auto` should not go below sonnet for QA lenses until a larger sample says otherwise.

## What this does not show

- It is a small sample of 11 cases; each case was run once in each run, so little is known about how much a lens varies between runs.
- The defects are the clearest ones. The evaluation does not say how much a lens misses in a noisy, real change.
- The lenses were run only with the model of their agent file. There is no comparison between models, so **no default model or effort was changed** on this evidence. The maintainer decided on 2026-11-02 to keep the defaults as they are.
- The receipt is simulated and no analysis or test ran.
- The `scenario-without-code` good variant received a test after the run and was not run again.
- The threshold, set by the maintainer on 2026-11-02 for this sample: a lens must find **every** seeded defect of its cases and flag **no** good variant (100 % and 0 false positives). It is to be reviewed when there are more cases. All four lenses meet it on all 11 cases, as of the run of 2026-11-04.

## Run it again

`node scripts/eval-lenses.mjs --lens code,security --cases "state-update|unescaped" --max-budget-usd 0.25` prints an estimate and asks before it spends model usage. `--dry-run` uses a stub and spends nothing. `--without-rule <text>` removes the lines of the lens that contain the text, and `--with-skill <file>` adds a skill, to see what a rule or a skill is worth. The report names what a lens said wherever a result was not the expected one.
