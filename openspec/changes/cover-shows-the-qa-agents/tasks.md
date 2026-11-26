# Tasks

## 1. Cover

- [x] 1.1 Add the section of the agreed copy to `README.md` and `README.es.md` between the figures and the queue; verify `node --test tests/readme-sync.test.mjs tests/docs-claims.test.mjs` passes
- [x] 1.2 Remove "No agent grades its own work" and shorten the middle handoff card in both; verify by reading the diff that three reasons remain
- [x] 1.3 Add to `tests/cover.test.mjs` the scenarios of the spec delta, counting `agents/qa-*.md` against the cards of the pictures; verify it passes and fails when a card is removed
- [x] 1.4 Add the `CHANGELOG.md` entry under Unreleased; verify the version stays unchanged

## 2. Integration

- [x] 2.1 Run `npm test` and `openspec validate --all`; verify both pass
- [ ] 2.2 Push a branch and have the person approve the rendered section on GitHub; verify their approval is given
