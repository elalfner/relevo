## Context

See `proposal.md`. The page has to be followable by someone who has never used Relevo, so everything in it is a step with a command, a result and a recovery. Facts that shape it: the one-person path is the one that has run for real (a private repository, one assignee, `review.mode: none`); the model credential is a repository secret that the person creates and Relevo never reads; the cloud build starts when `relevo:ready` is applied; the review needs a device or, for web, the autopilot.

## Goals / Non-Goals

**Goals:** a page a person can follow in about twenty minutes of their own time, plus the build time, to a merged pull request; every command on it is real and every expected result is one the code produces.

**Non-Goals:** a tutorial for teams (the guide and the configuration page cover that); a tutorial for every stack; screenshots.

## Decisions

**D1. The path is the solo path.** `review.mode: none`, one person who is the spec writer, the assignee and the one who ships. It is what has been tried for real, so every step can be backed by the pilot findings. The page says at the start that it is the solo path and links the guide and the configuration page for a team.

**D2. Structure.** Sections, in this order: *Before you start*, *1. Install the plugin*, *2. Check your setup*, *3. Set the repository up*, *4. Add the model credential*, *5. Write your first issue*, *6. Let it build*, *7. Review it*, *8. Ship it*, *What next*, *If something goes wrong*. Each numbered step has the same shape: one sentence of purpose, a code block with the command, "You should see" with the result, and "If not" with the fix, as list items, so the parity test compares them.

**D3. Expected results are quoted from the code.** What the page shows as output comes from the messages the code produces (the doctor report lines, the plan of `init`, the built comment, the ship summary), read from the catalogue and the tests, not invented. A test compares the quoted fragments with the message catalogue.

**D4. The secret.** The page shows `gh secret set ANTHROPIC_API_KEY` (which asks for the value without echoing it) and, as the other option, how to obtain the subscription token and store it as `CLAUDE_CODE_OAUTH_TOKEN`; it says in one line that the value is never typed into a file or into the conversation. It links the page on credentials for the difference.

**D5. The first issue.** A tiny, concrete example (show a label on a screen) with scenarios, an edge case and an out-of-scope line, that passes `check-issue`; a test runs the example through `check-issue` so the page cannot show an issue that fails its own check.

**D6. Links.** The cover's documentation list and the index put Get started first; `install.md` gains a first line pointing to it and loses the claim that Flutter is the only stack.

## Risks / Trade-offs

- A step-by-step page ages faster than a reference. The tests that check commands, scripts and the example issue keep the mechanical parts true; the prose is checked when a related change updates its reference page.
- The build time quoted comes from one pilot run; the page says "a few minutes" and that it varies, not a promise.
