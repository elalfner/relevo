## 1. Verify what the research left open (stop and report if any is false)

- [x] 1.1 Install `agy`, record in `docs/pilot-findings.md` its version, tool names, headless behaviour without a terminal and the `--print-timeout` default
- [x] 1.2 Check skills, `disable-model-invocation`, plugin conversion, namespace and project plugin; record the script-path and agent-tool gaps
- [x] 1.3 Check that a subagent with a command tool runs the stack-like commands under the default policy, how a compound command is matched, and that a subagent's result reaches the run
- [x] 1.4 Run the headless command with `stream-json` and record the events, the per-step usage and how a refused tool shows
- [ ] 1.5 On a scratch repository, run `agy -p` with `modelProvider: gemini` and a dedicated `GEMINI_API_KEY` secret on a GitHub runner; try ADC with `AGY_ADC_AUTH` from a workload identity and record whether either works unattended

## 2. The renderer

- [ ] 2.1 `scripts/lib/adapters/source.mjs`: read the skills and agents (frontmatter, body, references)
- [ ] 2.2 `scripts/lib/adapters/antigravity.mjs`: the plugin folder, the text rewrites (script paths, agent names, "launch the agent"), the agent frontmatter and the Claude-to-Antigravity tool table that fails on an unknown tool
- [ ] 2.3 Neutral wording fixes in `skills/` and `agents/` only where a rewrite would otherwise be fragile
- [ ] 2.4 Tests: every skill and agent renders, no Claude token remains, reserved skills keep their key, QA lists no write tool, the tool table matches the names in the `init` event of the installed `agy`

## 3. The commands

- [ ] 3.1 `relevo init` with `--tools`, `--scope`, `--yes`, reusing `scripts/lib/select.mjs`, installing into `.agents/plugins/relevo/` or through `agy plugin install`, with tests using a fake terminal and a fake `agy`
- [ ] 3.2 The record `.relevo-adapter.json`, `update` rendering again, hand-edit detection and `--force`
- [ ] 3.3 `doctor` checks of the rendered plugin

## 4. Security and configuration

- [ ] 4.1 Add the rendered paths to `scripts/lib/protected-paths.mjs`, with tests
- [ ] 4.2 `agent.build` and `limits.run_max_tokens` in the `relevo.yml` schema and `validate-config`: reject `limits.run_max_cost` and `trust: public` for `antigravity`

## 5. The cloud build

- [ ] 5.1 `scripts/agent-guard.mjs` and its library: child in its own process group, event counting, limits, kill, refused-tool detection, exit codes; tests with a fake process for each scenario
- [ ] 5.1b A test that lists the programs the skills call and fails if one is missing from the allow list of the step
- [ ] 5.2 Mark the model step of `templates/workflows/relevo-go.yml` and write `templates/agents/antigravity-step.yml`: install the pinned package and `agy`, render and install the plugin for the machine, write the user-level settings, run through the guard, job timeout, secret credential, report from the guard's summary; make the workflow writer substitute the block for `agent.build: antigravity`
- [ ] 5.3 A test that the markers exist once and that the Claude and Antigravity renderings differ only inside the block
- [ ] 5.4 Run the workflow on a scratch repository with a trivial issue and record the result, including a run that reaches a limit

## 6. Documentation

- [ ] 6.1 `docs/security.md` and `docs/security.es.md`: the per-agent table with the gaps; update `docs/architecture-direction.md` (research done, decisions taken)
- [ ] 6.2 `docs/install.md`, `docs/execution.md`, README and the Spanish pages: `relevo init`, `agent.build`, the commands in Antigravity; changelog under Unreleased, without raising the version

## 7. Check

- [ ] 7.1 `node --test` passes, `openspec validate antigravity-adapter` passes, and the Claude plugin contents are unchanged (compare `npm pack --dry-run` before and after)
