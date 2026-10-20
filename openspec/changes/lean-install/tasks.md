# Tasks

## 1. Move the plugin folder

- [ ] 1.1 `git mv` `scripts/`, `skills/`, `agents/`, `stacks/`, `templates/` and `.claude-plugin/plugin.json` under `plugin/`; keep `.claude-plugin/marketplace.json` at the root with `source: "./plugin"`
- [ ] 1.2 Rewrite the paths in `package.json`, the tests (`../scripts` to `../plugin/scripts`) and `skills-lock.json` if it records them
- [ ] 1.3 Run `node --test`, `claude plugin validate .` and `openspec validate --all`; fix only path errors

## 2. Workflow templates and guard

- [ ] 2.1 Sparse checkout of `plugin/` in `relevo-go.yml` and `relevo-digest.yml`, and scripts read from `.relevo-plugin/plugin/scripts`
- [ ] 2.2 Add a guard step before the first plugin script that names a missing path, in `decide` and `build`
- [ ] 2.3 Test that the templates list only the plugin folder and that the guard names the paths each job uses

## 3. Nothing outside the plugin folder at run time

- [ ] 3.1 Test that scripts and skills read no file outside `plugin/` (templates, stacks and docs paths included)
- [ ] 3.2 Make `doctor` report an installation without the folders it needs and workflows from the old layout

## 4. Documentation and release notes

- [ ] 4.1 Update `docs/install.md`, `docs/security.md`, `docs/configuration.md` and the Spanish pages: what an installation holds, user and project scope, what the runner downloads
- [ ] 4.2 Changelog entry with the upgrade steps; keep the English and Spanish parity and the claims tests passing
- [ ] 4.3 Record the choice not to ship an npm package or a second marketplace yet, with the reason

## 5. Check on real runs

- [ ] 5.1 Install from the pushed branch at project scope in a clean project and list the cache
- [ ] 5.2 Run a build in the sandbox with the new templates and confirm the model action finds the plugin
