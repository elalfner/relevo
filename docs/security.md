# Security model

English · [Español](security.es.md)

Relevo lets an AI agent write and run code in your repository, unattended. This page says what it does to keep that safe, and what it does not do. It reduces the risk; it does not remove it, and the human review of the pull request is the last barrier.

## What Relevo protects and how

| Threat | Measure | Enforced by |
|---|---|---|
| The agent pushes to the base or release branch | a ruleset that lets the agent create only `feature/*` branches; `/relevo:init` creates it and `/relevo:doctor` warns when it is missing | the platform |
| The agent or the automation approves or merges | approval and merge are explicit human acts: `/relevo:ship` asks for a written confirmation, and the author cannot approve their own pull request | the platform, and `ship` |
| Text in an issue, comment or log is taken as an instruction | text is treated as data, and the agent has a closed list of tools with no web access (`WebFetch`, `WebSearch`, `curl` and `wget` are refused) | the runner |
| The issue is edited after someone labelled it `ready` | the text that was approved is hashed and `go` refuses to build a different one (`issue-hash.mjs`) | a script |
| A run changes the files that control the workflow | workflows, `relevo.yml`, `.relevo/`, the folders of skills and the project rules file are protected paths; a commit that touches them is refused (`commit-change.mjs`) | a script |
| A run adds a dependency that runs code when installed | dependency files are protected unless the issue lists them in `Allow-paths:`, dependencies are installed without package scripts, and QA rejects a dependency the design does not justify | a script, and QA |
| A pull request changes the skills the agent follows | the extra skills are read from the base branch, never from the branch under work, and a skill with scripts runs only if `skills.allow_scripts` lists it | a script |
| A repository weakens the checks of a stack | a repository profile can add to the plugin's profile but cannot replace a command; only `platforms.<name>.checks` does, in the open | a script |
| A secret or a temporary marker reaches a commit | the diff is scanned before every commit and push (`scan-diff.mjs`) and the commit is aborted on a match | a script |
| A run spends without limit | every run has turn and cost limits (`limits.run_max_turns`, `limits.run_max_cost`), and a run that reaches one stops | the runner |
| Text from a linked repository carries instructions | it is read as data, with a read-only token (`RELEVO_LINKS_TOKEN`) | the runner, and a closed list of repositories |
| A picture in an issue shows customer data to the model, or a download goes somewhere it should not | pasted pictures are downloaded only when `design.images` is on; a script, not the agent, downloads them, from the GitHub attachment domains and linked repositories only, with size and type limits and the token sent only to GitHub; the files stay out of git | a script |
| A driven review reaches a site it should not | the agent's browser is clean and can reach only `localhost`, the page under review and `review.allowed_origins`, and test credentials are passed by variable name and redacted | a script |
| The runner runs a different version of Relevo than the one you read | the workflows install the published package at a pinned version (`RELEVO_VERSION`), published from a tag with provenance, and stop if a script is missing | the runner |

## What it does not protect

- **Prompt injection has no complete defence.** A hidden instruction in a README, a comment or a package can still steer the agent. Relevo shrinks what a steered agent can do (no web, a closed tool list, protected paths, limits), not whether it can be steered.
- **Code the agent writes runs in the runner.** The tests and the build run with the runner's network and permissions. The closed list restricts the agent's tools, not the operating system, so malicious code that the agent was led to write would run there until QA and the review stop it.
- **Local mode runs with your credentials.** `/relevo:go <n> --local` and the review run on your machine, with your tools and your accounts. Read what you are asked to run.
- **Branch protection may be unavailable.** On a private repository of a free GitHub plan the platform refuses the rules above; then approval and merge are enforced only by the written confirmation of `ship`.
- **The review script of a driven review is not a sandbox.** The runner refuses a script that reaches the file system or the process, but that is a tripwire; `qa` reads the script first and you should read one that touches anything sensitive.
- **A person is still the last barrier.** QA and the audit catch what they are written to catch. A pull request that looks right can still be wrong; `review.mode` of `peer` or `roles` puts a second person on it.

## On a public repository

- Set `trust: public`. Only a maintainer's `ready` starts a run, nothing runs on content from forks, and `review.mode` cannot be `none`.
- Read an issue written by a stranger before you apply `ready`: what you read is what is built, and the hash makes sure of it.
- Restrict the outbound network of the runner if your platform allows it; Relevo does not do it for you.
- Keep a secret scanner with push blocking enabled in the repository.

## Secrets

- Secrets live only in the secret store of the repository: `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` for the model, and `RELEVO_LINKS_TOKEN` for the repositories in `links`.
- They never go in `relevo.yml`, in an issue or in a commit, and `/relevo:doctor` shows only whether a secret exists, never its value.
- Workflows do not expose secrets to code that comes from forks.
