# Tasks

## 1. Checks before building

- [ ] 1.1 In a sandbox repository, run the Claude build once with `--plugin-dir ${{ runner.temp }}/relevo` in `claude_args` and no `plugin_marketplaces`; verify in the log that the plugin loads from that folder, and record the result and the workflow used in `docs/pilot-findings.md`. If the action does not forward the option, update `design.md` D1 to the fallback (the `#vX.Y.Z` marketplace pinned by tag) and the specs of group 3 before continuing
- [ ] 1.2 Locally, run `claude --plugin-dir <an unpacked @elalfner/relevo package> -p "/relevo:doctor"`; verify the skill resolves under the name `/relevo:` and record it in `docs/pilot-findings.md`
- [ ] 1.3 Run `git merge-file -p` with the real case: the file `relevo-go.yml` of `viali_panel_vue` as "yours", the 0.5.0 template (from `npm pack @elalfner/relevo@0.5.0`) as the base and the 0.8.0 template as "theirs"; verify the result is clean and keeps its credential line, and record the three paths and the outcome in `docs/pilot-findings.md`
- [ ] 1.4 Repeat 1.3 with a line that both sides changed; verify `git merge-file` reports a conflict (non-zero exit) and write the command in `docs/pilot-findings.md`; if either 1.3 or 1.4 does not behave, update `design.md` D2 before continuing

## 2. The version of the text

- [ ] 2.1 Add `# relevo-template: <version>` as the first comment line of the six templates in `templates/workflows/`; verify a new test in `tests/workflow-package.test.mjs` fails when a stamp differs from the version in `package.json`
- [ ] 2.2 Update `RELEASING.md` step 1 to include the stamp and step 5 to give the real reason for publishing first (the templates on `main` pin a version that has to exist); verify the file names the stamp and no longer says the marketplace names a version
- [ ] 2.3 Document the stamp in `docs/install.md` and `docs/install.es.md` where they explain the pin; verify both pages say that the pin and the stamp are different things and the parity test passes

## 3. The cloud agent loads the pinned package

- [ ] 3.1 In `templates/workflows/relevo-go.yml`, replace `plugin_marketplaces` and `plugins` with the plugin directory in `claude_args` (D1), keeping the turn, cost and tool limits; verify `tests/workflow-go.test.mjs` finds no `plugin_marketplaces`, no `plugins:`, no `RELEVO_PLUGIN_TOKEN` and the new argument, and that the Antigravity block is unchanged
- [ ] 3.2 Make the unpack step stop with the missing path when `.claude-plugin/plugin.json` is not in the package, next to the checks it already makes; verify the scenario "The package has no manifest" in the workflow tests
- [ ] 3.3 Make `automation.plugin-secret` and `automation.plugin-clone` in `scripts/lib/doctor.mjs` apply only when a workflow on the default branch still names a marketplace; verify the five scenarios of "Doctor checks the plugin credential secret" in `tests/doctor.test.mjs`
- [ ] 3.4 Update `docs/action-parameters.md` (English only), `docs/execution.md` and `docs/execution.es.md` (what the build installs, the private plugin repository and the token), `docs/security.md` and `docs/security.es.md` (the plugin comes from the pinned package) and `skills/init/SKILL.md`; verify the pages no longer tell the person to store `RELEVO_PLUGIN_TOKEN` for a new project and the docs tests pass

## 4. Init updates a workflow

- [ ] 4.1 Write the merge in a new module under `scripts/lib/`: choose the base among the published templates by fewest differing lines (fetched with `npm pack` into a temporary folder), render the current template with `runner.labels` and `agent.build`, run `git merge-file -p`, set the pin and the stamp, and check the structure of the result; verify unit tests with fixtures for a clean merge (the `viali_panel_vue` case from 1.3), a conflict, a pin raised by hand, no close base and a file that is already current
- [ ] 4.2 Add the item to `planInit` and `applyPlan` in `scripts/lib/init.mjs`: a workflow that differs becomes "can be updated from A to B" with its difference when the merge is clean, and stays `differs` with the conflicting lines otherwise; verify `tests/init.test.mjs` covers the scenarios of the three requirements and that nothing outside `.github/workflows/` is written
- [ ] 4.3 Add `--from <version>` to `scripts/init.mjs` and `relevo init`; verify a test where the base cannot be chosen and `--from 0.5.0` makes the merge possible
- [ ] 4.4 Update `skills/init/SKILL.md` (the rule that a workflow that differs is only reported becomes: reported, unless the merge is clean and the person agrees), and `docs/commands.md` and `docs/commands.es.md` for `/relevo:init`; verify the skill test and the parity test pass

## 5. Doctor reports the versions

- [ ] 5.1 Read `claude plugin list --json` through the injected `tool` in `gatherFacts`, keep the user scope and the project scope of this repository, and add the versions block; verify `tests/doctor.test.mjs` for the scenarios "The scopes differ" and "Claude cannot list plugins"
- [ ] 5.2 Compare the pins of the workflows on the default branch with the plugin in use, and read the stamp of each; verify the scenarios "Workflows behind the plugin", "Text older than the pin", "A workflow with no stamp" and "Text and pin agree"
- [ ] 5.3 Document the versions block in `docs/commands.md` and `docs/commands.es.md`; verify the example shows the lagging scope and the command that fixes it

## 6. The upgrade page and release notes

- [ ] 6.1 Write `docs/upgrading.md` and `docs/upgrading.es.md` with the three things that carry a version, the order of D6, how to read the versions in `doctor`, and how `init` updates a workflow; verify both have the same sections in the same order
- [ ] 6.2 Add `upgrading` to the list of pages in `tests/docs-claims.test.mjs` and link it from `docs/install.md`, `docs/install.es.md`, `README.md` and `README.es.md`; verify the parity, links and README sync tests pass
- [ ] 6.3 Add an entry to `CHANGELOG.md` that says the cloud agent now loads the plugin from the pinned package, that `init` can update a workflow, what `doctor` reports and that a project that does nothing keeps working; verify `tests/changelog.test.mjs` passes
- [ ] 6.4 Run the whole test suite and `openspec validate upgrade-path --strict`; verify both pass

## Workflow follow-up

- Update `viali_panel_vue` with the new `init`, as the first real use, and check that `/relevo:doctor` there reports consistent versions.
- Archive the change after review and sync its specs into `openspec/specs/`.
