# Design

## Context

- `qa-aggregate.mjs` already returns, per attempt, the blocking findings (reviewer, class, text), the advisory notes and the result. `skills/go/references/qa-run.md` is followed by `go`, `fix` and `review`. Nothing stores the output.
- Comments already carry hidden markers (`relevo:usage`, `relevo:qa-notes`). The usage comment exists only for cloud runs, while many builds run on a machine; the hand-off, failure and fix comments exist in both.
- `parseUsageMarker` counts only bots. A local build posts its comment as the person.

## Goals / Non-Goals

**Goals:** figures a project can trust enough to look at, with no new step for the person.

**Non-Goals:** proving that a blocking finding was a real defect (a person samples the texts); the QA of `review`, which posts no comment on the issue when it passes; runs cut before their comment; files projects in the report; rebuilding past runs from transcripts or logs; publishing any figure.

## Decisions

**The script that decides also records.** `qa-aggregate.mjs` takes `--log <file>` and appends one line per decided attempt; `validation-gate.mjs` takes the same flag and appends a line when it is red. Alternative: the skill writes the record. Rejected: it would be text of the model, and a step the model can skip silently. The file lives in the scratch folder of the run, never in the repository.

**The record goes in the closing comment.** `render-message.mjs` takes `qa_log` (a path) in its data, reads it, applies redaction and `trust`, and puts the marker in `built`, `build_failed` and `fix_done`. Alternative: the usage comment, rejected because local builds have none. A file in the branch, rejected because it would be part of the diff under review.

**Marker.** `<!-- relevo:qa-record {…} -->` with `v`, `command` (`go` or `fix`), `passed`, `rounds` (`gate`, `blocking` as `{lens, class, text}`, `advisory` as a count), `omitted`, and for a fix `kind`. `<` and `>` are escaped as in `qa-notes`. Texts are cut to 160 characters and at most 20 are kept; `omitted` counts the rest, and every finding still counts in the figures through its reviewer and class.

**Headline figure.** The report leads with the blocking findings of the first attempt. A later attempt may repeat a finding in other words, so adding attempts would count it twice.

**The kind of a fix.** The skill decides it in the step where it already reads the defect against the specification, says it to the person and passes it as `kind` to `fix_done`. Alternative: ask a question on every fix, rejected as friction. A caller that gives no kind renders the comment as today. The report counts only `defect` as something QA could have caught.

**Where the report lives.** `relevo qa-report [--repo owner/name] [--since YYYY-MM-DD] [--list]` in the command line, not a tenth `/relevo:` command: it is read once in a while and needs no model. The digest line reuses the same parser and the one read of comments that the usage line already makes.

**Trust.** A record counts from a bot, or from an author whose association is owner, member or collaborator. This is wider than the usage marker because local builds are posted by people.

## Risks / Trade-offs

- [A blocking finding can be a false positive or a style preference] → the report says "stopped", never "bugs avoided", and `--list` gives the texts to sample.
- [The model classifies its own miss as a gap or a change] → the kind is shown to the person, who can correct it.
- [A finding quotes code or a secret in an issue comment] → redaction, the length bound and no text on public repositories. The redactor can miss a secret it does not know, which the security page says.
- [The comment grows] → the bound on texts keeps the marker small.
- [An installed workflow pins an older version] → those runs leave no record; the report counts only what has one.
