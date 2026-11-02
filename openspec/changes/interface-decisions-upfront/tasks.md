# Tasks

## 1. The rules and their record

- [x] 1.1 Create `knowledge/interface/rules.json` with the fields of the `interface-knowledge` spec and write the accessibility rules (source numbers 28, 36 to 45, 100, 103, 104, 107, 108, 109, 112, 117, 118) in Relevo's own words, with weight, check, tags and a question, a "build it like this" line and a "check this" line for each, and good and bad examples tagged by stack where the source has them. Verify with the data test of task 1.6 for these rules.
- [x] 1.2 Write the layout and content rules (15 to 17, 19, 20, 65 to 71, 84, 111, 113 to 116) and the forms, interaction and feedback rules (55 to 61, 63, 11, 30 to 35, 78 to 82). Verify with the data test.
- [x] 1.3 Write the motion, typography, performance, navigation, content, touch, search and media rules (8, 9, 12, 13, 119, 72 to 75, 46 to 48, 51, 2 to 5, 85 to 87, 22 to 24, 89, 90, 96). Merge the guidelines that the design says are merged into another (10, 18, 21, 50, 54, 76, 83, 99) and do not write a rule for the ones that were left out. Verify with the data test, which must count 84 adopted source numbers and no duplicate.
- [x] 1.4 Mark the `core` rules, at most twenty, chosen from the blocking ones that matter to every screen of a stack with an interface (names, contrast, focus, loading, error and empty states, overflow at a narrow width, touch targets). Record in `CURATION.md` why each is core. Verify with the data test (no more than twenty, all blocking).
- [x] 1.5 Write `knowledge/interface/CURATION.md`: for every one of the 119 source numbers, adopted, merged into which rule, or left out with the reason, using the groups of the design. Verify with the data test that every source number from 1 to 119 appears exactly once.
- [x] 1.6 Add `tests/interface-knowledge.test.mjs` for the spec: every field present, unique identifiers, valid weight, check and platform values, a blocking rule has a check and an example for at least one stack, an enhanced-criterion rule is advisory, and every `source` is named in `NOTICE`. Run it and fix the data until it passes.
- [x] 1.7 Update `NOTICE`: name the source collection as a third licensed work with its copyright line and where it is used, correct the sentence that says the plugin does not include the files of the works it uses, and keep the licence text. Verify with `tests/notice.test.mjs` and the check of task 1.6.
- [ ] 1.8 Check every rule that cites an accessibility criterion against the W3C text of the standard, correct or remove the ones that do not hold, mark enhanced criteria as advisory, and record the date of the check in the header of `rules.json`. Verify by listing each cited criterion with the passage it was checked against in `CURATION.md`.

## 2. Selecting rules for an agent

- [x] 2.1 Add `scripts/lib/interface-rules.mjs` and `scripts/interface-rules.mjs`: select by role, stack and the text of a change, always keep the core rules, add the rules whose tags match, print the face the role needs, give only the examples of the stack or neutral ones, keep within the budget for `dev` and `qa` (advisory first, then examples of non-core rules, never a blocking core rule) and print how many were left out. Verify with `tests/interface-rules.test.mjs` for each scenario of the spec: a form change, a web-only stack, a mobile stack with a web target, over the budget, an example for another stack.
- [x] 2.2 Add the keyword map that turns the words of a change into tags, in English and Spanish, and test it with sample issues and task lists in both languages.
- [x] 2.3 Add `--coverage`: list the blocking rules that have no example for a stack. Verify with a test that prints the report as a warning and does not fail on it.
- [x] 2.4 Write the translations `knowledge/interface/stacks/flutter.json`, `vue.json` and `laravel.json` for the rules that read differently in each stack (accessible names, stable space for content that loads, text scale, targets, keyboard, focus), with examples in the language of the stack. Read the guideline files of the source for those stacks first and judge what they add by the criteria of the design. Verify with the coverage report: no blocking core rule may lack an example for Flutter or Vue.
- [x] 2.5 Add the loader of `.relevo/interface.json`: add rules and examples with the same fields, never remove or lower a rule of the plugin, and report an attempt. Verify with tests for an added rule, a repeated identifier with a lower weight, and a file with a missing field.

## 3. Profiles and configuration

