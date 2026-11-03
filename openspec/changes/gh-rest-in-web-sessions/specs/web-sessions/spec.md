# Spec Delta

## Purpose
How Relevo reaches GitHub from a session of Claude Code on the web, where the GraphQL API is blocked and only the REST API answers, so that a person who works only there can write, read and label issues with the Relevo commands.

## ADDED Requirements

### Requirement: The commands of the person who writes issues work over the REST API in a remote session
In a remote session (`CLAUDE_CODE_REMOTE` set to `true`), `/relevo:issue`, `/relevo:status`, `/relevo:think`, `/relevo:init` and `/relevo:doctor` SHALL read and write GitHub through the REST API only. They SHALL be able to read an issue (its fields and its comments), list and search issues, create an issue with its milestone and assignee, change an issue's title, body and labels, read the name of the repository, and create or update a label, in the repository of the session and in a linked repository named by the command.

#### Scenario: Reading an issue
- **WHEN** a command reads issue 42 in a remote session where GraphQL answers with `HTTP 403`
- **THEN** it gets the number, title, body, state, labels, assignees, milestone and comments of the issue, and no GraphQL request is made

#### Scenario: Looking for similar issues
- **WHEN** `/relevo:issue` searches the open issues of the repository for the words of an idea
- **THEN** it gets the matching issues with their number, title and labels, limited to the number asked

#### Scenario: Creating an issue
- **WHEN** `/relevo:issue` creates an issue with a title, a body, a milestone and an assignee
- **THEN** the issue exists with that milestone and assignee, and the command receives its number and URL

#### Scenario: Changing the labels of an issue
- **WHEN** a command adds one label and removes another from issue 42
- **THEN** the issue ends with the first label and without the second, and its other labels are unchanged

#### Scenario: A linked repository
- **WHEN** a command reads or creates an issue in a repository named with `owner/repo`
- **THEN** it acts on that repository, not on the one of the session

### Requirement: Outside a remote session nothing changes
Outside a remote session the same commands SHALL call the GitHub CLI with the arguments they are given and SHALL return its output unchanged, so that a terminal and the runners of GitHub Actions behave as before.

#### Scenario: A terminal
- **WHEN** `CLAUDE_CODE_REMOTE` is not `true` and a command reads issue 42
- **THEN** the GitHub CLI runs with the same arguments and its output reaches the command as it is

### Requirement: The REST output has the shape the commands already read
The data a command receives in a remote session SHALL have the shape the GitHub CLI gives for the same fields: the state of an issue is `OPEN` or `CLOSED`, labels and assignees are lists of objects with a `name` or a `login`, and the comments are in the order they were written. A field that is asked for and has no value SHALL be present and empty, not missing.

#### Scenario: The state of an issue
- **WHEN** the REST API reports an issue as `open`
- **THEN** the command receives `OPEN`

#### Scenario: A script that decides on the labels
- **WHEN** a script that checks whether an issue can still be edited reads the state and labels of an issue in a remote session
- **THEN** it reaches the same decision it reaches with the output of the GitHub CLI for that issue

### Requirement: A REST failure is reported, never hidden
When a request fails, the command SHALL stop with a non-zero exit code and show the HTTP status and the message of GitHub. It SHALL NOT answer with an empty result as if nothing were found. A subcommand or flag it does not support SHALL stop with a message that names it and says that the call was not made.

#### Scenario: A repository the token cannot see
- **WHEN** GitHub answers `404` to the read of an issue
- **THEN** the command stops with that status and message, and does not report that the issue does not exist unless GitHub said so

#### Scenario: A flag that is not covered
- **WHEN** a command is called with a subcommand or a flag the REST version does not implement
- **THEN** it stops naming that subcommand or flag, and changes nothing on GitHub

### Requirement: GitHub access is judged by reading the repository
In a remote session, `/relevo:status`, `/relevo:init` and `/relevo:doctor` SHALL decide whether the session can reach GitHub by reading the repository over the REST API, and SHALL NOT use the sign-in status of the GitHub CLI for it. When the read fails they SHALL say why (no repository found, no token, the answer of GitHub) and what to do. Outside a remote session they SHALL keep the current check.

#### Scenario: A remote session whose sign-in status fails but whose token works
- **WHEN** the sign-in status of the GitHub CLI reports an invalid token and the REST read of the repository succeeds
- **THEN** the commands continue, and `doctor` reports GitHub access as passed

#### Scenario: A remote session with no usable token
- **WHEN** the REST read of the repository fails with `401`
- **THEN** the commands stop before doing any work and say that the session has no usable GitHub token

### Requirement: The token of the session is used as it is
The commands SHALL use the token the session already has, SHALL NOT ask for a token, look for another one, or sign in, and SHALL NOT print the token in any output.

#### Scenario: A failed request
- **WHEN** a request fails and the command shows the error
- **THEN** the error does not contain the token or the authorization header
