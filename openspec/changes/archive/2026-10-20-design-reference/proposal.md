# Proposal

## Why

A front-end issue often starts from a picture: a screenshot of the design, or the code of the same screen in another stack (the Flutter panel being rewritten in Vue). Today the issue has a line "is there a reference image? ask for its file name" and nothing else: `check-issue` does not look at the section, `go` does not give the builder the picture, and `qa` and `review` have nothing to compare against, so the result is "something like it". Facts read in the repository:

- `skills/issue/SKILL.md` asks for the file name of a reference image and writes it in `Screens and behaviour` as free text; no script reads it, and a name that does not exist passes the check.
- GitHub has no API to attach an image to an issue: a person pastes it in the web page and GitHub writes a link of the form `https://github.com/user-attachments/assets/<id>` (or, older, `user-images.githubusercontent.com`). The builder does not read the issue: `go` turns it into artifacts, so a link in the text reaches nobody.
- The unattended agent has no web tools, on purpose, so it cannot download an image by itself.
- The agent can read an image with its `Read` tool, and `go` already copies sections of the issue word for word into `design.md`.
- Files outside `relevo.yml`'s `links` cannot be read from other repositories, and the read-only token `RELEVO_LINKS_TOKEN` exists for the ones that can.
- A screenshot can hold real customer data, and the model sees it.

## What Changes

- **A `## Design reference` section in the issue.** Each reference is a bullet with what it points to and what must match: a file of this repository (`design/home.png`), a pasted attachment (the GitHub link), a file of a linked repository (`acme/design:components/Card.vue`), or example code in a fenced block. After the colon, the person says what must match: structure, spacing, typography, colour, states.
- **`check-issue` checks it**: a path of this repository must exist and stay inside the repository, a linked repository must be in `links`, an attachment must be a link on the GitHub domains, every bullet must say what must match, and there are at most five references. Anything else is a problem that names the bullet.
- **A fetcher that does the downloading, not the agent.** `design-fetch.mjs --issue <n>` reads the references from the issue itself (it takes no URL from the agent), downloads attachments and files of linked repositories into `.relevo-design/` (excluded from git locally, never committed) and writes a manifest. It follows redirects only to the GitHub domains, refuses anything over the size and type limits, and never sends the token to a host that is not GitHub. A reference that cannot be fetched is a defect in the specification: the issue goes back to its writer saying which one.
- **`design.images`** (default `false`): pasted attachments are downloaded and shown to the model only when the repository turns it on, because a screenshot may hold customer data. Files already in the repository are always available.
- **The builder gets it.** `go` copies the section into `design.md` ("From the issue: Design reference") and adds one scenario per reference ("Matches the reference <name>"), which becomes a line of the `review` checklist that the person confirms by looking at their screen. `dev` reads the images, reuses the project's theme tokens, invents no assets and reports what it could not match; `qa` checks the code against example code and checks that the code plausibly respects an image.
- **`issue`** writes the section, tells the person that it cannot attach a picture (it must be pasted from the web before `ready`) and what is sent to the model.
- **Documentation**: the format page, the configuration page and the security page say so.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `issue`: the section, its check, and what `issue` says about pictures.
- `go`: fetching, copying, the scenario per reference, `dev` and `qa`.
- `configuration`: `design.images`.
- `security`: the downloads and what the model sees.

## Impact

- Code: `scripts/lib/issue-parse.mjs`, `scripts/lib/issue-check.mjs`, `scripts/check-issue.mjs`, `scripts/lib/design-fetch.mjs`, `scripts/design-fetch.mjs`, `scripts/lib/config.mjs`, `templates/relevo.yml`, `templates/issue.md`.
- Content: `skills/issue/SKILL.md`, `skills/go/SKILL.md`, `agents/dev.md`, `agents/qa.md`, `docs/issue-format.md` and `.es.md`, `docs/configuration.md` and `.es.md`, `docs/security.md` and `.es.md`, `CHANGELOG.md`.
- Not tried by the end of this change unless a person pastes a screenshot into an issue of the sandbox: the download of a real attachment, in particular from a private repository with the token of the workflow. Files of the repository and files of a public linked repository can be tried for real.