- [x] 3.1 `scripts/lib/stack-profile.mjs` and the profiles in `stacks/`: the `interface` key (`mobile` for Flutter, `web` for Vue and Laravel, `none` for Supabase), a repository stack declaring its own, no key meaning none, and the rules for `web` added for a `mobile` platform with the target `web`. Verify with the profile tests and `tests/interface-rules.test.mjs`.
- [x] 3.2 `scripts/lib/config.mjs` and `scripts/validate-config.mjs`: the keys `design.system.tokens`, `design.system.components` and `design.system.references`, each a list of paths that must exist inside the repository and be neither restricted nor protected; a file without them is valid. Verify with `tests/config.test.mjs` for each scenario of the `configuration` spec.
- [x] 3.3 `templates/relevo.yml`: the three keys commented out with one line each. Verify with the test that validates the shipped `relevo.yml` and a test that `init` writes them.
- [x] 3.4 `scripts/doctor.mjs`: validate `.relevo/interface.json`, check the paths of `design.system`, and note, without failing, when a platform with an interface has no browser automation available. Verify with `tests/doctor.test.mjs` and `tests/skill-init-doctor.test.mjs` for each scenario of the `init-doctor` spec.
- [x] 3.5 `docs/configuration.md` and `docs/configuration.es.md`: the three keys. `docs/stacks.md` and `docs/stacks.es.md`: the `interface` key and how a stack of the repository declares it. Verify with `node --test tests/docs-claims.test.mjs`.

## 4. Reading the design tokens

- [ ] 4.1 Add `scripts/lib/design-tokens.mjs` and `scripts/design-tokens.mjs`: read only the declared or confirmed paths, execute nothing, use no network, skip restricted files and say so, print the tokens with name, value, theme, file and line as machine-readable output and as text, list what is unresolved, list several themes without merging them, and give identical output for identical input. Verify with `tests/design-tokens.test.mjs` for the scenarios of the spec that are not about an extractor.
- [ ] 4.2 The Dart extractor: colour literals, constants followed to their definition, a colour scheme with explicit parameters, the shades of the standard palette from a fixed table, an opacity on a known colour (marked as derived), classes that extend the theme, text styles, spacing and radii, and a dark theme as a second set; a scheme derived from a seed, a colour from the device or a server and an unfollowed reference are unresolved. Verify with sample theme files for each construct and for each unresolved case.
- [ ] 4.3 The web extractor: custom properties on the root and in a dark-mode block, a property that refers to another, and the colour and spacing scales of the configuration of the styling tool. Verify with sample files for each case.
- [ ] 4.4 Make `scripts/design-tokens.mjs` find the declared paths from `relevo.yml` and the detected ones by convention, and print the detected list for the person to confirm. Verify with a test of a repository with declared paths and one with none.
- [ ] 4.5 `docs/stacks.md` and `docs/stacks.es.md`: what is read, what is never guessed and how to declare the paths. Verify with `node --test tests/docs-claims.test.mjs`.

## 5. Checking a preview

- [ ] 5.1 Add `scripts/lib/preview-check.mjs` and `scripts/preview-check.mjs`: the static checks (an address outside the file, a script, a size over the target), the lookup of a browser automation library in the project and then on the machine, scripts and network disabled, the items overflow, contrast and target size with the statuses `pass`, `fail`, `not checked` and `approximate`, and an exit code of its own when no library exists. Verify with `tests/preview-check.test.mjs` and fixtures: a page that passes, one with low contrast, one that overflows at 360 px, one with a small target, text over an image, a script, an external address.
- [ ] 5.2 The thresholds by kind: `web` at 360 and 1024 px with the WCAG 2.2 minimum target, `mobile` at 320 and 360 px with 48 dp (44 pt for an iOS target) and a second pass with text at 130% and 200%. Verify with fixtures: a 40 dp button in a mobile sketch fails, a layout that breaks only at 200% fails that pass.
- [ ] 5.3 Use the tokens in the contrast check and mark a value that came from an approximation as `approximate`. Verify with a fixture whose colour was derived by opacity.
- [ ] 5.4 Prove that the check writes nothing into the repository and sends nothing out of the machine. Verify with a test that runs it in a repository and compares the tree before and after, and with the disabled network.

## 6. The interface step of `think`

- [ ] 6.1 Write `skills/think/references/interface.md`, part one: when the step runs and when it is skipped, reading the design system from declared or confirmed paths, asking only the open questions from `interface-rules.mjs --role think` and the stack, and showing two or three wireframes with the table of states for each open decision, without inventing a component. Verify with `tests/skill-think.test.mjs` (the reference exists and names each of these).
- [ ] 6.2 The same reference, part two: recording the decision with its reason and discarded options and its constraints in the list of the agreement, offering previews for the finalists only for a stack with an interface, showing the table of tokens first and asking for the main colours when it is incomplete, asking the yes that names a folder outside the repository, writing the previews, running the check, fixing and rechecking at most twice, saying when a check did not run, and the mobile sketch with its label and its header comment. Verify with `tests/skill-think.test.mjs`.
- [ ] 6.3 `skills/think/SKILL.md`: say where the step goes (after the exploration, before the interview), keep the reserved interview and the hand-off as they are, add the exception to the rule that `think` writes no file (the previews, after a yes, outside the repository) and keep every other `Never`. Verify with `tests/skill-think.test.mjs`, including that the list handed to the reserved interview holds the decisions of the step.
- [ ] 6.4 `docs/commands.md` and `docs/commands.es.md`: the interface step, the previews and their check, with an example of a conversation. `docs/guide.md` and `docs/guide.es.md`: how to read the result of the check. Verify with `node --test tests/docs-claims.test.mjs`.

