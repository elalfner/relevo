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
