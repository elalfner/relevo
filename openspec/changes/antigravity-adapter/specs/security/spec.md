## ADDED Requirements

### Requirement: Rendered agent files are protected paths
The folders and files that carry the instructions or the permissions of an agent, `.agents/` as a whole, `.gemini/`, `GEMINI.md` and `AGENTS.md`, SHALL be protected paths that a commit of a run refuses.

#### Scenario: A run edits its own plugin
- **WHEN** a commit of a run stages `.agents/plugins/relevo/skills/go/SKILL.md`
- **THEN** `commit-change` refuses it and names the path

### Requirement: The security page says what each agent can and cannot enforce
`docs/security.md` and its Spanish page SHALL state, for each supported agent, which controls hold, which hold only in part and which do not exist, including for Antigravity that the tool has no turn or cost limit of its own (the guard and the project quota are the ceiling), that its exit code hides a refused tool (the guard reads it), that the key is readable by the agent's commands, and that an allow list is not an operating-system boundary.

#### Scenario: Reading the page for Antigravity
- **WHEN** a person reads the security page
- **THEN** the allow list, the deny rules, the reserved skills, the guard limits and the secret store are listed as enforced, the allow list is also listed as partial, and the missing tool-level turn and cost limits are listed as not enforced

#### Scenario: Public repositories
- **WHEN** `trust: public` and `agent.build: antigravity` are both set
- **THEN** validation fails until a later change lifts the restriction
