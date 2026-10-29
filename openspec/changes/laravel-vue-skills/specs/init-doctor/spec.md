# Spec Delta

## ADDED Requirements

### Requirement: Init offers the Laravel Boost skills as optional installs
For a platform of stack `laravel` whose folder has a `composer.json` and no skill of the `laravel` profile committed, `init` SHALL offer two optional installs, run from that folder: `composer require laravel/boost --dev`, then `php artisan boost:install --skills`. It SHALL run each only after a yes to that command alone, SHALL list committing what they write as a manual step, and SHALL NOT run Boost for guidelines or the MCP server nor write the project's rules file.

#### Scenario: Offered
- **WHEN** a Laravel platform with `path: api` has `api/composer.json` without `laravel/boost` and no committed Boost skills
- **THEN** the plan has the two optional installs, shown with the folder `api`, and nothing runs before the person says yes to each

#### Scenario: Commit what Boost wrote
- **WHEN** the plan offers the installs
- **THEN** it lists as a manual step committing `.claude/skills/` of the platform, `composer.json` and `composer.lock`, and says that Laravel suggests keeping generated files out of git and that the cloud runner reads only what is committed

#### Scenario: Declined
- **WHEN** the person declines an install
- **THEN** `init` continues, says the recommendation stays open, and `doctor` keeps the note

#### Scenario: Already installed
- **WHEN** `laravel/boost` is in `composer.json` and the skills are committed
- **THEN** the plan lists the line as done and offers nothing

#### Scenario: No composer file
- **WHEN** the folder of the platform has no `composer.json`
- **THEN** the plan offers nothing for Laravel

### Requirement: Doctor notes when Laravel Boost is missing
For a platform of stack `laravel` whose folder has a `composer.json`, `doctor` SHALL report a note `recommended.laravel.boost` when `laravel/boost` is in neither `require` nor `require-dev`, with the two install commands, and a note when Boost is there and no skill of the `laravel` profile is committed in the folder of the platform or at the root. It SHALL report a pass when both are in place. The note SHALL NOT change the exit status.

#### Scenario: Boost missing
- **WHEN** `composer.json` of the platform does not require `laravel/boost`
- **THEN** `doctor` reports the note with `composer require laravel/boost --dev` and `php artisan boost:install --skills`, and the exit status is untouched

#### Scenario: Boost present and no skills committed
- **WHEN** `laravel/boost` is in `require-dev` and `.claude/skills/` of the platform and the root hold none of the skills the profile lists
- **THEN** `doctor` reports a note to run `php artisan boost:install --skills` and commit the result

#### Scenario: Both in place
- **WHEN** Boost is required and a skill of the profile is committed
- **THEN** `doctor` reports a pass

#### Scenario: Not Laravel
- **WHEN** no platform has stack `laravel`
- **THEN** `doctor` reports no `recommended.laravel` check

### Requirement: Init offers the community Vue skills, labelled as not official
For a platform of stack `vue`, when neither `vue-best-practices` nor `vue-testing-best-practices` is committed, `init` SHALL offer an optional install run from the folder of the platform, `npx skills add vuejs-ai/skills` naming the two skills with `--agent claude-code --copy --yes`. Its text SHALL say that the skills are not official and are an early experiment. `doctor` SHALL report nothing about their absence.

#### Scenario: Offered with the label
- **WHEN** a Vue platform with `path: web` has neither skill committed
- **THEN** the plan has an optional install to run from `web`, whose description says they are not official and an early experiment

#### Scenario: Installed
- **WHEN** both skills are committed
- **THEN** the plan lists the line as done

#### Scenario: Doctor says nothing
- **WHEN** the skills are not installed
- **THEN** `doctor` reports no note and no warning about them

### Requirement: Doctor warns when a skill folder is ignored by git
For every platform, `doctor` SHALL warn when a skill folder that exists, `.claude/skills` or `.agents/skills`, in the folder of the platform or at the root, is ignored by git, naming the folder, because the cloud runner reads only what is committed. It SHALL say nothing when git cannot tell.

#### Scenario: Ignored
- **WHEN** `api/.claude/skills` exists and `.gitignore` excludes it
- **THEN** `doctor` warns that the folder is ignored by git, that the cloud runner will not see it, and to remove the ignore rule and commit the folder

#### Scenario: Tracked
- **WHEN** the folder is not ignored
- **THEN** `doctor` reports nothing about it

#### Scenario: Git cannot tell
- **WHEN** the working copy is not a git repository
- **THEN** `doctor` reports nothing about it
