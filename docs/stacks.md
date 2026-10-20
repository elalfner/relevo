# Stacks and platforms

English · [Español](stacks.es.md)

Relevo builds more than one kind of project. What changes from one to another (the commands that check the code, the typical bugs, the tools) lives in a **stack profile**, not in the agents. This page explains how to declare your platforms, what a profile holds and how to add your own rules.

## Declare the platforms

Each platform has a name, a stack, the folder where it lives and, for stacks that have them, targets. `relevo.yml` holds them:

```yaml
platforms:
  app:
    stack: flutter
    path: .
    targets: [android, ios, web]
```

- A repository with one platform uses `path: .`. A monorepo has one entry per platform, each with its folder.
- The older line `platform: flutter-android` still works and means one Flutter platform with the Android target. Do not set both.
- For now `go` builds a repository that has exactly one platform. With several, it says so on the issue and does not start; choosing the platform per issue comes later.
- `/relevo:init` asks for all of this and writes it.

## What a stack profile holds

A profile is the file `stacks/<stack>.md` of the plugin. Its header is read by scripts and its text is read by the agents.

- The commands that verify the code: `analyze`, `test` and `format`.
- The generated files that are left out of the diff QA reviews.
- The tools the stack needs, and the tool each target needs (for Flutter: `adb` for Android, `xcrun` for iOS, which runs only on macOS, and nothing for the web).
- The skills it requires and the extra skills for each role.
- A text with the hygiene the developer follows and what QA looks for in the diff.

Relevo ships the `flutter` profile. `/relevo:go` resolves the profile of your platform and hands it to the developer and QA agents.

## Adding your own rules

| Layer | Where | What it is for |
|---|---|---|
| 1 | `CLAUDE.md`, or several files in `qa.rules_from` | The conventions of your project. This is the most common one. |
| 2 | `platforms.<name>.checks` in `relevo.yml` | Another command for a check, for example `fvm flutter test`. |
| 3 | `.relevo/stacks/<stack>.md` | More hygiene, tools or skills for a stack. It adds to the plugin's profile and never replaces it. A stack the plugin does not ship is defined only by this file. |

`/relevo:init` can create a commented file for the third layer. `/relevo:doctor` shows which layers each platform uses.

## Extra skills per role

- A profile can list skills for the roles `dev`, `qa`, `issue` and `review`. `fix` uses those of `dev` and `qa`.
- The agent reads the `SKILL.md` of each one and only the parts that apply. The rules of Relevo and of your project win over any skill.
- A skill is used only if it is on the base branch, if the person has not reserved it for themselves with `disable-model-invocation`, and if it has no scripts. A skill with scripts must be named one by one in `skills.allow_scripts`.
- `/relevo:doctor` lists the skills that were left out and why, warns when the skills of a role are larger than 20 KB, and warns when a skill no longer matches `skills-lock.json`.

## What an unattended run cannot change

- `relevo.yml`, everything under `.relevo/`, the folders of skills and `skills-lock.json`, because they decide the checks the work is held to. A run that touches them ends in `qa-failed`.
- The files you list in `qa.rules_from`.
- The command of a check, from a profile: only `relevo.yml` can replace one.
