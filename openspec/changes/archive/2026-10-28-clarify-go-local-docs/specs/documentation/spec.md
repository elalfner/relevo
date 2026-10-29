## ADDED Requirements

### Requirement: The documentation says how building in the session differs from --local
The commands page SHALL compare the two ways to build an issue by hand, `/relevo:go <n>` in a Claude Code session and `/relevo:go <n> --local`, on who builds, the tools, the limits, what the person sees, whose context it uses and where the worktree is, and SHALL give a rule to choose between them. The guide SHALL say which to use by hand and link to that comparison, and the page about where `go` runs SHALL link to it instead of describing the difference again. Both languages SHALL have the same headings, the same commands and the same links.

#### Scenario: Choosing how to build by hand
- **WHEN** a person reads the `go` entry of the commands page
- **THEN** it shows that the session run is built by their own session with its own tools and no cost or turn limit and that `--local` runs a separate process with the closed tool lists and the limits of `relevo.yml`, and says to use the session to watch and step in and `--local` to leave it running under the same limits as the cloud

#### Scenario: Not described as the same
- **WHEN** a page describes `--local`
- **THEN** it does not say it does the same as the session run, because only the worktree is the same

#### Scenario: The guide points to the comparison
- **WHEN** a person reads "Cloud, local or both" in the guide
- **THEN** a bullet says which way to build by hand and links to the comparison in the commands page, in English and in Spanish
