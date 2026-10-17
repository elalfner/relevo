## Context

`think` chains `openspec-explore` and `grill-with-docs`. The second one is published with `disable-model-invocation: true`, which the author of that skill chose on purpose: it is a command the person starts. The Skill tool enforces it and tells the model not to reproduce the skill's workflow by other means. Our skill text says "invoke it with the Skill tool", so the call fails and the model has no instruction for what to do next. `doctor` checks only that the folder exists, so it reports a healthy setup.

## Goals / Non-Goals

**Goals:**
- `think` works when the grilling skill is reserved for the person, with one clear message that asks for the command.
- `doctor` tells the person which skills they must launch by hand.
- Missing, reserved and invocable are three different states.

**Non-Goals:**
- Changing the third-party skills. They are not ours; Relevo does not edit or copy them.
- Making the model run the interview itself. The platform refuses that route, and the skill's author reserved it.

## Decisions

### D1. Ask the person to launch a reserved skill, in the same conversation

When `grill-with-docs` cannot be invoked, `think` says so and asks the person to run `/grill-with-docs` in this same conversation, so everything the exploration learned feeds the questions.

*Alternatives rejected*: removing the setting from the vendored copy (it is a third-party file and would diverge from its source); replicating the interview in `think` (refused by the platform and against D15 of the archived `relevo-v1`, which says `think` does not reimplement those skills); dropping the grilling from `think` (it is the point of the command).

### D2. The hand-off goes in the message that asks for the command

When the person's command starts, `think` may not regain control once it ends. So the same message that asks for `/grill-with-docs` also says: run `/relevo:create` when the interview ends, the settled terms stay in "To document", and nothing was written to the repository.

### D3. Missing, reserved and invocable

A skill listed among the available skills is invocable. A skill found only as a folder has its `SKILL.md` frontmatter read: `disable-model-invocation: true` means reserved for the person. A reserved skill is installed, so `think` does not stop for it; only a skill that is not there at all stops `think`.

### D4. `doctor` reports a reserved skill as a notice that passes

The check for each required skill still passes when it is installed. When its frontmatter sets `disable-model-invocation`, the message adds that the person launches it by hand. It is information the person needs, not a defect to fix, so it does not fail and does not add a separate warning.

## Risks / Trade-offs

- [The frontmatter format changes] → Only the one key is read, with a plain match; an unreadable file is treated as invocable, which is today's behaviour, and `think` handles a refused call by asking the person.
- [The person ignores the request] → `think` ends its turn after the message; nothing is written, and the exploration stays in the conversation for a later run.
- [The model keeps trying the Skill tool] → The skill text says to read the state first and not to try a reserved skill.

## Open Questions

- Whether `think` should also detect a reserved `openspec-explore` if its author changes it later. The same reading covers it; nothing is done for it beyond D3.
