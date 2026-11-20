# Proposal

## Why

The audit of a declared `api` adapter (Nhost, or a stack of the repository) reports every Postgres `ERROR:` line as a finding of class `database-error` unless it is a permission, row-level-security or constraint denial. A project that enforces its rules with its own `RAISE EXCEPTION 'code: text'` in triggers and functions, and whose tests provoke those errors on purpose (each tied to a spec scenario), gets one finding per provoked error. A real run was rejected with 48 findings of that class, and the only way out was to waive each one by hand. The repository knows which codes its rules raise; the plugin cannot.

## What Changes

- **A new key `review.expected_errors`** in the `review` block of the repository profile `.relevo/stacks/<stack>.md`: a list of plain substrings. A Postgres `ERROR:` line whose message (the text after `ERROR:`) contains one of them is an expected error: listed in the report with the pattern that matched and its count, not a finding.
- **Validated like the other `review` keys**: a list of strings of 3 to 100 characters from a safe set (letters, digits, space, `_ . : , ' / -`), and no entry may match, or be matched by, a signal the audit never excuses: `FATAL`, `PANIC`, deadlock, out of memory, an HTTP status of 500 or above, or the word `ERROR` alone.
- **Honored only for a declared adapter** (the generic `api` adapter: `nhost`, or a repository stack with `adapter: api`). On `laravel`, `supabase` and any stack whose adapter the plugin keeps, the key is ignored and reported as ignored.
- **The shipped `nhost` profile has no default list**: it cannot know a project's codes.
- **The audit never excuses by pattern** a line that carries a `FATAL` or `PANIC` level, a deadlock, an out-of-memory message or an HTTP 5xx; those stay findings whatever the list says. As for a denial, an expected error is listed only while a run is recorded; with no run, it is a finding.
- **Report, `stack-profile --role review` and `doctor`**: the report lists each pattern with its count and a few log lines; `--role review` prints the key (and an ignored one as a warning); `doctor` notes the declared patterns and warns when they are ignored.
- **A waiver stays the person's decision.** The list is the repository's declaration, written in the profile and reviewed in a pull request; the agent never adds a pattern, and never waives.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review`: the audit of a declared adapter and its report.
- `platforms`: the `review` block accepts `expected_errors`.
- `init-doctor`: `doctor` reports the declared patterns and the ignored key.

## Impact

- Code: `scripts/lib/logaudit.mjs`, `scripts/review-state.mjs`, `scripts/lib/review-state.mjs`, `scripts/lib/stack-profile.mjs`, `scripts/lib/doctor.mjs`, `skills/review/SKILL.md`.
- Tests: `tests/review-declared.test.mjs`, `tests/stack-profile.test.mjs`, `tests/doctor.test.mjs`.
- Documentation: `docs/stacks.md`, `docs/stacks.es.md`, `CHANGELOG.md`.
- Out of scope: regular expressions, a list for `laravel` or `supabase`, a default list for `nhost`, patterns for other levels (`WARNING`).
