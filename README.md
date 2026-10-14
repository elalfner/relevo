# Relevo

**An automatic issue-to-merge workflow where an agent builds and people verify.**

> *Relevo* is Spanish for "relay". Every step of the workflow is a handoff: the agent passes the baton to a person, and that person passes it to a peer.

> **Status: design phase.** Nothing here is installable yet.

## The idea

Writing code is no longer the slow part. Verifying it is. Relevo puts the agent where it is fast (building and self-checking) and puts people where they are irreplaceable (testing on a real device, reviewing a peer's work, deciding to merge).

```
 spec writer        agent (cloud)           assignee              peer
 ready issues ───►  build + QA     ───►  review on device ───►  approve + merge
 in a milestone     no human wait         fix, open PR          then close the loop
```

- **Specs first.** Detailed, spec-ready issues are the input. The agent builds against them and QA checks the diff against them.
- **Pull, not push.** A work-in-progress limit per person keeps the agent from burying the team in unreviewed branches.
- **Humans decide.** Approving and merging are explicit human acts, enforced by branch protection, never by a prompt alone.
- **Every handoff is one message** that says what happened, what is expected of you, and which command to run next.

## Planned commands

Distributed as a Claude Code plugin named `relevo`:

| Command | What it does |
|---|---|
| `/relevo:init` | Sets up config, labels, branch protection and workflows (idempotent, shows a plan first) |
| `/relevo:go` | Builds a ready issue: spec check, build, QA with one retry (runs automatically in the cloud) |
| `/relevo:review` | Guided on-device review: the person drives, the agent captures and audits logs |
| `/relevo:fix` | Fixes review feedback, updating the spec first |
| `/relevo:ship` | Verifies approval, archives the spec, merges, closes the loop |
| `/relevo:status` | Who is waiting on what, plus a daily digest |
| `/relevo:doctor` | Checks that the environment and repo settings are correct |

## Configuration

One `relevo.yml` per repository: branches, reviewers, work-in-progress limits, evidence policy, labels, language.

## License

To be decided.
