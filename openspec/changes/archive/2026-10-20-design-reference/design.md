## Context

See `proposal.md`. Constraints that shape the design:

- The agent has no web tools and a closed list of them; a download therefore has to be done by a script the agent runs, with its inputs fixed by the issue.
- `go` runs in the cloud and on a person's machine with the same skill, so the fetch is a step of the skill, not of the workflow.
- The agent reads images with `Read`, which works for files in its working directory; a folder outside the checkout may not be readable, so the downloads go to `.relevo-design/` inside it, excluded in `.git/info/exclude` (a local file that is never committed).
- A commit names its files and refuses paths outside the platform folder, so a downloaded file cannot be committed by accident.
- `GITHUB_TOKEN` of Actions reading an attachment of a private repository is unverified. If it does not work, the files committed to the repository are the way (they are always available).

## Goals / Non-Goals

**Goals:** a picture or an example reaches the builder, QA and the review, with limits a script enforces and a clear failure when something cannot be fetched.

**Non-Goals:** attaching a picture from the tool (GitHub has no API); comparing pixels; video; fonts; using a generative design skill.

## Decisions

**D1. The reference syntax.** In `## Design reference`, each bullet is `- <target>: <what must match>` where `<target>` is one of: a backticked path (`design/home.png`), a link `https://github.com/user-attachments/assets/<id>` (or `https://user-images.githubusercontent.com/...`, `https://private-user-images.githubusercontent.com/...`), a backticked `owner/repo:path`. A fenced code block in the section is example code and needs no bullet. `parseDesign(body)` in `issue-parse.mjs` returns `{ references: [{ kind: 'path'|'attachment'|'repo-file', target, repo?, path?, match, line }], code: n, problems: [...] }`, where `problems` holds malformed bullets (no target, no colon-and-text, an absolute path or `..`).

**D2. The check.** `checkIssueDraft` gets `repoRoot` (default the working directory, option `--repo-root`) and `links`: a `path` reference must exist under `repoRoot`; a `repo-file` reference's repository must be in `links`; an attachment must match the three domains; more than five references is a problem; each `problems` entry is reported. The same function is used by `plan.mjs` for a `ready` issue? No: `plan.mjs` runs in the light `decide` job without a checkout, so the existence check runs only in `check-issue` (when drafting) and again in `design-fetch` (when building), which is where a missing file matters.

**D3. The fetcher.** `design-fetch.mjs --issue <n> [--repo owner/name] [--out .relevo-design] [--config relevo.yml] [--body-file f]`: reads the body (`gh issue view`, or the file in tests), parses the references, and for each:
- `path`: checks it exists; nothing is copied (the agent reads it where it is).
- `attachment`: refused unless `design.images` is `true`; otherwise downloaded with `fetch`, following redirects by hand: the first request goes to `github.com` with `Authorization: Bearer $GH_TOKEN` (the token is only sent to `github.com` or `api.github.com`), the following hops must be on the closed list of hosts and carry no header; at most five hops; the body is read with a 5 MB cap while streaming; the type is decided by the first bytes (PNG, JPEG, GIF, WebP), never by the name or `Content-Type`.
- `repo-file`: the repository must be in `links`; `gh api repos/<repo>/contents/<path>` (with `GH_LINKS_TOKEN` when set); the content is decoded, capped at 200 KB, and kept only if it is UTF-8 text.
It stops at five files, writes the files and `manifest.json` (`{ files: [{ reference, kind, file, bytes, type }], refused: [{ reference, reason }] }`), adds `.relevo-design/` to `.git/info/exclude` and exits 1 when `refused` is not empty, printing each reason. Network access and `gh` are injected so the module is tested without either.

**D4. `design.images` is off by default.** A new `bool` type in `config.mjs`. The privacy risk of a screenshot with customer data is the reason; a repository whose designs are not sensitive turns it on. The default and its reason are in the docs and the security page. `issue` says what is sent when it writes an attachment bullet.

**D5. `go` step.** In step 3, before writing the specification: run `design-fetch.mjs`; if it exits 1, the issue is a spec defect (`needs-spec`, reason `missing`, naming each refused reference); if it exits 0, the manifest tells `dev` and `qa` where each file is. After `design.md` is written, `Design reference` is added to the list copied by `issue-sections.mjs --copy`, and for each reference the specification gets a scenario "Matches the reference <name>" (WHEN the screen is shown, THEN it matches `<target>` in <what must match>), written by `go` from the manifest, so the review checklist and `qa` see them.

**D6. The agents.** `dev` reads each image with `Read`, reuses the theme tokens and shared components it finds in the project, uses no asset (icon, font, picture) that is not in the project or the references, and puts in its report each element it could not match. `qa` compares the code with example code, checks that an image is plausibly respected (structure, states, tokens) and rejects an invented asset, citing the reference.

**D7. Cross-stack.** When the example code is of another stack, `dev` takes the structure, tokens, states and behaviour and writes them with the conventions of the target stack, without translating widget by widget; the mapping decisions go under `Assumptions` in `design.md`.

## Risks / Trade-offs

- The token of the workflow may not read attachments of a private repository; the fetcher reports it as refused and the writer can commit the image to the repository instead. It is the first thing to try with a real attachment.
- A model reading an image can be steered by text inside it; the content stays data under the rules of the agents, and the images are limited in number and size.
- `.git/info/exclude` is local; a clone elsewhere does not have the downloads, which is intended.
