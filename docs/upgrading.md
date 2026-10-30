# Upgrading

English · [Español](upgrading.es.md)

A project that stays on an old version of Relevo can move up without breaking. Three things carry a version and each is moved in a different place, so the order matters.

## What carries a version

| What | Where its version lives | How it moves |
|---|---|---|
| The plugin on each machine: the commands and skills you type | the installation of Claude Code, per scope (user, project or local) | each person, with `claude plugin update` |
| The workflows of the repository | `RELEVO_VERSION` (the scripts they run) and `# relevo-template:` on the first line (the version of their text) | `/relevo:init`, through a pull request |
| The plugin that the cloud agent loads | the same package the workflow unpacks at `RELEVO_VERSION` | it moves with the pin |

The pin and the stamp are different things. Raising `RELEVO_VERSION` by hand moves the scripts and leaves the text of the workflow as it was, which is how a workflow ends up with old text and new scripts. See [Install](install.md) for what each one is.

A workflow copied from an older version still adds the plugin from a marketplace, which has no version, so a cloud run takes the latest plugin. That is one more reason to update the workflows and not only the pin.

## The order

1. Update the plugin on every machine. This is safe in any order: a newer plugin reads an older `relevo.yml`, because the settings it adds are optional and have defaults.
2. Run `/relevo:init` and read its plan. The workflows that can be merged with the new template without a conflict are offered as updates, with their difference. Apply, commit the files on a branch and open a pull request to the default branch, because a workflow runs only from there. The labels and the other settings of the repository that `init` changes are changed at once, and the files are left in your working copy for you to commit.
3. Only when every machine and every workflow runs the new version, add the new settings to `relevo.yml`. An older version rejects a setting it does not know (`unknown setting`), so a new key breaks the machine or the workflow that is still behind.
4. Run `/relevo:doctor` to check the result.

## Reading the versions

`/relevo:doctor` has a line among its notes with the versions it can read here, without the network: the plugin in use, each installation that Claude Code lists for your user and for this repository, and the pins of the workflows on the default branch.

```bash
claude plugin list
```

A warning appears when the scopes are on different versions, with the command that updates the lagging one, when the text of a workflow is older than its pin, and when a workflow has no stamp, so the age of its text is unknown. For the plugin on a machine:

```bash
claude plugin marketplace update relevo
```

```bash
claude plugin update relevo@relevo
```

Restart Claude Code afterwards. Claude Code does not update a marketplace by itself unless you turn that on in `/plugin`.

## Updating the workflows

When a workflow exists and differs from the template, `/relevo:init` does not guess. It finds the published template that is closest to your file, fetches it with `npm`, and merges three texts: that template, your file and the current template. Your own changes, such as your credential line or your runner, are kept; the new text comes in; the pin and the stamp are set to the current version.

- A clean merge appears in the plan as an update, with its difference, and is written only when you agree.
- A conflict, which means you changed a line that the new template also changed, writes nothing: the plan names the file and shows both versions, and you merge it by hand.
- When no published version is close to your file, the plan says so. Tell `/relevo:init` which version the workflow was copied from and it tries again with that one.

It writes only under `.github/workflows/`, and it needs `npm` and a network connection to fetch the old templates.

## Files that no agent may read

A repository that versions a file on the restricted list stops every run once it moves to a version with [restricted files](security.md). `go` ends in `qa-failed` with "restricted file in the diff", even when the file is not part of the change, because the check also reads what the base branch versions, and `/relevo:doctor` fails for it.

The list matches by name, so the cases that surprise are not only secrets: a `.env.production` or `.env.testing` with values that are not secret, a `.env.sample`, a `.pem` or `.key` kept as a test fixture, and mobile configuration (`google-services.json`, `GoogleService-Info.plist`, `key.properties`). Only `.env.example` is exempt.

Before you raise the pin, run `/relevo:doctor` on the new version and read the files it names. Untrack each one and keep it out of git, or accept that runs stop. After you change `restricted_paths` in `relevo.yml`, run `/relevo:init` again: it rewrites the denials between the `# relevo:restricted` markers of `relevo-go.yml`, and nothing else does. If your workflow already has its own `settings:` input on the agent step, merge the two by hand.

## When something goes wrong

| What you see | Why | What to do |
|---|---|---|
| `unknown setting` when a command runs | `relevo.yml` has a key that this version does not know | update the plugin or the pin of the machine or workflow that reports it, or remove the key |
| `init` shows a conflict in a workflow | you edited a line that the new template also changed | compare the file with the template and merge it by hand, then run `/relevo:init` again |
| `doctor` says the text of a workflow is older than its pin | the pin was raised by hand | run `/relevo:init` to update the text |
| a cloud run behaves like an older version | the workflow still loads the plugin from the marketplace | update the workflow with `/relevo:init` |
