# Design

## Context

`.github/workflows/release.yml` checks that the tag is the version of `package.json`, runs the tests and runs `npm publish --provenance --access public` with `NODE_AUTH_TOKEN` from the secret `NPM_TOKEN`, after a guard that fails when the secret is empty. It runs on Node 22 with `registry-url` set, and asks for `id-token: write`. npm's documentation says the CLI detects an OIDC environment and uses it before falling back to a token, that the trusted publisher is added in the package's settings on npmjs.com (GitHub Actions, owner, repository, workflow file, optional environment), and that the workflow needs the `id-token: write` permission. A secondary source gives npm 11.5.1 as the minimum, which is not in npm's own page; the Node 22 that the runner ships has an older npm.

## Goals / Non-Goals

**Goals:**
- No long-lived publish credential in the repository.
- A failure to log in says why.

**Non-Goals:**
- Changing provenance, the tests or the order of the release.
- Supporting both the token and the identity at once.

## Decisions

- **Node 24 in the workflow.** It ships an npm that supports Trusted Publishing, so no `npm install -g npm@latest` step is needed; if the runner image still resolves an older npm, the step that prints `npm --version` before the publish makes that visible, and the publish step fails with npm's message. Alternative: keep Node 22 and upgrade npm in the job (one more moving part, and the version floor is only documented by a secondary source).
- **No `NODE_AUTH_TOKEN`.** The publish step sets no token, so the CLI uses the identity of the run. Keeping the token as a fallback would keep the secret alive and would hide a misconfigured trusted publisher.
- **`registry-url` stays.** It is what points `npm publish` at the registry; the `.npmrc` it writes holds a placeholder that is not a secret.
- **A version line before the publish.** `node --version` and `npm --version` go to the log, so a failed publish can be read against the version.
- **The setting on npmjs.com is the person's.** Relevo cannot do it and never holds a credential; `RELEASING.md` lists the exact fields and says what a mismatch looks like (a 404 on publish).
- **Re-running is enough after a fix.** The tag workflow is re-run from the Actions tab once the setting is right; no new tag, because nothing was published.

## Risks / Trade-offs

- The first release with it is the one that proves it; a mistake in the setting costs a failed run, not a bad publish. The person can fall back to the token only by restoring the secret and the previous workflow, which is in the history.
- npm's minimum version is not confirmed by npm's own page; Node 24 is chosen to be above it, and the log line shows the version.
- A trusted publisher is bound to the workflow file name; renaming `release.yml` breaks it, and `RELEASING.md` says so.
