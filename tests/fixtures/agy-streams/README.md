# Event streams for the Antigravity run guard

`main-with-two-lens-subagents.jsonl` is **built by hand** in the shape that `scripts/lib/agent-guard.mjs` reads
(`agy -p --output-format stream-json`: `step_update` events with a conversation id, and a final `result`). It is not a
recording of a real run: no Antigravity was available when it was written. What it fixes is the expected behaviour of
the guard, not what Antigravity emits. Replace it with a real recording when one exists.

It holds a main agent with two turns of 100 tokens, a `subagent` step, and two lens subagents (conversations `lens-1` with
two turns of 200 tokens and `lens-2` with one turn of 300), so the totals are 5 turns and 900 tokens.
