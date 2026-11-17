# Design

## Context

See `proposal.md` for the motivation. What the code has today:

- The label is one entry of `LABELS` in `scripts/lib/labels.mjs`: key `qa-failed`, name `relevo:qa-failed`, kind `exit`. Its key is also the key that `labels` of `relevo.yml` accepts (`config.mjs` validates against `LABEL_KEYS`), the state name in `status`, `stages`, `ship`, `next-step` and `can-edit-issue`, and the `--state` argument of `next-step.mjs`.
- The name is written literally in `templates/workflows/relevo-go.yml` (the failure steps run `gh issue edit ... --add-label relevo:qa-failed`) and in the comment that tells people to change it if they renamed the label.
- The comment of a failed build is the message kind `qa_failed` of `scripts/lib/messages.mjs` (90 occurrences with its tests), which the `go` skill renders with `render-message.mjs qa_failed`.
- `init` creates labels with `gh label create --force`, which updates the colour and description of a label of the same name and creates any other; nothing renames a label. `doctor` reports missing labels.
- The name is in 16 scripts, 3 skills, 1 template, 19 pages of `docs/`, 23 test files and 11 main specs.
- `tests/fixtures/workflows/relevo-go-0.12.0.yml` is a copy of an old template that tests read as "a workflow installed from an earlier version".

## Goals / Non-Goals

**Goals:**
- One name, `build-failed`, in the label, its key, the message kind and every text a person reads.
- The issues of a repository that already carry the label keep it.
- A repository that was not migrated is told so, by `doctor` and by validation, instead of failing later in a run.

**Non-Goals:**
- Changing which problems end a build, what is pushed, or what `fix` and a retry accept: no behaviour moves.
- Renaming the reasons written in comments or the classes of outcome that describe a real QA rejection (`qa-non-fixable`, `qa-fixable-after-retries`).
- Rewriting comments already posted on issues.

## Decisions

- **Rename the key, the name and the message kind together.** `qa-failed` becomes `build-failed` in `LABELS` (key and default name), and the message kind `qa_failed` becomes `build_failed`, with its helper functions. A half rename (new label, old key) would leave the old word in `relevo.yml`, in `status` and in every script call, which is what the proposal rules out. Alternative considered: keep the internal key and change only the displayed name; rejected because the key is public in `relevo.yml` and in `next-step.mjs --state`.
- **No alias; the former key is refused by name.** `config.mjs` already rejects an unknown key of `labels` with the list of allowed keys. It gets one special case: `qa-failed` is rejected with "the key is now `build-failed`", so a person who upgrades reads what to do instead of a generic list. A `render-message.mjs qa_failed` call fails as any unknown kind does; the only caller is the skill, which ships with the scripts.
- **Rename the label on GitHub with the REST API.** `PATCH repos/{repo}/labels/{former name}` with `new_name` renames a label and keeps it on every issue, open or closed. `init` plans it as one more item before the creation of labels: when the repository has the former effective name (the default, since the former key can no longer be in `relevo.yml`) and not the new one, it renames; `gh label create --force` then sets the description and colour. When both exist it changes nothing and lists the issues that still carry the former one, because merging two labels means editing issues, which `init` does not do without being asked. Alternative considered: create the new label and relabel the open issues; rejected because closed issues would keep a label that no longer means anything and the history of the label would split.
- **`doctor` fails, not warns.** A repository with the former label, or a workflow that still names it, is half migrated: the planner would not find its failed builds and the workflow would apply a label that nothing reads. Both are reported under the existing label and workflow checks, with `/relevo:init` as the fix. The workflow check compares names found in the `gh issue edit` lines of the installed file, not the whole file against the template, so a workflow edited for other reasons is not flagged.
- **The old-template fixture is not touched.** `relevo-go-0.12.0.yml` stands for an installed workflow of an earlier version; it keeps the former name and becomes the fixture of the new `doctor` check.
- **Three scenario titles keep the former name until the archive.** A MODIFIED block cannot rename a scenario (the archive refuses to drop the old title), so "Fix after qa-failed" in `fix` and two titles in `go` keep their titles in the delta; their steps use the new name. They are corrected in the main specs by hand after the archive.
- **Mechanical first, by layer.** The rename is done in this order so the suite is green at each step: the label set and config (with the tests of both), then the scripts that read the state, then the messages, then the templates and skills, then the documentation. Each layer is a search for `qa-failed`, `qa_failed` and `qaFailed` limited to its files.

## Risks / Trade-offs

- [A repository upgrades the plugin and not its workflow] → the installed workflow applies `relevo:qa-failed`, which `go` no longer reads; `doctor` fails and names the file, and the changelog says to run `init` first.
- [Comments already posted say `qa-failed`] → they are history and stay. `failure-comment.mjs` recognises the work of a failed build by the subject of its commit (`wip: rejected by QA`, `wip: stopped by limit`), not by the name of the label, so `fix` still finds it; a task verifies this with a test.
- [The digest and `status` read markers of earlier runs] → the usage marker holds classes of outcome, not the label, and those classes are not renamed.
- [Wide change, conflicts with work in flight] → it is built first and merged before the other three changes start; they are written on the new name.
- [`docs-claims.test.mjs` compares documentation with code] → the documentation of each layer is renamed in the same group as its code, so the test stays green.

## Migration Plan

1. Release with the plugin version that carries `split-ready-and-go` (one breaking release for the label interface).
2. In each repository: update the plugin, run `/relevo:init` (it rewrites the workflows and renames the label), change `qa-failed` to `build-failed` under `labels` in `relevo.yml` if it was renamed there, and run `/relevo:doctor`.
3. Rollback: the former plugin version and the former workflows; the label is renamed back by hand in the repository settings (issues keep it either way).
