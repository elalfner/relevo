# Design

The wording is built in `runNoOutcome` (`scripts/lib/messages.mjs`): `resume.es` is `... (${saved} guardados) ...`. The only agreement problem is that `guardados` is plural for every `saved`. The change picks the form from the count: `saved === 1 ? 'guardado' : 'guardados'`. The English wording ("(N saved)") is a participle and needs no agreement.

Alternatives not taken: rewording to avoid the agreement (for example "N guardados" -> "con N checkpoint(s)"), which changes a text that is correct for every other count and was verified in a real run; a general pluralisation helper, which no other message needs (the only other count, "(N de M tareas hechas)", is already correct for one).

The case of zero checkpoints has its own wording ("todavía no hay ningún checkpoint") and is not affected.
