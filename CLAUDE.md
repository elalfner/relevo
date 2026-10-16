# Relevo

## Commits and pull requests

- Never add attribution to commit messages or pull request descriptions: no `Co-Authored-By` trailer, no `Claude-Session` trailer, no claude.ai session link, no "Generated with Claude Code" line.
- This applies to every session, including cloud and Remote Control ones. `.claude/settings.json` turns the attribution off; this rule is the backstop.

## Branches

- Work on `dev`: push to it and create branches from it freely.
- `main` is the release branch. It only receives a pull request from `dev`, merged with a merge commit once the CI passes. Never push to `main`; the repository's rulesets refuse it.
- A release is tagged `vX.Y.Z` on `main` after the promotion. The version in `.claude-plugin/plugin.json` and the entry in `CHANGELOG.md` are updated on `dev` first.
- Before every commit, check the branch with `git branch --show-current`.
