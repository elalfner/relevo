---
name: think
description: Thinks an idea through before any issue exists. It interviews the person in rounds until every decision has been made, then writes the OpenSpec change (proposal, design, specifications and tasks) from what was agreed. Use when asked to think through, plan or stress-test a feature. It changes only the working tree and never commits, so it never starts on its own.
argument-hint: "[idea]"
disable-model-invocation: true
---

# Relevo think

Think `$ARGUMENTS` (or what you have just been discussing) through with the person until nothing is left to guess, then write it down as an OpenSpec change. The next step is `/relevo:create`, which turns that change into issues.

You ask and you write specifications. You never write application code, commit, push, create issues or apply labels.

## 1. Gather what exists

Before the first question, collect what can be looked up:

- the conversation so far;
- `relevo.yml`, if present (`language`, `team.members`);
- existing changes in `openspec/changes/` and the specifications in `openspec/specs/`, so the idea fits what is already specified;
- facts about the code that a question will depend on. Finding facts is your job, never the person's: hand each lookup to a subagent and do not block on it. Only the questions that depend on its answer wait for it.

Say in two or three lines what you already know, so the person sees earlier work was used.

## 2. Interview in rounds

Treat the idea as a **tree of decisions**: every decision leads to the decisions that depend on it. The **frontier** is every decision whose prerequisites are already settled, that is, every question you can ask now without guessing an answer you have not heard.

Ask the whole frontier in one round, then wait. Number the questions, and give each your recommended answer, worded so that "yes" accepts it:

```
Q1. <short title>: <the question, with the options when there are several>
Recommended: <your answer>
```

Each round of answers settles some decisions and opens others. Work out the new frontier and ask it. A question whose answer depends on another question still open in the same round belongs to a later round.

The tree must cover, as far as it applies:

- **Behaviour.** Each situation and what a person must see in it. These become scenarios.
- **Edge cases.** Empty or missing data, limits, no network, repeated actions, and the exact expected result of each.
- **Other work it depends on.** Something that does not exist yet, here or in another repository.
- **What is visible.** Where it appears, when it shows or hides, states while loading and on error, feedback, reference images.
- **Data.** For each source or endpoint: how the caller authenticates, request, a realistic response with types, which values may be null. Use made-up values in examples, never real keys or personal data.
- **Size.** Whether it can be built and verified in one pass on a device, or must be split.
- **Out of scope.** What is deliberately left out.

Do not invent answers. If the person says they do not know, record it as an open question and keep it out of the specification.

## 3. Agree

The interview ends when the frontier is empty: every branch visited and nothing silently assumed. Then write a summary of what was decided (behaviour, edge cases, dependencies, splits, open questions) and ask the person to confirm it. Do not write the change before a clear yes.

## 4. Write the OpenSpec change

Run `openspec --version`; if it does not run, tell the person to run `/relevo:doctor` and stop after the summary.

Choose a short change name in kebab-case. Then:

1. `openspec new change "<name>" --description "<one line>"`
2. `openspec status --change "<name>" --json` to learn which artifacts are needed and in which order.
3. For each artifact that is ready, in dependency order: `openspec instructions <artifact> --change "<name>" --json`. Follow its `instruction` and `template`, treat its `context` and `rules`, when it has them, as constraints for you (never copy them into the file), and write the file to its `resolvedOutputPath`. Re-read the artifacts it depends on first. Repeat until every needed artifact exists.
4. `openspec validate "<name>"`. Fix what it reports.

What goes in:

- **Scenarios** are the agreed WHEN/THEN pairs, faithfully; every agreed edge case becomes a scenario too. Add nothing that was not agreed.
- **design.md** records the decisions of the interview and why. Open questions go under an "Open questions" heading.
- **tasks.md** has small, verifiable tasks that cover every scenario.

Write the artifacts in the language set by `language` in `relevo.yml` where the OpenSpec tool allows it, keeping its keywords (`SHALL`, `WHEN`, `THEN`, headings) in English.

## 5. Hand off

Do not commit anything. Tell the person:

- where the change is (`openspec/changes/<name>/`) and that it is left uncommitted on purpose;
- the open questions, if any, that must be answered before the issues are written;
- that the next step is `/relevo:create`, which reads this change to write the issues and can then offer to remove it (`go` writes its own change from each issue, so this one is a working draft).

## Never

- Never write the change before the person confirmed the summary.
- Never answer the questions yourself and move on.
- Never commit, push, create issues or apply labels.
