# Proposal

## Why

The page on self-hosted runners says to "add runners with the same labels rather than raising the limit", and nothing more. A person who puts two or three runners on one machine learns the rest by trial: the runners share the home of their user, the Docker daemon and the ports of the machine; every Relevo workflow competes for the same runners, so as many builds as `limits.concurrent_agents` can leave no runner for the pull request checks; and two issues labelled at the same moment can both read a free agent slot, because the slot count is made of `building` labels and the `decide` job of one issue does not wait for another's. None of this is in the documentation, in either language.

## What Changes

- The "Self-hosted runners" section of `docs/execution.md` and `docs/execution.es.md` gains a part on several runners on one machine: what stays separate (workspace, `$RUNNER_TEMP`, tool cache, branch), what is shared (home of the runner's user, caches, Docker, ports), what the effective number of parallel builds is, how many runners to register, and which stacks do not parallelise on one machine.
- The same part states the known limit on `limits.concurrent_agents`: it counts `building` labels, so with two or more runners (or on GitHub's runners) two issues labelled together can exceed it by the number of simultaneous gates; with a single runner the gates queue and the limit holds.
- `docs/security.md` and `docs/security.es.md` add one sentence: runners of one user share what the agent can read, so a user or a container per runner is the barrier.
- Out of scope: any change to the workflows, the templates or their version, a concurrency group for the `decide` job (a later change if the limit proves to matter), and any setting.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `documentation`: a new requirement that the page on self-hosted runners says what several runners on one machine keep apart and what they share, and states the limit on concurrent agents.

## Impact

- Docs: `docs/execution.md`, `docs/execution.es.md`, `docs/security.md`, `docs/security.es.md`, and `CHANGELOG.md`.
- Tests: the parity and claims tests already cover these pages (same sections, only names that exist); the new text must pass them. No code and no template changes, so `RELEVO_VERSION` and the template version stay.
- Nothing breaking.
