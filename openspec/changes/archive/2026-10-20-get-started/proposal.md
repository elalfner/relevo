# Proposal

## Why

The documentation explains every piece, but a person who has just heard of Relevo has no single page that takes them from nothing to a merged pull request, the way the "Get started" page of an API does: numbered steps, the exact thing to type, what they should see, and what to do when they do not see it. Facts read in the repository:

- `docs/install.md` has the two install commands and a four-line "First steps" list, then points to other pages. It still says that Flutter is the only stack Relevo ships a profile for, which stopped being true when the Vue and Laravel profiles arrived.
- `docs/how-it-works.md` shows one real run as a table of steps and times, which explains the idea but cannot be followed.
- The cover (`README.md`) goes from the install commands straight to "How it works".
- The guide says what to do when something goes wrong, but assumes the repository is already set up.
- Nothing tells a newcomer which secret to create, what `/relevo:init` will ask, what a built issue looks like, or how long to expect each step to take.

## What Changes

- **A "Get started" page** (`docs/get-started.md`, `docs/get-started.es.md`): the shortest path from nothing to the first merged pull request, for a person working alone on a repository. It has a short "before you start" list, then numbered steps, each with the command to copy, what you should see and what to do if you do not: install the plugin; check the setup; set the repository up; add the model credential; write the first issue; label it and watch it build; review it; ship it. It ends with "What next" (a team, more stacks, running on your machine) and a short table of the problems a newcomer meets, each with its fix.
- **It links forward, not around**: every step names the page that explains it in full (`Configuration`, `Stacks and platforms`, `Where go runs`), so the page stays short.
- **It is the first thing a visitor sees**: the cover and the documentation index link it first, and `install.md` points to it.
- **`install.md` is corrected**: it no longer says Flutter is the only stack.
- **The same tests keep it true**: the page is in the list of pages checked for both languages, every command, script and file it names must exist, and a new test checks that the steps run in the order of the lifecycle and that every step has the command and the expected result.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `documentation`: a Get started page.

## Impact

- Content: `docs/get-started.md` and `.es.md`, `docs/install.md` and `.es.md`, `docs/README.md` and `.es.md`, `README.md` and `README.es.md`, `CHANGELOG.md`.
- Tests: `tests/readme-sync.test.mjs`, `tests/docs-claims.test.mjs`.
- Not changed: behaviour, scripts or skills. The page describes a one-person Flutter or Vue repository on GitHub; teams and the other modes are one link away.
