## Why

`/relevo:think` tells the model to invoke `grill-with-docs` with the Skill tool. That skill sets `disable-model-invocation`, so the platform refuses the call ("it cannot be used with the Skill tool ... ask the user to run it") and forbids replicating its flow by another route. We hit it during the sandbox pilot: step 3 of `think` does not work as written, and `doctor` cannot tell the person, because it only checks that the skill's folder exists. The pull request that first raised this (#3) described the fix against `relevo-v1`, which has since been archived; this change carries the same decisions on top of the archived specifications.

## What Changes

- `think` invokes a skill itself only when that skill allows model invocation. When the grilling skill is reserved for the person, `think` asks them to run `/grill-with-docs` in the same conversation and does not replicate its flow.
- Because `think` may not regain control when the person's command ends, the hand-off to `/relevo:create`, and the note that the settled terms stay in "To document" and nothing was written, go in the same message that asks for the command.
- A skill that is installed but reserved for the person is available, not missing: `think` does not stop because of it. A skill listed among the available skills is invocable; one found only as a folder has its frontmatter read.
- `doctor` reads the frontmatter of each required skill found as a folder and, when it sets `disable-model-invocation`, passes the check with a notice that the person launches it by hand.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `think`: three requirements change ("Think runs the exploration and grilling skills, it does not restate them", "Think stops when a required skill is missing" and "Think hands off to create").
- `init-doctor`: "Required external tools" gains the frontmatter reading and the notice.

## Impact

- `skills/think/SKILL.md`: step 1 separates missing, reserved and invocable; step 3 asks the person to launch a reserved skill and gives the hand-off in that message.
- `scripts/lib/doctor.mjs`, `scripts/doctor.mjs`: a new fact (the required skills that are reserved for the person) and its notice in the report.
- Tests: `tests/skill-think.test.mjs`, `tests/doctor.test.mjs`.
- `README.md` and `README.es.md`: the line that says `think` runs the skills now says that a reserved skill is launched by the person.
- Pull request #3 carries this change; its earlier edits to `relevo-v1` are dropped.
