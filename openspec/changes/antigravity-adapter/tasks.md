## 1. Verify what the research left open (stop and report if any is false)

- [ ] 1.1 Install `agy` in a scratch folder and record in `docs/pilot-findings.md`: its version, its tool names for `tools:` and `permissions`, and that `agy -p` returns output without a terminal at the pinned version
- [ ] 1.2 Check that a skill in `.agents/skills/relevo-x/SKILL.md` is started by `/relevo-x` with arguments in the IDE and in the CLI, whether an extra frontmatter key can keep the model from choosing it, and which global folder the CLI reads
- [ ] 1.3 Check that a subagent call blocks until the report, that `commandExecutionPolicy` lets the stack's test command run for `dev` and `qa`, and what `toolPermission` and `--sandbox` do headless
- [ ] 1.4 Run the headless command with `stream-json` and record whether turns and tokens arrive as events; record how a refused tool shows on stderr
- [ ] 1.5 On a scratch repository, run `agy -p` with `modelProvider: gemini` and a dedicated `GEMINI_API_KEY` secret on a GitHub runner; try ADC with `AGY_ADC_AUTH` from a workload identity and record whether it works unattended

## 2. The renderer

- [ ] 2.1 `scripts/lib/adapters/source.mjs`: read `skills/` and `agents/` (frontmatter, body, references)
- [ ] 2.2 `scripts/lib/adapters/antigravity.mjs`: skills, subagents, the tool-name table that fails on an unknown name, the text rewrites (`${CLAUDE_PLUGIN_ROOT}`, `$ARGUMENTS`, `relevo:` names, "launch the agent"), and the reserved-skill wording
- [ ] 2.3 Neutral wording fixes in `skills/` and `agents/` only where a rewrite would otherwise be fragile
- [ ] 2.4 Tests: every skill and agent renders, no Claude token remains, QA lists no write tool, reserved skills carry the wording

## 3. The commands

- [ ] 3.1 `relevo run <script>` in `scripts/cli.mjs` and `scripts/lib/cli.mjs`, with tests
- [ ] 3.2 `relevo init` with `--tools`, `--scope`, `--yes`, reusing `scripts/lib/select.mjs`, and tests with a fake terminal
- [ ] 3.3 The manifest, `update` regeneration and removal, hand-edit detection and `--force`
- [ ] 3.4 `doctor` checks of the manifest and of `relevo` on the PATH

## 4. Security and configuration

- [ ] 4.1 Add the generated paths to `scripts/lib/protected-paths.mjs`, with tests
- [ ] 4.2 `agent.build` and `limits.run_max_tokens` in the `relevo.yml` schema and `validate-config`: reject `limits.run_max_cost` and `trust: public` for `antigravity`

## 5. The cloud build

- [ ] 5.1 `scripts/agent-guard.mjs` and its library: child in its own process group, event counting, limits, kill, refused-tool detection, exit codes; tests with a fake process for each scenario
- [ ] 5.2 Mark the model step of `templates/workflows/relevo-go.yml` and write `templates/agents/antigravity-step.yml`: install the pinned package, generate the skills with machine scope, write the user-level settings, run through the guard, job timeout, secret credential, report from the guard's summary; make the workflow writer substitute the block for `agent.build: antigravity`
- [ ] 5.3 A test that the markers exist once and that the Claude and Antigravity renderings differ only inside the block
- [ ] 5.4 Run the template on a scratch repository with a trivial issue and record the result, including a run that reaches a limit

## 6. Documentation

- [ ] 6.1 `docs/security.md` and `docs/security.es.md`: the per-agent table with the gaps; update `docs/architecture-direction.md` (research done, decisions taken)
- [ ] 6.2 `docs/install.md`, `docs/execution.md`, README and the Spanish pages: `relevo init`, `relevo run`, `agent.build`, the command names in Antigravity; changelog under Unreleased, without raising the version

## 7. Check

- [ ] 7.1 `node --test` passes, `openspec validate antigravity-adapter` passes, and the plugin contents are unchanged (compare `npm pack --dry-run` before and after)
