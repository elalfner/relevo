# Security model

English · [Español](security.es.md)

Relevo lets an AI agent write and run code in your repository, unattended. This page says what it does to keep that safe, and what it does not do. It reduces the risk; it does not remove it, and the human review of the pull request is the last barrier.

## What Relevo protects and how

| Threat | Measure | Enforced by |
|---|---|---|
| The agent pushes to the base or release branch | a ruleset that lets the agent create only `feature/*` branches; `/relevo:init` creates it and `/relevo:doctor` warns when it is missing | the platform |
| The agent or the automation approves or merges | approval and merge are explicit human acts: `/relevo:ship` asks for a written confirmation, the ship workflow merges only when a person applied `relevo:ship` (a label from a bot ships nothing), and the author cannot approve their own pull request | the platform, and `ship` |
| A pull request makes its author eligible to ship it | the ship workflow reads `relevo.yml` from the base branch and its scripts from the published package, and runs nothing from the branch (git runs without hooks) | the runner, and a script |
| Text in an issue, comment or log is taken as an instruction | text is treated as data, and the agent has a closed list of tools with no web access (`WebFetch`, `WebSearch`, `curl` and `wget` are refused) | the runner |
| Someone without the right skips the review capacity of the team | `relevo:urgent` counts only when the person who applied it could mark the issue `ready` (maintainer when `trust` is `public`); any other label is removed with a comment, and it never skips the specification, the dependencies or `limits.concurrent_agents` | a script |
| The issue is edited after someone labelled it `ready` | the text that was approved is hashed and `go` refuses to build a different one (`issue-hash.mjs`) | a script |
| A run changes the files that control the workflow | workflows, `relevo.yml`, `.relevo/`, the folders of skills and the project rules file are protected paths; a commit that touches them is refused (`commit-change.mjs`) | a script |
| An agent or a script reads a file that holds a secret, or publishes it | a list of restricted files (environment files, private keys, credential files, mobile service configuration, `secrets/` and `restricted_paths` of `relevo.yml`) that the agents are told not to read, that a worktree never holds, and that no script of Relevo opens or publishes; one in a diff, or versioned, ends the run in `qa-failed` with the reason "restricted file in the diff" ([Restricted files](#restricted-files)) | the runner, and a script |
| A run adds a dependency that runs code when installed | dependency files are protected unless the issue lists them in `Allow-paths:`, dependencies are installed without package scripts, and QA rejects a dependency the design does not justify | a script, and QA |
| A pull request changes the skills the agent follows | the extra skills are read from the base branch, never from the branch under work, and a skill with scripts runs only if `skills.allow_scripts` lists it | a script |
| A repository weakens the checks of a stack | a repository profile can add to the plugin's profile but cannot replace a command; only `platforms.<name>.checks` does, in the open | a script |
| A secret or a temporary marker reaches a commit | the diff is scanned before every commit and push (`scan-diff.mjs`) and the commit is aborted on a match | a script |
| A run spends without limit | every run has turn and cost limits (`limits.run_max_turns`, `limits.run_max_cost`), and a run that reaches one stops | the runner |
| Text from a linked repository carries instructions | it is read as data, with a read-only token (`RELEVO_LINKS_TOKEN`: issues, pull requests and contents) that the agent never holds: only the gate, the queue and the step that fetches the references before the agent get it | the runner, and a closed list of repositories |
| A picture in an issue shows customer data to the model, or a download goes somewhere it should not | pasted pictures are downloaded only when `design.images` is on; a script, not the agent, downloads them, from the GitHub attachment domains and linked repositories only, in a step before the agent in the cloud, with size and type limits and the token sent only to GitHub; the files stay out of git | a script |
| A driven review reaches a site it should not | the agent's browser is clean and can reach only `localhost`, the page under review and `review.allowed_origins`, and test credentials are passed by variable name and redacted | a script |
| A driven review shows a screenshot to the model, writes files, or runs without the person's say | the review script takes screenshots only through `capture(name, check)`, which saves them and gives nothing back; it cannot screenshot itself, pass a file path to the browser or print to the agent; the runner starts only with the person's confirmation of the data, before the agreement, and with the exact script `qa` passed | a script, and QA |
| A driven review breaks the person's dev server | extra servers are started and stopped only by `extra-server.mjs`, which never touches a server it did not start, and the review does not switch branches under a server that runs from the working tree | a script |
| The runner runs a different version of Relevo than the one you read | the workflows install the published package at a pinned version (`RELEVO_VERSION`), published from a tag with provenance, and stop if a script is missing; the cloud agent loads its plugin from that same package (`--plugin-dir`), not from a marketplace that would give it the latest version | the runner |
| A job leaves tools, settings or files on a runner that keeps them between jobs | each job installs its tools under its own temporary folder at a pinned version, the Antigravity run uses a home folder of the job, and a last step removes what the job added to the workspace; `/relevo:doctor` states that a self-hosted runner is assumed to persist | the workflow; whether the machine is a sandbox is the runner's |

## What it does not protect

- **Prompt injection has no complete defence.** A hidden instruction in a README, a comment or a package can still steer the agent. Relevo shrinks what a steered agent can do (no web, a closed tool list, protected paths, limits), not whether it can be steered.
- **Code the agent writes runs in the runner.** The tests and the build run with the runner's network and permissions. The closed list restricts the agent's tools, not the operating system, so malicious code that the agent was led to write would run there until QA and the review stop it.
- **A self-hosted runner is not a sandbox.** Relevo assumes it keeps its files between jobs, cleans what its own steps add, and cannot tell whether the machine is ephemeral. The agent's code runs with the permissions of the runner's user and the network of the machine, which on your own hardware can reach internal services and the credentials of other jobs. An ephemeral runner (created for one job) or a container is the real barrier; keep the repository private, and do not share the runner with projects you do not control. Runners registered under one user of the machine share what the agent of any of them can read, including the workspaces of the others, so give each runner its own user or a container ([Several runners on one machine](execution.md#several-runners-on-one-machine)). `runner.labels` in `relevo.yml` only chooses where the workflows run ([Where `go` runs](execution.md#self-hosted-runners)).
- **Local mode runs with your credentials.** `/relevo:go <n> --local` and the review run on your machine, with your tools and your accounts. Read what you are asked to run.
- **Branch protection may be unavailable.** On a private repository of a free GitHub plan the platform refuses the rules above; then approval and merge are enforced only by the written confirmation of `ship`.
- **The review script of a driven review is not a sandbox.** The runner refuses a script that reaches the file system or the process, but that is a tripwire; `qa` reads the script first and you should read one that touches anything sensitive.
- **A person is still the last barrier.** QA and the audit catch what they are written to catch. A pull request that looks right can still be wrong; `review.mode` of `peer` or `roles` puts a second person on it.

## Which agent builds

`agent.build` in `relevo.yml` chooses the agent of the cloud build: `claude` (the default) or `antigravity`. Everything in the first table that a script or the platform enforces is the same for both. What belongs to the agent's own runner is not, and this table says how it differs. "Partial" means the control exists but is weaker than it sounds.

| Control | Claude Code | Antigravity CLI |
|---|---|---|
| Closed tool list, no web | enforced by the runner | **partial**: `permissions.allow` and `permissions.deny` in a user-level settings file that the workflow writes outside the repository, so a pull request cannot loosen them. It is a list of command prefixes: `node` can run any script, as Bash can for Claude |
| Turn limit | enforced by the runner | enforced by Relevo's run guard, which reads the event stream and stops the agent; the tool has no limit of its own |
| Cost limit | enforced by the runner (a real ceiling with an API key) | **does not exist.** `limits.run_max_tokens` (enforced by the guard) and the quota and budget of the Google Cloud project that owns the key are the ceiling; a budget alert is not a cap, so use a key made only for Relevo in its own project with a quota |
| Skills that only a person may start | `disable-model-invocation` | the same key is honoured (seen on CLI 1.4.4) |
| Credential | `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` | `GEMINI_API_KEY` |
| The agent itself | the action at `@v1` | the binary, pinned by version and sha512 in the workflow |
| `trust: public` | allowed | refused until a later change lifts it |

What the table does not say, for Antigravity:

- **The key is readable by the agent's commands.** `GEMINI_API_KEY` is an environment variable of the run, so the agent can read it. A key limited to the Gemini API, in a project with a quota, makes that harmless in the worst case.
- **A refused tool does not fail the tool.** Antigravity exits 0 when a tool is refused. The guard reads the refusal from the event stream and fails the run, and says which tool.
- **The guard counts what the tool reports.** A turn is a model response, of the main agent or of a subagent. Tokens are input plus output as the tool reports them; tokens read from the cache are not counted, so the limit is more lenient than the work the model did.
- **A prefix list is not an operating-system boundary.** The closed list restricts which commands the agent may start, not what an allowed command does. This is the same limit as the one above for Claude.
- **Not tried:** that the quality of the adversarial QA holds with a Gemini model; a full cloud run on a real runner (see the known limits in the changelog); whether the CLI can update itself during a run.

## Restricted files

Some files should be read by no agent and by no script of Relevo: environment files, private keys, credential stores. The list is the base list below plus `restricted_paths` in `relevo.yml`, which only adds (a profile cannot weaken it, and `relevo.yml` cannot take an entry away). It is separate from the protected paths, which are about what a diff may write.

**The base list.** `.env` and `.env.*` at any depth, except the example files `.env.example`, `.env.sample`, `.env.template` and `.env.dist` (the skills and the stacks read them for the names of the variables); private keys and certificates (`*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.p8`, `*.ppk`, `*.keystore`, `*.jks`, `id_rsa`, `id_dsa`, `id_ecdsa`, `id_ed25519`); credential files of package managers and of the shell (`.npmrc`, `.netrc`, `.pypirc`, `.git-credentials`, `.pgpass`, `.htpasswd`); the service configuration of mobile apps (`google-services.json`, `GoogleService-Info.plist`, `key.properties`); and a `secrets/` folder at the root and at the root of each platform. The match is by path name, and a name you did not expect (`key.json`) is not on it: add it to `restricted_paths`.

**What the tool denials cover of `.env.*`.** The rules of Claude Code cannot say "except `.env.example`", so the denials of the cloud workflow and of `/relevo:init` list the common variants (`.env.local`, `.env.development`, `.env.production`, `.env.staging`, `.env.test`, `.env.testing`, `.env.dev`, `.env.prod`, `.env.qa`, `.env.ci`, `.env.preview` and `.env.*.local`), not every `.env.*`. A variant outside that list (`.env.docker`, `.env.backup`, `.env.old`, `.env.stage`) is restricted for Relevo's own scripts and is not in the worktree, but no agent tool denies it: add such names to `restricted_paths`, which does write a denial for each entry. The four example files are the only exempt names.

**A versioned mobile configuration file fails every run.** A repository that deliberately versions `google-services.json` or `GoogleService-Info.plist` (some teams do, because the values are not secret) has a restricted file versioned, so `go` stops with the reason "restricted file in the diff" and `/relevo:doctor` fails. The list has no exception for them: untrack the file and keep it out of git, or accept that runs stop.

**The check is by name.** The path is resolved against the working folder before it is compared, so `a/./b`, `a//b` and `a/../a/b` are the same name, but a symbolic link to a restricted file is not followed: a link with an ordinary name is not recognised.

### Three levels of hiding

| Level | What the agent sees | Where it holds |
|---|---|---|
| **Not in the tree** | "no such file": the file is not there | the tree Relevo builds. `go` builds in a git worktree, which holds only versioned files, and no script copies or links a restricted file into it (a `.worktreeinclude` file is a feature of Claude Code that does, and Relevo's worktree does not process it). A restricted file that is versioned is a failure, not something to hide: `go` stops on it and `/relevo:doctor` fails |
| **Read denied** | the read is blocked and the agent is told so; a directory listing still shows the name | the settings of the agent, below |
| **Shell sandboxed** | the process that opens the file is refused by the operating system | Claude Code, where a person enables its sandbox (the cloud workflow does not); not Antigravity |

The first level is the only one that answers "no such file". At the second and the third the agent learns that something is blocked.

### What each agent enforces

| | Claude Code | Antigravity CLI |
|---|---|---|
| The file tools of the agent | **enforced**: `Read(...)` rules in `permissions.deny`, written by `/relevo:init` between the `# relevo:restricted begin` and `# relevo:restricted end` lines of the cloud workflow, in the `settings` input of the action, which the action merges into the user-level settings of the runner, outside the repository | **enforced** for the exact paths listed: one `read_file(...)` rule for each restricted file that exists in the tree, written outside the repository when the run starts. The tool documents no globs, and a bare name matches only at the root, so a file created after the run starts is not covered |
| The scripts of Relevo | **enforced**: they refuse to open or publish a restricted file, and the safe commit refuses one in the diff | **enforced**, the same |
| A file command in a shell (`cat .env`) | **enforced** for the commands Claude Code recognizes (`cat`, `head`, `tail`, `sed`, redirections), by the `Read` rules | **not covered**: the denial does not reach a command (tried), and the commands in the allow list can read the file |
| A process that opens the file itself (a script, `node -e`) | **not covered in the cloud**: the workflow writes `sandbox.filesystem.denyRead` but does not enable the sandbox, because it has not been shown that the build still fetches, comments, labels and pushes with it on. Where a person enables the sandbox of Claude Code (a local run), the denial refuses the process | **not covered** |
| A command that reads without naming the file (`grep -r`) | **partial**: no `Read` rule covers it by name; in the cloud it is not covered, and where a person enables the sandbox the denial does | **not covered** |
| The content that already reached a transcript or a log | **not covered** | **not covered** |
| A restricted file committed by mistake | **not covered**: it is in the history. `go` and `/relevo:doctor` report it, and the secret must be rotated | **not covered**, the same |

On a person's machine Relevo proposes and checks, and never enforces: `/relevo:init` shows the entries and writes them to your settings only after a yes to that item, and `/relevo:doctor` warns, by path name and without opening any file, for each restricted file that exists in the working folder and that no denial covers.

**No ignore file is a control.** A `.gitignore` entry keeps a file out of git, not out of an agent's reach; `.claudeignore` has no effect according to the documentation of Claude Code, and `.claudecode.json` is not documented as a control. Relevo writes only settings that the documentation of the tool lists as denying a read, and offers none of these files as protection.

## On a public repository

- Set `trust: public`. Only a maintainer's `ready` starts a run, nothing runs on content from forks, and `review.mode` cannot be `none`.
- Read an issue written by a stranger before you apply `ready`: what you read is what is built, and the hash makes sure of it.
- Restrict the outbound network of the runner if your platform allows it; Relevo does not do it for you.
- Keep a secret scanner with push blocking enabled in the repository.

## Secrets

- Secrets live only in the secret store of the repository: `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` (or `GEMINI_API_KEY` with `agent.build: antigravity`) for the model, `RELEVO_LINKS_TOKEN` for the repositories in `links`, and `RELEVO_SHIP_APP_ID` and `RELEVO_SHIP_APP_KEY` for the GitHub App of the ship workflow, when the base branch requires checks.
- They never go in `relevo.yml`, in an issue or in a commit, and `/relevo:doctor` shows only whether a secret exists, never its value.
- Workflows do not expose secrets to code that comes from forks.
