# Proposal

## Why

A design reference to a file of a private linked repository (`owner/repo:path`) always sends the issue back to `needs-spec` in the cloud, even when the secret `RELEVO_LINKS_TOKEN` can read that file. The fetcher already uses `GH_LINKS_TOKEN` when it is set, but the agent runs it inside the `build` job, which never gets that token on purpose: the agent can push and reads text Relevo does not control. So the fetch runs with the workflow token, which sees only the current repository, and gets a 404. Two more gaps sit behind it. A file of a linked repository is accepted only as text, so a `.webp` mockup is refused even once it can be read. And an issue that says "follow the process in these files of the other repository" has no way to give the builder those files: `Code pointers` only point inside the repository.

## What Changes

- In the cloud, the design references are fetched by a step of the `build` job before the agent runs, with `GH_LINKS_TOKEN` in that step's environment only. The agent never sees the token, and reads what was fetched from the manifest. A local `/relevo:go` still runs the fetcher itself with the person's own `gh`.
- A file of a linked repository may be a PNG, JPEG, GIF or WebP image up to 5 MB as well as a text file up to 200 KB. It does not depend on `design.images`, which stays about pasted attachments.
- `Code pointers` accept `owner/repo:path` for a repository in `links`. The issue check validates it like a design reference, and the fetcher downloads it with the same limits; the files of both sections together are at most five. A pointer to this repository is not downloaded, as today.
- When the person asks to build on a process that lives in another repository, `issue` reads those files locally with the person's access while the issue is written, records the process in `Decisions` and `Constraints`, and lists only the key files as `Code pointers`.
- A file of a linked repository that cannot be read says why in terms the person can act on: with the token set, that the secret `RELEVO_LINKS_TOKEN` cannot read that repository and needs read access to its contents; in the cloud without it, that a private repository needs that secret; locally, that the person's `gh` login cannot read it. `go` passes the reason to the issue word for word.
- The documentation of `links`, the comments of the workflows, the `init` reminder and the `doctor` fix say that the token needs read access to issues, pull requests and contents.
- A changelog entry under `[Unreleased]`. The version is not bumped here: the release is a separate step. The go workflow changes, so the entry says that a consumer copies it again.

## Capabilities

### New Capabilities

### Modified Capabilities

- `go`: the references of the issue (design references and linked code pointers) are fetched before the agent in the cloud, a linked file may be an image, and the reason a reference was refused reaches the issue unchanged.
- `links`: the read-only credential also reads the contents of linked repositories, for references only.
- `issue`: `Code pointers` accept files of linked repositories, the check counts them with the design references, and `issue` records a process from another repository in the issue instead of leaving the builder to find it.
- `security`: the token for linked repositories is never in the environment of the agent; only the fetch step and the gate use it.
- `init-doctor`: the token that `init` reminds about and `doctor` asks for has read access to contents as well.

## Impact

- `scripts/lib/design-fetch.mjs`, `scripts/design-fetch.mjs`, `scripts/lib/issue-parse.mjs`, `scripts/lib/issue-check.mjs`, `scripts/lib/init.mjs`, `scripts/lib/doctor.mjs`, and their tests.
- `templates/workflows/relevo-go.yml` (a new step in `build`), `templates/workflows/relevo-queue.yml` and `templates/relevo.yml` (comments), `templates/issue.md`.
- `skills/go/SKILL.md`, `skills/issue/SKILL.md`, `agents/dev.md`, `agents/qa.md`.
- `docs/` pages on configuration, the issue format and security, in English and Spanish; `CHANGELOG.md`.
- No new permission for the workflows. Consumers with a private linked repository widen their `RELEVO_LINKS_TOKEN` to Contents: read.
