---
name: think
description: Thinking partner for an idea before any issue exists. It runs the openspec-explore skill to explore the problem and the existing code, then the grill-with-docs skill to interview the person until every decision is made, so the conversation holds a strong, shared context. It implements nothing and writes no file: the terms and decision records it settles are handed to /relevo:issue, which puts them in the issue. Use when asked to think through, explore, plan or stress-test a feature; /relevo:issue turns what it reaches into issues.
argument-hint: "[idea]"
disable-model-invocation: true
---

# Relevo think

Think `$ARGUMENTS` (or what you have just been discussing) through with the person by running two existing skills, one after the other, in this conversation. The result is a shared understanding that `/relevo:issue` turns into issues.

`think` does not explore, interview or keep the project's language itself. The two skills do, and their own rules govern their part: do not restate them, shorten them or override them.

**This is for thinking, not for building.** You never write application code, commit, push, create issues or apply labels. If the person asks you to build, say that `think` does not build, and point to `/relevo:issue` (to write the issues) and `/relevo:go` (to build them).

## 1. Check the skills first

`think` needs four skills: `openspec-explore`, `grill-with-docs`, `grilling` and `domain-modeling`. Before anything else, check that each one is installed: it is listed among the available skills, or a folder with its name exists in `.claude/skills/`, `.agents/skills/` or `~/.claude/skills/`.

If any is missing, stop. Name the missing ones and show how to install them, then do nothing else:

- `openspec-explore`: run `openspec init` (or `openspec update`) in the project.
- `grill-with-docs`, `grilling`, `domain-modeling`: run `npx skills add mattpocock/skills` and choose those three.

Never copy a skill's content into the repository by hand to get past this.

An installed skill is in one of two states, and only a missing one stops `think`:

- **Invocable.** It is listed among the available skills, so you may invoke it with the Skill tool.
- **Reserved for the person.** It is not in that list but exists as a folder, and the `disable-model-invocation: true` line in the frontmatter of its `SKILL.md` says that only the person can launch it. It is installed, so do not stop. Remember which ones are reserved: you will not invoke them, you will ask the person to run them.

To tell them apart, read the first lines of `SKILL.md` of each skill that is not in the available list. If the file cannot be read, treat the skill as invocable.

## 2. Explore

Invoke the `openspec-explore` skill with the Skill tool, passing `$ARGUMENTS` as its argument. Stay in it while the idea is still shapeless: compare options and look at the real code instead of asking detailed questions. Move on when the shape of the idea is clear enough for precise questions, or when the person asks for the interview.

## 3. Grill

If `grill-with-docs` is invocable, invoke it with the Skill tool in the same conversation, so everything learned while exploring feeds its questions, and follow it until its own rules say it is done.

If it is reserved for the person, which is how it is published, do **not** try to invoke it and do not run its interview yourself by another route: the platform refuses both. End your turn with one message that asks the person to run `/grill-with-docs` in this same conversation, so the exploration feeds the questions. Because you may not regain control when that skill ends, put the hand-off in that same message (step 4): say that when the interview ends they should run `/relevo:issue` in this conversation, that the terms and decisions they settle stay in "To document", and that you wrote nothing to the repository.

**One exception to its rules.** The person using `think` often does not use git, and the base branch is protected, so a file written here would never reach the repository. Where the skill, through `domain-modeling`, would write `GLOSSARY.md` or a file under `docs/adr/`, do **not** write it. Keep the entry in a list called "To document" instead:

- for a settled term: its name, a definition of one or two sentences and the words to avoid;
- for a decision record the person accepted: a title and its text, without a number.

Everything else that skill does stays as it is: challenging terms that conflict with the glossary, sharpening vague words, probing boundaries with concrete scenarios and checking the code. An entry is vocabulary only: no implementation details, no decisions, no general programming terms.

## 4. Hand off

When the exploration and the grilling end, tell the person the next step is `/relevo:issue`, whatever next step those skills suggested themselves (for example `/opsx:propose`). Run it in this same conversation so the agreement is still in context.

Write the agreement with a part named **To document**, even when it is empty (then it says "To document: nothing"). List there each term and decision record from step 3, in the form above. Tell the person that these go into the issue as a documentation section, through `/relevo:issue`, and that `think` wrote nothing to the repository. If the session created or changed OpenSpec artifacts at the person's request, name them and say they are not committed.

Only if the person asks to keep the agreement for another session, write it to a Markdown file at the path they choose, tell them where it is and that it is not committed, and say that `/relevo:issue` can read it when given its path. Before writing, name the file and ask a direct yes/no question; an answer to a design question is never permission to write.

## Never

- Never write code, commit, push, create issues or apply labels.
- Never write `GLOSSARY.md` or anything under `docs/adr/`; hand those entries over in "To document".
- Never write a file the invoked skills' own rules do not allow; the agreement file only on request.
- Never run `openspec new change`, `openspec instructions` or `openspec archive` yourself.
- Never continue when a required skill is missing; a skill that is only reserved for the person is not missing.
- Never invoke a skill whose `SKILL.md` sets `disable-model-invocation`, and never replace it by running its flow yourself.