## 7. `issue`, `go` and QA

- [ ] 7.1 `scripts/lib/issue-parse.mjs` and `scripts/lib/issue-check.mjs`: leave the example code of `Design reference` out of the count for the 8,000-character warning; warn above 16 KB for one block and above 32 KB for all of them, fail one block above 32 KB, and fail a body larger than GitHub accepts with the message that suggests committing the file. Verify with `tests/issue-parse.test.mjs` and the check tests for each scenario of the `issue` spec.
- [ ] 7.2 Add `knowledge/interface/vague-words.json` with the words for English and Spanish, and the warning in the check: ignore a sentence with a number with a unit, a token name in backticks or a reference, and never fail. Verify with tests in both languages and with the fallback to English for another language.
- [ ] 7.3 `skills/issue/SKILL.md`: ask the interface questions that the agreement does not answer, write the chosen option as example code with the bullet that says what must match (web and mobile), allow a picture committed to the repository instead, show each vague-word warning and ask about it, and let the person keep a word. Verify with `tests/skill-issue.test.mjs`.
- [ ] 7.4 `skills/go/SKILL.md`, `agents/dev.md` and `agents/qa.md`: after the specification select the rules and give the `build` lines to the developer agent and the `review` lines to QA with the count left out; QA rejects on a blocking rule only with evidence, lists advisory and person-checked rules under "left for on-device review", and treats a mobile sketch like an image reference. Verify with `tests/skill-go.test.mjs` and `tests/agents.test.mjs`.
- [ ] 7.5 `docs/issue-format.md` and `docs/issue-format.es.md`: the limits for example code, the vague-word warning and an example of a chosen preview in `Design reference`. Verify with `node --test tests/docs-claims.test.mjs`.

## 8. Packaging and the other tools

- [ ] 8.1 `package.json`: add `knowledge` to `files`. Verify with `tests/package.test.mjs`: the package holds the knowledge folder and no fixture of the tests, and no script reads a file that the package lacks.
- [ ] 8.2 `scripts/lib/adapters/antigravity.mjs`: copy `knowledge` with the scripts, stacks and templates. Verify with `tests/adapter-antigravity.test.mjs`: the rendered plugin has the folder and a script of it finds the knowledge next to the scripts.

## 9. Seeded defects

- [ ] 9.1 Create `tests/fixtures/interface-defects/<rule-id>/` with a bad and a good file for each blocking rule that has a code example, taken from its examples, and a recorded reason for a blocking rule with none. Verify with a test that fails when a blocking rule with a code example has neither a fixture nor a reason.
- [ ] 9.2 Check that the fixtures are not part of the package and are not read at run time. Verify with the package test of task 8.1.

## 10. The documentation of the external design skills

- [ ] 10.1 Add the list of the design skills that were evaluated to `docs/stacks.md` and `docs/stacks.es.md`: the date each was read, the licence it states, the role it suits (the collection the rules come from, on demand, for `think` and `issue`; the skill that builds marketing pages, only for a new page of that kind; the skills that give a page its own aesthetic, only for a project with no design system), the cost of loading it, the warning about a hook that edits a settings file, and that none is recommended by default and `init` installs none. Verify with `node --test tests/docs-claims.test.mjs` and a test that `init` installs none of them.

## 11. Integration checks

- [ ] 11.1 Run `npm test` and `openspec validate --all`, the two steps of the CI, and confirm both pass.
- [ ] 11.2 Run the interface step on a throwaway web project and on a throwaway project with a Dart theme written with explicit colours: the tokens table must show the values with their file and line, the previews must be written outside the repository after a yes, and the check must report each item. Repeat on a Dart theme built from a seed colour and confirm it is reported as unresolved and the person is asked for the main colours.
- [ ] 11.3 Take an issue with a vague appearance word and an interface rule broken in its diff, and confirm that `issue` asks about the word and that QA rejects the diff with the file, the line and the rule.
- [ ] 11.4 Search every file of this change and the new documentation and fixtures for the name of any real project, organisation or customer that was used as an example during the exploration, and confirm that none appears.

## Workflow follow-up

- The evaluation of the rules on the seeded defects, with and without a rule, is done by the harness of the change `specialist-review-lenses`; run it on these fixtures once it exists and record the result.
- At release time, raise the version in `.claude-plugin/plugin.json` and `package.json` and add the entry to `CHANGELOG.md` on `dev` first, as `CLAUDE.md` says, then promote `dev` to `main` and tag.
- Archive the change on `dev` with `/opsx:archive` once merged; the new capabilities `interface-knowledge`, `design-tokens` and `interface-preview` are created and the main specs `think`, `issue`, `go`, `platforms`, `configuration`, `agent-adapters`, `plugin-distribution`, `init-doctor` and `documentation` receive the added and modified requirements.
