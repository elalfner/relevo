# Tasks

## 1. The comparison

- [x] 1.1 In `docs/commands.md`, under the `go` entry, add the heading "In the session or on its own", the table (who builds, tools, limits, what you see, context, worktree) and the one-sentence rule; replace "does the same in a separate process" so it no longer says they are equal; verify the text matches the Scenarios "Choosing how to build by hand" and "Not described as the same"
- [x] 1.2 Do the same in `docs/commands.es.md` with the heading "En la sesión o por separado"; verify `node --test tests/readme-sync.test.mjs` passes (same number of headings, anchors found)

## 2. The links

- [x] 2.1 In `docs/guide.md` and `docs/guide.es.md`, add to "Cloud, local or both" a bullet saying which way to build by hand with a link to the table; verify the anchor test passes in both languages
- [x] 2.2 In `docs/execution.md` and `docs/execution.es.md`, make "Building on your machine" link to the table in place of the sentence about when to use `--local`; verify no other page still calls the two the same

## 3. Release notes and checks

- [x] 3.1 Add one line under Unreleased in `CHANGELOG.md`; verify it names only files and commands that exist
- [x] 3.2 Run `npm test` and `openspec validate --all` and verify both pass
