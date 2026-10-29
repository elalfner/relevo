# Spec Delta

## ADDED Requirements

### Requirement: Restricted files are not read by an agent
A file on the restricted list SHALL NOT be read by an agent that Relevo runs, in the cloud or in a tree Relevo builds. This is separate from "Protected paths", which is about what a diff may write. The list is the base list plus the entries of `restricted_paths` in `relevo.yml`.

#### Scenario: The agent asks for an environment file
- **WHEN** an agent of a run tries to read `.env`
- **THEN** the read is refused by the file tools of the agent, and the agent is told that the read is blocked

#### Scenario: A restricted file is not in the tree
- **WHEN** an ignored `.env` exists in the working folder of the person and `go` builds in a worktree
- **THEN** the worktree does not contain it, and no script of Relevo copies or links it there

### Requirement: The base list of restricted files
The base list SHALL cover environment files (`.env` and `.env.*`), private keys and certificates, credential files of package managers and of the shell, the service configuration files of mobile apps, and a `secrets/` folder. `.env.example` SHALL NOT be on it, because the skills and the stacks read it for the names of the variables.

#### Scenario: The example file stays readable
- **WHEN** a skill reads `.env.example` for the names of the variables
- **THEN** the read is allowed

#### Scenario: A variant of the environment file
- **WHEN** an agent tries to read `.env.production`
- **THEN** the read is refused

### Requirement: A restricted file in the output of a run fails the run
A restricted file that appears in the diff of an unattended run, or in the text a script of Relevo is about to publish, SHALL end the run in `qa-failed` with the reason "restricted file in the diff", and nothing is pushed. A restricted file that is versioned in the repository SHALL fail in the same way.

#### Scenario: A restricted file in the diff
- **WHEN** the diff of a run adds `config/private.pem`, which is on the list
- **THEN** the run ends in `qa-failed` with the reason "restricted file in the diff", naming the path, and nothing is pushed

#### Scenario: A restricted file that is already versioned
- **WHEN** the base branch contains a versioned `.env`
- **THEN** the run ends in `qa-failed` with the same reason instead of building around it

### Requirement: Scripts of Relevo do not read or publish restricted files
A script of Relevo SHALL NOT open a restricted file, and SHALL NOT put the content of one in a comment, a pull request, a capture or a log. A check that needs to know whether such a file exists SHALL compare path names only.

#### Scenario: A capture of the working folder
- **WHEN** a script collects files to attach to an issue or a pull request and a restricted file is among them
- **THEN** it leaves that file out and says that it did

### Requirement: What is hidden is described by its level
The documentation SHALL describe three levels and SHALL NOT promise a "no such file" answer for the second and the third: the file is not in the tree of the agent (it is not found), the read is denied (the agent learns that something is blocked, and a directory listing still shows the name), and the shell is sandboxed. A `.gitignore` entry or an ignore file such as `.claudeignore` or `.claudecode.json` SHALL NOT be presented as one of these controls.

#### Scenario: Asking about the hidden file
- **WHEN** a person reads what the agent answers when asked about `.env` in a tree where it is not present, and where its read is denied
- **THEN** the page says that the first case answers "no such file" and the second says the read is blocked

## MODIFIED Requirements

### Requirement: The security page says what each agent can and cannot enforce
`docs/security.md` and its Spanish page SHALL state, for each supported agent, which controls hold, which hold only in part and which do not exist, including for Antigravity that the tool has no turn or cost limit of its own (the guard and the project quota are the ceiling), that its exit code hides a refused tool (the guard reads it), that the key is readable by the agent's commands, and that an allow list is not an operating-system boundary.

#### Scenario: Reading the page for Antigravity
- **WHEN** a person reads the security page
- **THEN** the allow list, the deny rules, the reserved skills, the guard limits and the secret store are listed as enforced, the allow list is also listed as partial, and the missing tool-level turn and cost limits are listed as not enforced

#### Scenario: Public repositories
- **WHEN** `trust: public` and `agent.build: antigravity` are both set
- **THEN** validation fails until a later change lifts the restriction

#### Scenario: Reading the page for restricted files
- **WHEN** a person reads the security page
- **THEN** for each agent the read of a restricted file by the file tools and the scripts of Relevo are listed as enforced, a read by a shell command is listed as partial, and the content that already reached a transcript or a log, and a restricted file committed by mistake, are listed as not covered
