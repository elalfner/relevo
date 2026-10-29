# Design

## Context

See proposal.md for why. The current state:

- `scripts/design-fetch.mjs` reads the issue, parses `Design reference` with `parseDesign`, and calls `fetchReferences` from `scripts/lib/design-fetch.mjs`. For `owner/repo:path` it runs `gh api repos/<repo>/contents/<path>` with `GH_TOKEN` replaced by `GH_LINKS_TOKEN` when that is set, the same pattern as `realGhLinks` in `scripts/lib/github.mjs`.
- The `go` skill runs that script itself (`skills/go/SKILL.md`, "Design reference"), so in the cloud it runs inside the `build` job. `tests/workflow-go.test.mjs` asserts that the `build` job never maps `RELEVO_LINKS_TOKEN` or `GH_LINKS_TOKEN`: only the `decide` job and the queue have it. The script therefore runs with `github.token`, which cannot read another private repository.
- `fetchRepoFile` decodes the base64 `content` of the contents API and accepts only UTF-8 text up to 200 KB. The contents API returns no `content` for a file over 1 MB.
- `Code pointers` is a free section copied word for word into `design.md`. Nothing parses it.
- When a linked file cannot be read, the reason is `<repo> could not be read: <first line of the gh error>`. The agent rewrites it in the language of the repository, which is how "could not be read with the automation" reached the issue.

## Goals / Non-Goals

**Goals:**
- In the cloud, a linked file is read with `RELEVO_LINKS_TOKEN`, and the agent never has that token in its environment.
- A linked file may be an image, within the existing limits of the fetcher.
- A builder can be given the key files of a linked repository through `Code pointers`.
- The reason for a refused linked file names what to fix.

**Non-Goals:**
- Cloning or browsing a linked repository. The builder gets at most five named files.
- Reading a linked file at the gate (`decide` job). A broken reference is still found after the issue is claimed, as today.
- Checking from `doctor` that the token can read contents. `doctor` never reads the secret's value.
- Changing the queue: it reads only the issues that `Depends-on` names.

## Decisions

**D1. The cloud fetches the references in a step before the agent.** A new step in the `build` job, after "Check the toolchain" (which unpacks the package into `$RUNNER_TEMP/relevo`) and before the agent step, runs `$RUNNER_TEMP/relevo/scripts/design-fetch.mjs --issue "$ISSUE" --repo "$GITHUB_REPOSITORY"`. Only that step's `env` has `GH_LINKS_TOKEN: ${{ secrets.RELEVO_LINKS_TOKEN }}`. It writes `.relevo-design/manifest.json` in the workspace, which is already kept out of git by `.git/info/exclude`. Exit 1 (some reference refused) does not fail the step: the refused references are in the manifest. Exit 2 (the issue could not be read, bad configuration) fails the step, and the existing "Report a run that ended without an outcome" covers it. The step then writes `RELEVO_REFERENCES=<manifest path>` to `$GITHUB_ENV`.

The `go` skill reads the manifest when `RELEVO_REFERENCES` is set and runs the script itself only when it is not set (a local run). A manifest with refused references takes the `needs-spec` path as it does today.

Alternatives:
- Map `GH_LINKS_TOKEN` in the `build` job. Rejected: the agent can push and reads text Relevo does not control, so a prompt injection could leak a token that reads private repositories. The test that forbids it stays, narrowed to the agent step.
- Fetch in the `decide` job and hand the files over as an artifact. Rejected for now: a refused reference would reach `needs-spec` before the claim, but it adds artifact upload and download and puts downloads in a job that so far only reads labels and comments. The step in `build` can move there later without changing the specs.

The fetch step reads the issue before the agent checks `issue_hash`. If the text was edited after `ready`, the agent stops on the hash anyway, and what was fetched is never used.

**D2. A linked file is read as metadata first, then raw bytes.** The first call reads the contents metadata (`type`, `size`). If the entry is not a file or is over 5 MB, it is refused without downloading. Otherwise a second call asks for the raw bytes (`Accept: application/vnd.github.raw`), collected as a `Buffer` rather than a UTF-8 string so an image is not corrupted. The bytes decide what the file is: an image if `sniffImage` recognizes it (limit 5 MB), otherwise text if `isText` accepts it (limit 200 KB), otherwise refused as neither. The name and extension are never trusted, the same as for attachments. A linked image does not depend on `design.images`: it is a file someone committed to a repository chosen in `links`, like a `path` reference to this repository.

**D3. Linked `Code pointers` are references without a scenario.** `issue-parse.mjs` gets a parser for `Code pointers` that returns only the bullets whose backticked target matches `owner/repo:path`; other bullets stay free text, as today. The issue check applies the rules for design references to them: the repository must be in `links`, and the path must stay inside the repository. The fifth-reference limit applies to design references and linked pointers together. The fetcher downloads them with `section: "code-pointer"` in the manifest entry, and design references get `section: "design"`. The `go` skill adds the "Matches the reference" scenario only for `design` entries. `dev` and `qa` treat a linked pointer the way they treat a local one: a hint to read before trusting it, from its manifest path. The script keeps its name (`design-fetch.mjs`) and its folder (`.relevo-design/`) to avoid churn in the workflows people have already copied.

**D4. `issue` turns a process from another repository into the issue.** When the person says to build on how something works in a linked repository, `issue` reads those files locally with the person's `gh`. It treats them as data. It writes what the process does into `Decisions` and `Constraints`, and lists only the files the builder must see as `owner/repo:path` in `Code pointers`. A repository outside `links` is not read; `issue` says to add it to `links` first.

**D5. The reason for a refused linked file depends on the token.** `fetchRepoFile` receives `{ linksToken: boolean, cloud: boolean }` (`cloud` from `GITHUB_ACTIONS === 'true'`). On a 404 or 403:
- With the token: `the RELEVO_LINKS_TOKEN secret cannot read <repo> (GitHub answered <code>): give it read access to the contents of <repo>`.
- In the cloud without it: `<repo> could not be read without a token (GitHub answered <code>): if it is private, store a token with read access to its contents as the secret RELEVO_LINKS_TOKEN`.
- Locally: `your gh login cannot read <repo> (GitHub answered <code>)`.

Any other error keeps the first line of GitHub's message. The `go` skill copies each reason into `missing` word for word and does not translate it, because the secret and the repository are names the person searches for.

**D6. One wording for the token everywhere.** The workflow comments, `templates/relevo.yml`, the `init` reminder, the `doctor` fix and the docs all say: a fine-grained token with read access to issues, pull requests and contents of the linked repositories, used only to read. The workflow comments also name the new fetch step as a place where the token is used.

## Risks / Trade-offs

- [Existing consumers have a token without contents access] → the reason in D5 names the secret and the missing access, and the changelog says to widen it.
- [`gh api` with the raw media type writes binary to stdout] → the client is run without an encoding and returns a `Buffer`. The tests cover a WebP and a PNG through the raw path.
- [The workspace holds `.relevo-design/` before the agent starts, and the agent expects a clean tree] → the folder is excluded through `.git/info/exclude`, so `git status` stays clean. This is the same state as when the agent ran the script itself.
- [Copied workflows older than this change keep running the script from the agent, without the token] → that is today's behaviour: nothing breaks, and private linked files still fail with the new message for the case without a token. The changelog says to copy the go workflow again.
- [More text from another repository reaches the model through linked pointers] → the closed list in `links`, the five-file limit, the size limits, and the existing rule that text from a linked repository is data.
