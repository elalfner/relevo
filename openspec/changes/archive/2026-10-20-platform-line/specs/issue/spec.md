## ADDED Requirements

### Requirement: The issue names its platform when the repository has several
When `relevo.yml` has more than one platform, `issue` SHALL put a `Platform: <name>` line in every issue it writes. It SHALL deduce the platform from the paths the idea mentions and ask only when it cannot decide. When the repository has one platform it SHALL leave the line out. An idea that needs two platforms SHALL be split into two issues with `Depends-on:`.

#### Scenario: Path decides
- **WHEN** the idea mentions `apps/web/src/Header.vue` and `web` lives at `apps/web`
- **THEN** the issue says `Platform: web` without asking

#### Scenario: Ambiguous idea
- **WHEN** the idea mentions no path and the repository has two platforms
- **THEN** `issue` asks which platform it is for, once

#### Scenario: Idea for two platforms
- **WHEN** the idea needs a change in `web` and one in `api`
- **THEN** `issue` proposes two issues, each with its `Platform:` line, the front depending on the back

### Requirement: A draft without a needed platform fails the check
The check of an issue SHALL fail a draft that needs the `Platform:` line and lacks it, that names an unknown platform, or that names two. It SHALL pass an issue for a one-platform repository without the line.

#### Scenario: Missing line
- **WHEN** the repository has two platforms and the draft has no `Platform:` line
- **THEN** the check fails and lists the platforms

#### Scenario: Unknown platform
- **WHEN** the draft says `Platform: mobile`
- **THEN** the check fails, names `mobile` and lists the platforms that exist

#### Scenario: One platform
- **WHEN** the repository has one platform and the draft has no line
- **THEN** the check passes
