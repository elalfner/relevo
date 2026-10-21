## ADDED Requirements

### Requirement: Generated agent files are protected paths
The folders and files that carry the instructions or the permissions of an agent, `.agents/` as a whole, `.gemini/`, `GEMINI.md` and `AGENTS.md`, SHALL be protected paths that a commit of a run refuses.

#### Scenario: A run edits its own skills
- **WHEN** a commit of a run stages `.agents/skills/relevo-go/SKILL.md`
- **THEN** `commit-change` refuses it and names the path

### Requirement: The security page says what each agent can and cannot enforce
`docs/security.md` and its Spanish page SHALL state, for each supported agent, which controls hold, which hold only in part and which do not exist, including for Antigravity that the tool has no turn or cost limit of its own (the guard and the project quota are the ceiling), that skills reserved for a person are a request and not a control, that the key is readable by the agent's commands, and that an allow list is not an operating-system boundary.

#### Scenario: Reading the page for Antigravity
- **WHEN** a person reads the security page
- **THEN** the allow list, the deny rules, the guard limits and the secret store are listed as enforced, the reserved skills and the allow list are listed as partial, and the missing tool-level turn and cost limits are listed as not enforced

#### Scenario: Public repositories
- **WHEN** `trust: public` and `agent.build: antigravity` are both set
- **THEN** validation fails until a later change lifts the restriction
