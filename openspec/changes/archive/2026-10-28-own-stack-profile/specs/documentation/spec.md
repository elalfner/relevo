# Spec Delta

## ADDED Requirements

### Requirement: The stacks page explains how to define your own stack
The stacks page, in both languages, SHALL have a section on a stack that the plugin does not ship. It SHALL name the file `.relevo/stacks/<stack>.md`, give a worked example for Go with the header (commands, tools, generated files) and a short body, say that the file must be committed, say that the build in the cloud needs a step of `relevo-go.yml` guarded by the name of the stack, and say that `doctor` warns about each of these. It SHALL NOT say that the plugin ships a profile for that stack.

#### Scenario: The section on your own stack
- **WHEN** the stacks page is read
- **THEN** it explains the file, shows a Go profile with `analyze`, `test` and `format`, names the cloud step and says to commit the file

#### Scenario: Both languages agree
- **WHEN** the English and the Spanish stacks pages are compared
- **THEN** both have the section, the same example and the same commands
