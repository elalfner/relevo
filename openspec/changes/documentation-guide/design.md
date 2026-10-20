## Context

See `proposal.md`. This change writes documentation and the tests that keep it true; it changes no behaviour. The pages are written from the skills, the specifications and what the earlier pilots found, and every claim is one a test can check (a command, a label, a setting, a script, a file).

## Goals / Non-Goals

**Goals:** a person can learn what to do next in any situation from the guide; the commands and settings are fully described; the security model is honest; English and Spanish never drift; a page cannot name something that does not exist.

**Non-Goals:** translating `pilot-findings.md` or `action-parameters.md` (logs and reference of a third-party action, English only as now); new behaviour; screenshots.

## Decisions

**D1. Guide structure.** `guide.md` has these sections, in this order: *The life of an issue* (a table: step, command, who runs it, what comes next, built from the states of `next-step.mjs`), *What do I do when…* (one short subsection per situation, each ending with the command), *Fix or a new issue*, *Cloud, local or both*, *Credentials and limits*, *Public repositories*. Subsections are `###` so the parity test compares them.

**D2. The table of the life of an issue is checked against `next-step.mjs`.** A test reads the states and commands of the table in the guide and compares them with `NEXT_STEP_STATES` and the commands of `nextStep()`, so the guide and the hand-off messages cannot say different things.

**D3. Security page structure.** *What Relevo protects and how* (a table: threat, measure, where it is enforced: the platform or a prompt), *What it does not protect*, *What to do on a public repository*, *Secrets*. The measures listed are the ones named in `openspec/specs/security/spec.md` and the later changes; each row names the mechanism by its file or setting so a test can check it exists.

**D4. The claims test.** `tests/docs-claims.test.mjs` reads every page (not `pilot-findings`, a log) and checks: every `/relevo:<name>` is one of the nine commands; every backticked token that looks like a script (`something.mjs`) exists in `scripts/`; every `relevo:<label>` is a label of `labels.mjs`; every setting named in the configuration table is one the schema accepts, and every setting of the schema is in the table; every relative link resolves (the parity test already does this); the argument hint of each skill appears in the commands page of both languages.

**D5. Spanish is a translation with the same structure.** The existing parity test (headings, tables, lists, links, shell blocks) covers the new pages once they are in `PAGES`; the Spanish text is written, not machine-checked.

**D6. Commands page.** Each command gets a subsection: what it does (the existing table row stays), the argument, an example and what it asks or changes. The table stays at the top; subsections follow. The parity test compares them.

## Risks / Trade-offs

- Documentation of behaviour that is not yet tried: each page says plainly what has not been tried (the autopilot's Flutter flow, a real team) instead of promising it.
- A claims test cannot judge prose; it catches names that do not exist and settings that are missing, not an explanation that is wrong.
