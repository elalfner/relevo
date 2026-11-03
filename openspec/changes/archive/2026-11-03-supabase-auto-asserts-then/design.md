## Context

`assertProvedByRun` (`scripts/lib/review-state.mjs`) refuses `precheck ok` and `auto` unless the last run of the agent for the line exited 0 and ran at least one test. For Supabase that is the count of `Files=F, Tests=N`, which says nothing about which assertion covers which line. The manual review of 2026-11-03 showed that a file that passes for another reason proves a line.

## Goals / Non-Goals

**Goals:** make the agent name the assertions that cover a line, refuse names that are not in the file or that failed, and show the names in the pull request.
**Non-Goals:** deciding by script that an assertion really proves a `THEN` (it cannot), parsing pgTAP, changing Laravel, or changing the person's runs.

## Decisions

**Assumption: the mechanism is `--covers`.** This mechanism is the author's proposal, not something the user specified; the user approved proposing a change for the gap. `review-state.mjs ran ... --line <n> --filter <file> --tap <output> --covers "<name>[, <name>]"` stores the names (a comma-separated list, as `--failing` does) in the run. Names are the descriptions the test gives its assertions, the same strings pgTAP prints in `# Failed test N: "name"`.

**The guard.** For a Supabase line, `precheck ok` and `auto` are refused unless the last run of the agent for the line has at least one covered name, every covered name appears in the text of the pgTAP file and none is in the run's `failing` names. The file is the run's `filter`, read relative to the platform folder (`state.cwd`); a file that cannot be read refuses the proof. A name matches as a substring of the file text after reading a doubled quote (`''`) as one. Laravel lines and the person's runs do not go through this guard.

**The limit, stated.** A covered name that exists, passed and is misjudged by the agent still proves the line: the script cannot tell whether `anon cannot insert orders` asserts the `THEN` of the line. What it removes is the silent case, a run that passes with no named assertion behind the line, and it leaves the claim written in the pull request where the person can read it. The rest of the proof is the agent's reading and the person's confirmation (`verify` still asks the person to confirm).

**The pull request lists them.** `runsSection` adds ``, covers `name`, `name` `` to the line of a Supabase run that has them.

Alternative: parse the `.sql` file to match a name to the `THEN`. Rejected: it needs a model of SQL and of the sentence, and would give a false certainty. Alternative: require one assertion per line. Rejected: a scenario often needs two (`policies_are` and a `throws_ok`).

## Risks / Trade-offs

- [The agent copies a name to satisfy the guard] → the name is shown in the pull request and the person confirms the line; the guard cannot do more.
- [A description with a comma] → the list is split on commas as `--failing` is; a name with a comma is written as two names that both appear in the file, which is a known limit.
- [Existing state files and skills] → a run recorded without `--covers` before this change keeps being read; a new proof of a Supabase line needs the names, and the skill says so.
