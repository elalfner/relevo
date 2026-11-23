# Proposal

## Why

The test harness of a project deletes its temporary databases with `DROP DATABASE ... WITH (FORCE)`. Postgres then ends an autovacuum worker of that database and writes `FATAL:  terminating autovacuum process due to administrator command`. The audit of a declared adapter counts that line as a `fatal` finding, and `review.expected_errors` cannot excuse it: it only covers `ERROR:` lines, and its validator forbids any entry that names `FATAL` on purpose, so that a list of expected errors can never hide a real failure. The review of issue 89 therefore had a finding that no profile could declare, and the person's only way out was a waiver on every run.

The follow-up line Postgres writes, `checkpoint starting: immediate force wait`, is a `LOG` entry: the audit already ignores it, and it is not part of this change.

## What Changes

- **A new key `review.expected_fatals`** in the repository's profile of a declared adapter: a list of the **whole messages** of `FATAL:` lines that the project's own test harness provokes. An entry matches a `FATAL:` line only when the message after `FATAL:` is equal to the entry (whitespace collapsed), never when it merely contains it.
- **Same guarantees as `expected_errors`**: the entry lives in the repository's profile (the plugin's profiles cannot carry it), it is recorded in the review state at `init` (`--expected-fatal <text>`), it is honored only for a declared adapter, it is listed in the report with the pattern that matched and its count, it needs a recorded run to count, the agent never adds one, and a waiver stays the person's decision.
- **Fatal signals that stay out of reach**: an entry cannot name `PANIC`, a deadlock, out of memory or an HTTP status of 500 or above, and a `FATAL:` line that carries one of them stays a finding whatever the list says.
- **`doctor`** notes the number of declared fatals, warns when the key is ignored on a stack that is not declared, and reports an invalid entry as an invalid profile.
- **Documentation** in `docs/stacks.md` and `docs/stacks.es.md` says how to declare it, and that an entry is a whole message, with the autovacuum message as the example.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review`: the audit of a declared adapter treats a listed whole-message `FATAL:` as expected, and the rule that a fatal signal is never excused names this single exception.
- `platforms`: a declared adapter's profile can list `expected_fatals`, with their own validation, and the key is honored only for a declared adapter.
- `init-doctor`: `doctor` reports the declared fatals, warns when the key is ignored, and reports an invalid entry.

## Impact

- Code: `scripts/lib/stack-profile.mjs` (the key and its validator), `scripts/lib/logaudit.mjs` (matching, the report), `scripts/lib/review-state.mjs` and `scripts/review-state.mjs` (`--expected-fatal`, the state), `scripts/lib/doctor.mjs`; their tests.
- Documentation: `skills/review/SKILL.md` (pass the list to `init`), `docs/stacks.md`, `docs/stacks.es.md`, `CHANGELOG.md`.
- Depends on `harden-api-review-audit` only for the files they both touch (`logaudit.mjs`, `review-state.mjs`): no requirement is modified by both, so either can be applied first, and this one should start from the other once it is integrated.
- Out of scope: excusing a `FATAL` by substring or pattern, the `LOG` lines that follow it, any key for `PANIC`, deadlock or out of memory, and a way for the agent to propose an entry.
- Breaks: nothing. A repository that does not set the key sees no difference.
