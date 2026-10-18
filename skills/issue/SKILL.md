---
name: issue
description: Writes the GitHub issues that Relevo's go builds, and updates the description of one that already exists. Given an idea, a conversation or an OpenSpec exploration it asks only for what is missing (scenarios, edge cases, dependencies, screens, data contracts), checks each draft with the same rules go uses, shows everything for approval and then creates the issues. Given an issue number it rewrites that issue's description, but only while Relevo has not committed to building it. Use when asked to draft, write, create or update issues for a feature. It never applies the ready label.
argument-hint: "[what to build, the path of a saved agreement, or the number of an issue to update]"
disable-model-invocation: true
---

# Relevo issue

Help the person write the issue or issues for `$ARGUMENTS` (or for what you have just been discussing) so that `/relevo:go` can build them with nobody to ask. The issue is the only thing the builder sees: whatever is not written in it will be guessed or will send it back.

You write issues; you never build, label as ready, assign work to the build queue or touch code.

**Mode.** If `$ARGUMENTS` starts with an issue number (`42` or `#42`) you are updating that issue: follow "Updating an existing issue" at the end and skip steps 1 to 6. Anything else, or nothing, is the creation flow below.

Scripts live in `${CLAUDE_PLUGIN_ROOT}/scripts/`. The format is explained in `${CLAUDE_PLUGIN_ROOT}/docs/issue-format.md` and the skeleton is `${CLAUDE_PLUGIN_ROOT}/templates/issue.md`.

## 1. What you already know

Before asking anything, collect what exists:

- the conversation so far;
- if `openspec/changes/` exists read the `proposal.md`, `design.md`, `tasks.md` and `specs/` of the relevant change;
- the agreement reached with `/relevo:think`, in this conversation or in a file whose path is given in `$ARGUMENTS`: take its decided scenarios, edge cases, dependencies and splits as already answered, and resolve its open questions with the person before writing;
- the part of that agreement named **To document** (the terms and decision records `think` settled): take it as text the person already approved, and ask again only about what is missing from it;
- `GLOSSARY.md`, if present: use its terms in the issues and avoid the words it lists to avoid;
- `relevo.yml` (`language`, `team.members`, `team.spec_writer`, `branches.base`). If it is missing, continue without it and ask the language and the assignee.

Tell the person in two or three lines what you already have, so they see their earlier work was used. Then ask only about what is still missing. Never ask again what is already answered.

## 2. Ask for what is missing

Ask in small groups, at most four questions at a time. Skip every group that is already clear.

**Behaviour (always).** Which situations should the feature handle, and what must a person see in each? Each answer becomes a `WHEN` / `THEN` pair. Which unusual cases exist: empty data, missing values, no network, limits, repeated actions? Each becomes an edge case with the exact expected result. Do not invent scenarios or edge cases the person did not give; when an answer leaves the visible behaviour ambiguous, ask a follow-up instead of writing an assumption.

**Other work it depends on (always).** Does this need something that does not exist yet, here or in another repository (for example a server endpoint)? Ask whether an issue already covers it.
- If one does, ask for its number and write `Depends-on: #N`. If the person does not remember it, offer to search: `gh issue list --search "<words>" --state open`.
- If none does, offer to draft that work as its own issue first, with its own scenarios and edge cases, and link the second to it. If the work lives outside this repository, write it under "Out of scope" with the reference the person gives.

**Screens and behaviour (when something is visible).** Where does it appear, what does it look like, when does it show or hide, is there an animation or touch feedback, what happens while loading and on error, which system actions does it trigger (call, map, share), is there a reference image? Ask for the image's file name; never invent one.

**Data contract (when data is read or written).** For each endpoint or source: method and path, how the caller authenticates, request fields, a realistic response with every field typed, and which values may be null and how the app treats them. Never put real keys, tokens or personal data in an example; use made-up values.

**Size.** If the feature spans work that can be built and verified separately, propose splitting it. Every resulting issue needs its own scenarios and edge cases, and the order is written with `Depends-on`. The person decides how many to create.

## 3. Write the drafts

Fill `${CLAUDE_PLUGIN_ROOT}/templates/issue.md` for each issue, keeping the sections that apply and deleting the optional ones that do not. Rules:

- Write in the language of `language` in `relevo.yml`, unless the person asks for another. Keep the keywords `WHEN`, `THEN`, `Edge cases` and `Depends-on` exactly as they are: `go` reads them.
- The title is short, plain and has no emoji or tag suffixes (it must stay readable in lists and boards). Emojis are allowed inside the body only if the person wants them.
- The body states facts from the person; where you had to choose a wording, keep the person's meaning.
- Nothing secret goes in an issue, however it is phrased: issues are readable by everyone with access.
- **Documentation.** When "To document" has terms or decision records, write the optional `## Documentation` section of the template with the exact text of each, word for word as agreed: a glossary entry as name, definition and words to avoid, to be added to `GLOSSARY.md` under its existing heading after the existing entries; a decision record as a title and a text, to be added to `docs/adr/`, with no number (it is numbered when it is written). When "To document" says nothing, leave the section out. The section names only `GLOSSARY.md` and `docs/adr/`: if the person asks it to update anything else, for example the README, do not put that in the section and say that it only carries the glossary and decision records.

Save each draft under the scratchpad or a temporary directory outside the repository (never inside the working tree), as `<n>.md`.

## 4. Check

For every draft:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/check-issue.mjs --title "<title>" --body-file <file>
```

It applies the rules `go` applies and a few more: at least one complete scenario, at least one edge case, no leftover template text, no emoji in the title, a title of at most 72 characters, and nothing that looks like a credential. If it reports problems, fix them with the person (ask for the missing information; do not fill it in yourself) and check again. Create nothing while any draft fails.

## 5. Approval

Show every draft in full, in the order they will be created, with for each: the title, the milestone, the assignee and its dependencies. List the open milestones with `gh api repos/{owner}/{repo}/milestones --jq '.[].title'` and offer the members of `team.members` as assignees. The assignee is the person who will review the built work on a device.

Show the `Documentation` section too, whole, like the rest of the draft. Ask for explicit approval. If the person asks for changes, revise, check again and show it again. Create nothing before a clear yes.

## 6. Create

Only after approval, in dependency order (so each `Depends-on` can name a real number):

1. If a milestone does not exist, create it only when the person said so: `gh api repos/{owner}/{repo}/milestones -f title="<name>"`.
2. For each draft: `gh issue create --title "<title>" --body-file <file> --milestone "<milestone>" --assignee <login>`. Take the issue number from the URL it prints. Before creating a draft that depends on a draft created in this session, replace its placeholder with the real number and check it again.
3. Do **not** add the `ready` label or any lifecycle label.

Finish with the links of the issues created and one reminder: `go` starts for an issue when someone with write access applies the `ready` label, and that is the moment to read the issue once more, because it is the last point to change what will be built.

## Updating an existing issue

`go` builds exactly what an issue says, so its text is only free to change while Relevo has not committed to a build. The mode is the issue number in `$ARGUMENTS`; you edit the description only, never the title, labels, milestone or assignee.

1. **Read it.** `gh issue view <n> --json number,title,body,state,labels > <file>` (the file goes outside the working tree). If the issue does not exist, say so and stop.
2. **Ask whether it may be edited.** `node ${CLAUDE_PLUGIN_ROOT}/scripts/can-edit-issue.mjs --input <file>`. Exit 0 prints `editable`. Exit 1 prints the label found and why: change nothing and tell the person that the text is what `go` builds, name the label, and give the way forward: remove `ready` by hand, edit, and apply `ready` again, which is also the last point to reread the issue. If `building` is the label, they must wait for the build to finish or fail first. Only an open issue with no lifecycle label, or with `needs-spec` alone, is editable.
3. **Start from the current body.** Ask only what the person wants to change, keep every part they did not mention, and do not invent scenarios or edge cases. An existing `## Documentation` section stays exactly as it is unless the person asks to change it; it still carries only glossary entries and decision records.
4. **Recheck the dependencies.** Every `Depends-on: #N` in the new body must name an existing issue (`gh issue view N`) other than this one. Fix a missing or self-referencing line with the person before going on.
5. **Check.** Save the new body outside the working tree and run `check-issue.mjs --title "<current title>" --body-file <file>`. Fix every problem with the person; apply nothing while it fails.
6. **Approve.** Show the new text next to the current one, the `Documentation` section whole, and ask for explicit approval. If the person asks for more changes, revise, check and show it again. Apply nothing before a clear yes.
7. **Apply.** Read the issue again with `gh issue view <n> --json state,labels` and run `can-edit-issue.mjs` on it. If it is no longer editable, apply nothing and explain the refusal as above. Otherwise `gh issue edit <n> --body-file <file>`, then print the issue link.

## Never

- Never apply `ready` or any other Relevo label.
- Never create an issue before the person approved it and the check passed.
- Never edit an issue that `can-edit-issue.mjs` refuses, and never edit before approval and a fresh read of its labels.
- Never change the labels, title, milestone or assignee of an existing issue.
- Never invent scenarios, edge cases, endpoints or data.
- Never put credentials, tokens or personal data in an issue.
- Never put anything in `Documentation` except glossary entries and decision records, and never change the wording the person agreed.
