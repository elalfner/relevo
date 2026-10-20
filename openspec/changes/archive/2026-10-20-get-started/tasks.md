# Tasks

## 1. The tests first

- [x] 1.1 Add `get-started` to `PAGES` in `tests/readme-sync.test.mjs` and add tests to `tests/docs-claims.test.mjs`: the page has the sections of D2 in order, every numbered step has a command block, a "You should see" item and an "If not" item, the commands appear in the order of the lifecycle (`doctor`, `init`, `issue`, `review`, `ship`), the example issue passes `check-issue`, the two secrets are named, and the quoted fragments of output exist in the code or in a test. Verify: the tests fail now, naming the missing page.

## 2. The page

- [x] 2.1 Write `docs/get-started.md` and `docs/get-started.es.md` (D1 to D5). Verify with the parity and claims tests and by running the commands of the page that can run here (`doctor`, `check-issue` on the example, `stack-profile`) against the sandbox.
- [x] 2.2 Link it first from `README.md`, `README.es.md`, `docs/README.md` and `docs/README.es.md`, correct `docs/install.md` and `docs/install.es.md` (D6) and update `CHANGELOG.md`. Verify with the parity test (the index links every page) and the changelog test.

## 3. Integration

- [x] 3.1 Run `node --test tests/*.test.mjs` and `openspec validate --all`; both must pass.
- [x] 3.2 Read the page as a newcomer would, against a fresh clone of the sandbox: follow it as written as far as a cloud session allows and record in `docs/pilot-findings.md` every place where the page and the behaviour differed and what was corrected, and what could not be followed (the secret, the build, the device).
