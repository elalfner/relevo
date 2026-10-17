# How it works

English · [Español](how-it-works.es.md)

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

## See it work

A real run on the [sandbox](https://github.com/elalfner/relevo-sandbox), a small Flutter app, for [issue #5](https://github.com/elalfner/relevo-sandbox/issues/5), "Show the build number". One person played every role.

| Step | The person | Relevo | Time |
|---|---|---|---|
| 1 | thinks the idea through (the exploration and grilling that `/relevo:think` runs) and approves the issue text | explores the code, asks until every decision is made, and drafts the issue: scenarios, edge cases and the new vocabulary in a `Documentation` section | a conversation |
| 2 | labels the issue `relevo:ready` | the light `decide` job runs the gates and claims the issue | 17 s |
| 3 | nothing | the `build` job writes the specification, the code and the tests, and QA checks them | 3 min 35 s |
| 4 | reads the hand-off and runs `/relevo:review 5` on a phone | captures screens, audits the log, opens the [pull request](https://github.com/elalfner/relevo-sandbox/pull/16) | a few minutes |
| 5 | runs `/relevo:ship 5` and confirms | merges, archives the specification, closes the issue | seconds |

The hand-off the agent left on the issue, shortened:

```
@elalfner #5 "Show the build number" is built ✅

What happened: 11 of 11 tasks done, QA passed.
Branch: feature/5-show-the-build-number
What to test: 8 scenarios (checklist below)
Riskiest area, check it first: The real build number from an APK through the
Android package_info_plus plugin (tests only use the mock), and how the two
texts look on a small physical device.
Your next step: /relevo:review 5
```

The glossary entries that came out of the conversation travelled in the issue and arrived in the same pull request as the feature, so nobody committed documentation by hand. Peer review, reminders and reviewer selection need a second person and were not part of this run.
