# Design

## Decisions

### 1. Plain substrings of the message, not regular expressions

An entry is a case-sensitive substring of the text after the first `ERROR:` of the line (for example `bitacora_inmutable`, or `permiso_denegado:`). A regular expression written in a profile is a way to excuse much more than intended and a ReDoS risk. The charset of an entry (`A-Za-z0-9 _.:,'/-`, 3 to 100 characters, first character a letter or digit) also makes it safe to pass on a command line and to print in a report.

### 2. Never excuses a signal that belongs to no framework

Two layers. At validation, an entry is invalid when it contains `fatal`, `panic`, `deadlock`, `out of memory`, `error`, `5xx` forms (`response 5`, `HTTP/`, `500`) as a word (case-insensitive), or when it is a substring of one of them (`fat`, `memory`, `dead`). At audit time the order of the rules already guarantees it: a line with a `FATAL`/`PANIC` level, `deadlock detected` or `out of memory`, or an HTTP 5xx never reaches the expected check; the expected check applies only to a line with `ERROR:` that none of those rules claim.

### 3. Where the list lives and how the audit gets it

The profile resolves `review.expected_errors`. The skill passes each entry to `review-state.mjs init` as a repeated `--expected-error "<text>"` (declared adapters only), and the state stores `expectedErrors`; `audit` reads it from the state, as it reads `declared`. The audit module stays free of profile reading, and a repository profile changed after `init` does not change a review under way.

### 4. Honored only for a declared adapter

`mergeProfiles` keeps `expected_errors` of the repository. `resolveProfile` moves it to `ignored` (with the reason) and removes it from `review` when the adapter is not generic: no `adapter: api` and `nhost`-like entry. `review-state.mjs init` also refuses `--expected-error` without `--declared`, and `auditApi` reads the list only for the `declared` flavor, so the three layers agree.

### 5. Same rule as a denial about runs

A denial is listed as expected only while a run is recorded, since otherwise nothing shows that the code was exercised. An expected error follows that rule: with no recorded run it is a finding of the class `denial`, which the verdict and the waiver flow already handle.

### 6. No default for `nhost`

The shipped profile says nothing: the codes belong to a project. The section Review of `stacks/nhost.md` only says that a project lists its own codes in its profile.

### 7. Reporting

The report adds, after the denials: "N expected error(s) declared by the repository in `review.expected_errors`; they are not findings", one line per pattern with its count, and up to 5 sample lines. The state keeps `{ line, excerpt, pattern }` for each. `--role review` prints `review.expected_errors` as any key, and a warning when ignored. `doctor` notes the number of patterns for a declared adapter ("the audit lists, and does not flag, an error whose message contains one of them; a waiver stays your decision") and warns when ignored.

## Risks

- A too-generic pattern (`no`) hides real errors: the minimum length and the validation of reserved words reduce it; the report always lists the matches, so the pull request that adds a pattern and the report show what it hides.
- A project lists a code that a bug also raises: the report counts each pattern, so a code that appears more than the scenarios provoke is visible.
