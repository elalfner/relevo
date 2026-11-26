# Tasks

## 1. Usage record

- [x] 1.1 Bring `dev` up to date with `origin/dev` and check the branch; verify `git status -sb` shows it is not behind
- [x] 1.2 Add the usage entry to `docs/pilot-findings.md` from the record in `design.md`, naming no project, organisation, person or runner label; verify by reading the diff and that `node --test tests/readme-sync.test.mjs` passes

## 2. Cover

- [x] 2.1 Create the four timeline images `docs/cover/queue-{en,es}-{black,white}.svg`, one colour each; verify by opening each on a light and on a dark background
- [x] 2.2 Rewrite `README.md` in the order and with the copy of `design.md`, keeping the documentation list, acknowledgements and license; verify `node --test tests/cli.test.mjs tests/notice.test.mjs` passes
- [x] 2.3 Rewrite `README.es.md` with the same structure; verify the structure tests of `tests/readme-sync.test.mjs` pass after 2.4
- [x] 2.4 Make the state-picture check of `tests/readme-sync.test.mjs` read only Markdown table rows; verify it passes and still fails when two rows of the command table are swapped
- [x] 2.5 Add `tests/cover.test.mjs` for the scenarios of the spec delta about the cover (install before the first `##`, no "early development" or "desarrollo temprano", no Antigravity, link to the pilot findings, the code-to-provider answer, a dark source for every picture); verify `node --test` passes

## 3. Package descriptions and notes

- [x] 3.1 Set the description in `package.json`, `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, and check it in `tests/cover.test.mjs`; verify `node --test` and `claude plugin validate .` pass
- [x] 3.2 Add the entry under Unreleased in `CHANGELOG.md`; verify the version stays unchanged

## 4. Integration

- [x] 4.1 Run `npm test` and `openspec validate --all`; verify both pass
- [ ] 4.2 View both READMEs rendered on GitHub from the pushed branch, in light and dark and at phone width, and have the person approve the look; verify their approval is given

## Workflow follow-up

- Promote `dev` to `main` and release, so that GitHub's front page and npm show the new cover.
- Set the description and topics of the GitHub repository (done by the person, or after their yes).
- Record the demo in the sandbox and add it below the install commands.
