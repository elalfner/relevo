# Tasks

## 1. The section and its check

- [x] 1.1 Add `parseDesign` to `scripts/lib/issue-parse.mjs` (D1) and the checks to `scripts/lib/issue-check.mjs` and `scripts/check-issue.mjs` (`--repo-root`, D2), the placeholders in `templates/issue.md` and the section in the template and the known sections of `docs/issue-format.md`. Verify with additions to `tests/issue-check.test.mjs` and `tests/issue-parse.test.mjs`: each scenario of the `issue` delta (an existing file, a missing one, a path that leaves the repository, a repository outside `links`, an attachment on and off the domains, a bullet with no text after the colon, the sixth reference, example code), and earlier issues still passing.

## 2. The setting

- [x] 2.1 Add the `bool` type and `design.images` (default `false`) to `scripts/lib/config.mjs` and `templates/relevo.yml`. Verify with additions to `tests/config.test.mjs` and `tests/template.test.mjs`: the default, `true`, and `sometimes` rejected naming the setting.

## 3. The fetcher

- [x] 3.1 Add `scripts/lib/design-fetch.mjs` (host guard, redirect following by hand, size caps while streaming, type by magic bytes, text detection) with the network and `gh` injected. Verify with `tests/design-fetch.test.mjs`: each scenario of the `go` delta about the limits (another domain, a redirect to another host, a redirect chain longer than five, an image over the cap that is cut while streaming, a file whose name says `.png` and whose bytes are not, an SVG, a text file over 200 KB, the token sent to `github.com` and not to the CDN, the sixth file), and a good download of each image type.
- [x] 3.2 Add `scripts/design-fetch.mjs` (D3: the manifest, `.git/info/exclude`, exit 1 with the reasons, `design.images` off). Verify with a test through the script in a throwaway repository with a local HTTP server standing for GitHub: a path reference, an attachment with `design.images` on and off, a linked-repository file through a fake `gh`, the manifest, the exclusion, the exit codes.

## 4. The skills and the agents

- [x] 4.1 Update `skills/go/SKILL.md` (D5), `agents/dev.md` and `agents/qa.md` (D6, D7), `skills/issue/SKILL.md` (the section, the limit on pictures, what is sent to the model). Verify with additions to `tests/skill-go.test.mjs`, `tests/agents.test.mjs` and `tests/skill-issue.test.mjs`: each sentence of the delta is present, every script and flag named exists and is implemented, the fetch comes before the specification, the scenario per reference is written, and a failed fetch takes the `needs-spec` path.

## 5. Documentation and integration

- [x] 5.1 Update `docs/issue-format.md` and `.es.md`, `docs/configuration.md` and `.es.md` (`design.images`), `docs/security.md` and `.es.md` and `CHANGELOG.md`. Verify with the parity and claims tests.
- [x] 5.2 Run `node --test tests/*.test.mjs` and `openspec validate --all`; both must pass.
- [x] 5.3 Try what can be tried for real: `check-issue` on a draft with references to files of the sandbox, `design-fetch` on references to files of a public linked repository through `gh api`, and, if a person pastes a screenshot into an issue of the sandbox, the download of that attachment with the real token. Record what happened and what could not be tried (a private repository with the token of the workflow; a build that reads the image) in `docs/pilot-findings.md`.
