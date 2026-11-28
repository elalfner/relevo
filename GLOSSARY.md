# Relevo

The workflow that takes a GitHub issue from an idea to a merged pull request, where an agent builds and people verify. This glossary fixes the words for the states an issue passes through and for the decisions people make about it.

## Language

**Draft**:
An open issue with no lifecycle label: an idea filed so that it is not forgotten, free to change, which nothing builds.
_Avoid_: vague issue, reminder, backlog item

**Approval**:
The decision of a person with the required permission that the text of an issue is complete and is what should be built, expressed by the `ready` label.
_Avoid_: ready to build, trigger, sign-off

**Build request**:
The decision that an approved issue should be built in the cloud now, expressed by the `go` label and consumed when the cloud decides about the issue.
_Avoid_: trigger, start label, launch

**Cloud build**:
A build that the workflow runs on a runner, with the credential and the limits of the repository, in answer to a build request.
_Avoid_: remote build, Actions run, automatic build

**Local build**:
A build that a person starts with the `go` command on their own machine, with their own credential, for an approved issue and with no build request.
_Avoid_: manual build, machine build, terminal run

**Build job**:
The job of the cloud that installs the tools of the project and runs the agents to build one issue.
_Avoid_: agent job, heavy job, go job

**Light job**:
Any other job of the Relevo workflows: it decides, moves labels, reports or waits, and builds nothing.
_Avoid_: small job, quick job, helper job

**Build runner**:
A runner that takes build jobs; how many of them a machine has is how many cloud builds it runs at once.
_Avoid_: agent runner, build machine, heavy runner

**Failed build**:
A build that ended without a hand-off, whatever the reason: QA rejected the work, a limit stopped it, or it could not start or finish.
_Avoid_: QA failure, rejected build, broken build

**Group**:
The tasks of one section of a change that the developer agent builds in a single launch.
_Avoid_: batch, chunk, stage

**Checkpoint**:
The commit that keeps the work of a group, so that a run that is cut loses at most the group in progress.
_Avoid_: save point, partial commit, snapshot

**Resume**:
To continue a build that stopped before it finished, from its branch, building only the tasks that are still open.
_Avoid_: retry, fix, restart

**Retry**:
To build again from the beginning an issue whose failed build left no branch.
_Avoid_: resume, continue, fix

**Fix**:
To correct the work that QA rejected, starting from its finding.
_Avoid_: resume, finish the build, retry

**Hand-off**:
The point where Relevo stops and a specific person must act. It names who acts and what to do, and the command when there is one.
_Avoid_: pause, handover

**Wait**:
The point where nobody has to act yet, and it says why.
_Avoid_: idle, stopped

**Next step**:
What the single table says for a state: who acts and what to do.
_Avoid_: follow-up, what follows

**Closed**:
An issue that was delivered, with every Relevo label removed.
_Avoid_: done, finished

**System noise**:
An error in the app's log that Apple wrote: the audit counts it, but it is not a finding.
_Avoid_: warning, ignored error
