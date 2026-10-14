---
name: think
description: Thinking partner for an idea before any issue exists. It runs the openspec-explore skill to explore the problem and the existing code, then the grill-with-docs skill to interview the person until every decision is made, so the conversation holds a strong, shared context. It implements nothing. Use when asked to think through, explore, plan or stress-test a feature; /relevo:create turns what it reaches into issues.
argument-hint: "[idea]"
disable-model-invocation: true
---

# Relevo think

Think `$ARGUMENTS` (or what you have just been discussing) through with the person by running two existing skills, one after the other, in this conversation. The result is a shared understanding that `/relevo:create` turns into issues.

`think` does not explore, interview or keep the project's language itself. The two skills do, and their own rules govern their part: do not restate them, shorten them or override them.

**This is for thinking, not for building.** You never write application code, commit, push, create issues or apply labels. If the person asks you to build, say that `think` does not build, and point to `/relevo:create` (to write the issues) and `/relevo:go` (to build them).

## 1. Check the skills first

`think` needs four skills: `openspec-explore`, `grill-with-docs`, `grilling` and `domain-modeling`. Before anything else, check that each one is installed: it is listed among the available skills, or a folder with its name exists in `.claude/skills/`, `.agents/skills/` or `~/.claude/skills/`.

If any is missing, stop. Name the missing ones and show how to install them, then do nothing else:

- `openspec-explore`: run `openspec init` (or `openspec update`) in the project.
- `grill-with-docs`, `grilling`, `domain-modeling`: run `npx skills add mattpocock/skills` and choose those three.

Never copy a skill's content into the repository by hand to get past this.

## 2. Explore

Invoke the `openspec-explore` skill with the Skill tool, passing `$ARGUMENTS` as its argument. Stay in it while the idea is still shapeless: compare options and look at the real code instead of asking detailed questions. Move on when the shape of the idea is clear enough for precise questions, or when the person asks for the interview.

## 3. Grill

Invoke the `grill-with-docs` skill with the Skill tool in the same conversation, so everything learned while exploring feeds its questions. Follow it until its own rules say it is done.

## 4. Hand off

When the exploration and the grilling end, tell the person the next step is `/relevo:create`, whatever next step those skills suggested themselves (for example `/opsx:propose`). Run it in this same conversation so the agreement is still in context.

Name the documentation files the session created or changed (glossary, decision records, OpenSpec artifacts) and say they are not committed.

Only if the person asks to keep the agreement for another session, write it to a Markdown file at the path they choose, tell them where it is and that it is not committed, and say that `/relevo:create` can read it when given its path. Before writing, name the file and ask a direct yes/no question; an answer to a design question is never permission to write.

## Never

- Never write code, commit, push, create issues or apply labels.
- Never write a file the invoked skills' own rules do not allow; the agreement file only on request.
- Never run `openspec new change`, `openspec instructions` or `openspec archive` yourself.
- Never continue when a required skill is missing.
