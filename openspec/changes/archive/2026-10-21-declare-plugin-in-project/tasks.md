# Tasks

## 1. The fact

- [x] 1.1 `gatherFacts`: read `.claude/settings.json` into `pluginDeclared` (`declared`, `unreadable`); no probe call when the file is absent
- [x] 1.2 Tests of the fact: declared, missing file, no plugin, plugin disabled, invalid JSON

## 2. Doctor

- [x] 2.1 A check `plugin.declared`: pass when declared, warn with the fix when not, nothing when the fact is absent; the fix names the commands and `/relevo:init`
- [x] 2.2 Tests: the three outcomes, and that the healthy fixture stays green

## 3. Init

- [x] 3.1 A plan item `install.plugin-project`: ok when declared, an install with the exact command when not, a manual line when the file is unreadable; `applyPlan` never runs it
- [x] 3.2 `skills/init/SKILL.md`: the installs step names the line and says the settings file is left to commit; test the text
- [x] 3.3 Tests of the item and of the plan rendering

## 4. Documentation

- [x] 4.1 The commands pages (`init` and `doctor`, both languages) and Get started step 3 mention it; changelog under Unreleased

## 5. Check

- [x] 5.1 Run the plan and the doctor on a fresh clone where the plugin is installed for the machine only, and again after the commands
