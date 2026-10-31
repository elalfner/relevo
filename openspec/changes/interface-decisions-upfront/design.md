# Design

## Context

See `proposal.md` for the motivation. What exists today and shapes the approach:

- A stack profile already has three sections that map to three of the four ways the knowledge is read: "Questions for the issue writer" (asked by `issue` through `stack-profile.mjs --role issue`), "Hygiene for the developer" and "What the auditor looks for in the diff". The profile is resolved by a script and handed to `dev` and `qa` by `go`. There is no section shared between stacks, so a rule that holds everywhere would be written once per stack.
- `issue` already accepts a `Design reference` section whose bullets point to a file, a pasted attachment, a file of a linked repository or a fenced block of example code, and says after a colon what must match. `go` copies it to `design.md`, adds a scenario "Matches the reference <name>" and QA compares the code with it: with example code it compares structure, tokens and states. At most five references are accepted, and an issue of more than about 8,000 characters passes with a warning.
- `think` runs `openspec-explore` and then `grill-with-docs`, which is reserved for the person, and writes no file. It keeps the agreement as a list of decisions, constraints, assumptions and questions with ids, and "To document".
- `qa` cannot compare pixels and says so; it rejects only what the code makes clearly different. The person confirms appearance on a screen.
- The plugin copies `scripts`, `stacks` and `templates` into the plugin it renders for Antigravity.
- `.relevo/` and the folders of skills are hard-protected paths: only a person changes them.

## Goals / Non-Goals

**Goals:**

- Decide how something must look, in every state, before the build, and make that decision checkable.
- Give the developer agent and QA the same rules, in the form each needs, without growing the cost of every turn.
- Work for any web or mobile stack and any design system, with nothing about one project written into the plugin.
- Say plainly what was not checked.

**Non-Goals:**

- The specialist QA lenses and their blocking rule over attempts (change `specialist-review-lenses`). Until then QA applies the rules inside its single review.
- A visual preview for Flutter, comparing pixels or screenshots, and generating images.
- Letting a repository weaken a rule.
- Installing, recommending or depending on any external design skill.

## Decisions

**decided** came out of the exploration with the maintainer. **proposed** is set here and is still to confirm when the design is reviewed.

### D1. The knowledge is data read by a script, not prose loaded whole (proposed)

`knowledge/interface/rules.json` holds the rules. A script selects and prints the ones an agent needs; no agent reads the file. Each rule has:

| Field | Meaning |
|---|---|
| `id` | Stable kebab-case slug, owned by Relevo |
| `category`, `title` | For grouping and display |
| `principle` | One or two sentences in Relevo's words, never a CSS recipe |
| `applies` | `all`, `web` or `mobile` |
| `weight` | `blocking` (the source's critical and high rules) or `advisory` (medium and low) |
| `check` | `code`, `render` or `person`: how it can be verified |
| `core` | True for the small set always considered for the platform |
| `touches` | Tags that make the rule relevant to a change (forms, tables, lists, navigation, overlays, media, motion, authentication and so on) |
| `ask`, `build`, `review` | The question, the "build it like this" and the "check this", each short |
| `examples` | Pairs of good and bad, each tagged by stack (`html`, `tailwind`, `vue`, `flutter`, `neutral`) |
| `source` | The work and the number of the guideline it came from |

JSON needs no new parser, keeps the examples nested and lets a test check the data. Alternatives: one Markdown file per category (a parser and no way to select a rule); the original CSV (loses the nested examples and the stack tags).

### D2. What is in, what is out, and what is merged (decided)

Of the 119 guidelines in the source, 84 are adopted. The curation criteria: it applies to a page or a component built from an issue; it can be verified in a diff, in a rendered page or by a person looking at a device; it is not a duplicate; it is not tied to a product type. The record of the curation lives in `knowledge/interface/CURATION.md` with the source number of each decision, so a later review can re-check it.

| Group | Source numbers |
|---|---|
| Accessibility (20) | 28, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 100, 103, 104, 107, 108, 109, 112, 117, 118 |
| Layout and content (18) | 15, 16, 17, 19, 20, 65, 66, 67, 68, 69, 70, 71, 84, 111, 113, 114, 115, 116 |
| Forms (8) | 55, 56, 57, 58, 59, 60, 61, 63 |
| Interaction (7) | 11, 30, 31, 32, 33, 34, 35 |
| Motion (5) | 8, 9, 12, 13, 119 |
| Feedback (5) | 78, 79, 80, 81, 82 |
| Typography (4) | 72, 73, 74, 75 |
| Performance (4) | 46, 47, 48, 51 |
| Navigation (4) | 2, 3, 4, 5 |
| Content (3) | 85, 86, 87 |
| Touch (3) | 22, 23, 24 |
| Search and media (3) | 89, 90, 96 |

Merged into another rule: 10 into 78, 54 into 43, 76 into 36, 83 into 34, 99 into 9, 21 into 73, 50 into 75, 18 into 15. Left out: for landing pages and style (1, 6, 7, 14, 53, 64, 77, 110); for one product type (88, 91, 92, 93, 94, 95, 97, 98); not verifiable in a diff (49, 52); enhanced or low value (25, 26, 27, 29, 62, 101, 102, 105, 106). The AI-product rules could become an optional pack later.

### D3. Wording, licence and verification (decided that attribution is required; wording proposed)

The rules are rewritten in Relevo's words and the examples keep their code with a stack tag. `NOTICE` gets a third licensed work, the source collection, with its copyright line, and the sentence that says the plugin does not include the files of the works it uses is corrected, because the plugin now ships adapted text. The licence text already reproduced stays. A test checks that every `source` value of the rules is named in `NOTICE`. Every rule that cites a WCAG 2.2 criterion is checked against the W3C text, and the date it was read is recorded in the file, as the profiles do for their sources. A rule that cannot be confirmed is corrected or removed. Where the source marks an enhanced (AAA) criterion, it is not presented as a requirement.

### D4. A script selects the rules for a role, a stack and a change (proposed)

`interface-rules.mjs --stack <name> --role think|issue|dev|qa|review [--text <files>] [--budget <bytes>]`:

- Takes the interface kinds of the profile (and `web` when a mobile stack builds for the web target) and keeps the rules whose `applies` matches.
- Always keeps the `core` rules, at most about twenty, chosen while curating.
- Adds the rules whose `touches` tags match words found in the given text (the issue, or `tasks.md` and `design.md`) through a keyword map in English and Spanish.
- Prints the face the role needs: `ask` for `think` and `issue`, `build` for `dev`, `review` for `qa` and `review`, with the examples of the stack of the issue only.
- Has a default budget of about 4 KB for `dev` and `qa`. Over the budget it drops advisory rules first and then the examples of non-core rules, and never drops a blocking core rule. It prints how many rules it left out, so nothing is cut silently.
- `--coverage` lists the blocking rules that have no example for a stack. Tests print it as a warning, so a gap is visible and never hidden.

### D5. The profile says whether the stack has an interface and translates rules (proposed)

A profile gets `interface:` with a list of kinds (`web`, `mobile`) or `none`. The plugin's profiles: Flutter `mobile` (plus `web` for a web target), Vue `web`, Laravel `web`, Supabase `none`. A stack of the repository (`.relevo/stacks/<stack>.md`) declares its own. `knowledge/interface/stacks/<stack>.json` overrides the `build`, `review` and `examples` of a rule where the principle reads differently in that stack. A missing override falls back to the common text. Whether an idea has a visible part is asked of the person, so an API-only Laravel platform simply answers no.

### D6. A repository can add rules, never weaken them (proposed)

`.relevo/interface.json` can add rules and examples and uses the same fields. It cannot remove a rule or lower its weight, consistent with how a repository profile only adds to the plugin's. An exception for a project is written in its own rules file, which QA already reads and which already wins over a skill. `doctor` validates the file.

### D7. The design system is declared, or detected and reported, or asked for (proposed)

Optional keys `design.system.tokens`, `design.system.components` and `design.system.references`, each a list of paths inside the repository, validated to exist and to be neither restricted nor protected. When absent, `think` looks by convention (a Tailwind config, CSS custom properties on the root, a theme file of the stack, a components folder, story files), lists what it found and asks the person to confirm. When it finds nothing it asks. Nothing in the plugin names a folder.

Alternatives: only declared (rejected: friction on every project); only detected (rejected: a wrong guess produces a preview with the wrong tokens, silently).

### D8. The interface step in `think` (decided in principle; details proposed)

A reference file `skills/think/references/interface.md`, read when the idea has a visible part. It runs after the exploration and before the interview the person launches. It:

1. Reads the design system (D7) with read-only commands.
2. Takes the questions from `interface-rules.mjs --role think`, adds those of the stack, and asks only what the idea does not already answer, one at a time, as `think` already does.
3. For each open appearance decision shows two or three options as text wireframes with a table of states: loading with data and without, empty, error with data and without, a narrow width and long content. It reuses the components of the design system and does not invent new ones.
4. Records each choice as a numbered decision (`D<n>`) with the reason and the discarded options, and the constraints it implies (`C<n>`), in the list `think` already keeps.
5. For a stack whose interface includes `web`, offers HTML for the finalists (D9).

`think` still writes nothing to the repository and the reserved interview skill is untouched. Its spec gains one narrow exception, in D9.

### D9. Previews are static HTML in a folder outside the repository (decided; details proposed)

After a direct yes that names the folder, `think` writes one file per finalist under the temporary folder of the machine, never inside the repository, and says they are not committed. Each file is self-contained: CSS values copied from the tokens the design system declares, no external request, no script, the states stacked and labelled, realistic worst-case content, and a header comment saying it is a proposal and listing the tokens used. The target is 16 KB or less. The person opens it in a browser and picks one.

### D10. A preview is checked before the person sees it (decided; thresholds proposed)

`preview-check.mjs` opens each file with a headless browser from the project (or from the machine) with scripts and network disabled, at 360 px and at 1024 px, and reports for each item `pass`, `fail` or `not checked`:

- horizontal overflow of the page at each width;
- text contrast against a solid background (4.5:1, and 3:1 for large text), with `not checked` for text over gradients, images or partial transparency;
- interactive targets smaller than the WCAG 2.2 minimum;
- and, when `axe-core` is available in the project, its results.

On a failure `think` fixes the temporary file and checks again, at most twice, and shows the person what it fixed. When no browser automation exists the script says no automatic check ran and exits with its own code, and `think` says the same to the person. It never presents a preview as checked when it was not.

### D11. The chosen option travels in the issue as example code (proposed)

`issue` writes the chosen HTML in a fenced block in `Design reference`, with a bullet that says what must match: structure, tokens and states, not the sample text and not exact pixel values. `go` and QA then work as they already do for example code. Limits in the issue check: fenced example code of that section no longer counts towards the 8,000-character warning; one block warns above 16 KB and fails above 32 KB; all blocks together warn above 32 KB; and a body over GitHub's own limit of 65,536 characters fails with a message that suggests committing the file and pointing to it. The limit of five references stays.

### D12. The developer agent and QA get the relevant rules from `go` (proposed)

After the specification is complete, and after the preflight of change `build-preflight-gates` when it exists, `go` runs the selection on `tasks.md` and `design.md` and gives the output to `relevo:dev` (the `build` face) and `relevo:qa` (the `review` face) with the profile. QA treats a blocking rule as a reason to reject only with evidence, like every other finding, and lists the advisory ones and the rules with `check: person` under "left for on-device review". A reference with example code keeps producing its own scenario.

### D13. Vague appearance words are a warning that becomes a question (proposed)

`knowledge/interface/vague-words.json` has the words for English and Spanish, and English as the fallback. The issue check scans scenario lines, decisions, constraints and reference bullets, ignores a sentence that carries a number with a unit, a token name in backticks or a reference, and prints a warning for each hit with a question template ("which value, which token, which reference?"). `issue` shows the warnings and asks about each before approval. The writer may keep a word on purpose. The check does not fail, because a list of words has false positives and a failure would block a good issue.

### D14. External design skills are documented only (decided)

The guide lists the ones evaluated, with the date they were read, the licence stated, the role each suits and the cost of loading them, and says that none is recommended by default and that `init` installs none. The mechanism to add them already exists: skills per role in `.relevo/stacks/<stack>.md`. The roles written down: the collection the rules come from, on demand, for `think` and `issue` (its search returns a few rows, so it does not load whole); the design skill that builds marketing pages, only for a new page of that kind, with the warning that its optional hook edits a settings file, which is a protected path in an unattended run and has to be installed by a person; and the design skills that give a page its own aesthetic, only for a project that has no design system, because with one they push the developer agent away from its tokens.

### D15. Seeded defects (decided)

`tests/fixtures/interface-defects/<rule-id>/` holds a good and a bad file for each blocking rule that has a code example, taken from the bad examples, plus fixtures for the preview check (a page with failing contrast, one that overflows at 360 px, one that passes). Tests check the data and the preview check. The same fixtures are what the evaluation in change `specialist-review-lenses` uses to compare a review with and without a rule.

### D16. Antigravity (proposed)

The renderer adds `knowledge` to the folders it copies, so the scripts find the data next to them. The scripts are plain Node like the rest, and the interface step of `think` reads the same way in both tools.

## Risks / Trade-offs

- [A rule in the source is wrong or out of date] → verification against WCAG, the `source` field, the date read, and the record of the curation.
- [More rules raise the cost of every turn] → selection by relevance, a budget with a visible count of what was left out, and blocking core rules first.
- [A preview looks better than the build] → real tokens and components, worst-case content, QA compares structure, tokens and states, and the person still confirms on a screen.
- [The preview check gives false comfort] → three states with `not checked` named, and an explicit message when nothing ran.
- [A large block of HTML in the issue slows every turn] → the 16 KB target, the limits in D11 and the option to commit the file and reference it.
- [Vague-word warnings are noisy] → a warning, sentences with a criterion are ignored, the person may keep a word.
- [Per-stack translation lags] → the coverage report makes each gap visible.
- [Licensing] → the `NOTICE` entry and the test that names every source.

## Migration Plan

1. Land the data, scripts and the new tests. Nothing changes for a project until its profile or its issues use the new parts.
2. Land the skill and agent changes, the profile keys and the configuration keys, all optional. An old `relevo.yml` keeps working and detection covers a missing design system.
3. Land the documentation in both languages and the `NOTICE` update.
4. Roll back by removing the interface step and the selection call: no label, lifecycle or stored data changes shape.

## Open Questions

- The exact list of the `core` rules (about twenty), decided while curating with the stack in mind.
- The keywords of the `touches` map in each language.
- The order in which the preview check looks for a browser automation library, and whether it may use one installed on the machine rather than in the project.
- Which stacks ship examples in the first release. The coverage report shows the rest.
- The source collection also ships guideline files for individual stacks (Flutter, Vue, Laravel among them). They were not reviewed when this design was written. They are read while writing the per-stack translations, and what they add is judged by the same criteria as D2.
