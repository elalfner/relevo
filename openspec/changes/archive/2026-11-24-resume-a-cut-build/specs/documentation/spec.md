## ADDED Requirements

### Requirement: The documentation tells resume, retry and fix apart
The pages that describe `go`, the commands and the failure comments, in English and in Spanish, SHALL present `--resume`, `--retry` and `fix` as three different things, say what each does with the branch, and say how a person starts over when a branch exists. `GLOSSARY.md` SHALL define the three terms and the words to avoid.

#### Scenario: A person reads the commands page
- **WHEN** a person looks for what to run after a build stopped at a limit
- **THEN** the page names `--resume`, says that it keeps the branch, and says that `--retry` is for a build with no branch

#### Scenario: Both languages
- **WHEN** one language has the section on resume
- **THEN** the other has it too, and the structure test fails when one lacks it

#### Scenario: The glossary
- **WHEN** `GLOSSARY.md` is read
- **THEN** it defines resume, retry and fix, each with the words to avoid, and holds no implementation detail
