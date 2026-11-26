# Design

## Context

- The cover is `README.md` with its twin `README.es.md`. `tests/readme-sync.test.mjs` requires the same sections, tables, lists, pictures, links and shell blocks in both, the seven commands as table rows in order, and the state pictures in a fixed order.
- `tests/cli.test.mjs` requires the cover to show the plugin commands, `npm install -g @elalfner/relevo` and `relevo install --scope project`. `tests/notice.test.mjs` requires the acknowledgements. The documentation spec requires Get started to be the first link of the documentation list.
- GitHub renders no custom CSS, fonts or scripts in a README. The layout was agreed on an HTML mockup that is not part of the repository, so the agreed copy is recorded below.

## Goals / Non-Goals

**Goals:** the agreed cover, rendered with what GitHub supports; every claim backed by the repository.

**Non-Goals:** reproducing the mockup pixel by pixel, the Nunito font in running text, a language switcher, a recorded demo.

## Decisions

**Order of the cover.** Static logo, headline, category, hook, language and documentation links, animated logo, install commands, requirements, plain-code tags (`Claude Code`, `Spec-driven`, `Multi-agent`, `MIT`), figures, then sections: queue, three handoffs, why, your code, FAQ; then the collapsed logo-and-commands section, status, Documentation, Acknowledgements, License. The last three stay as they are today.

**Install.** The two plugin commands visible; the restart and `/relevo:doctor` line after them; the npm shortcut in a collapsed `<details>`. The scope options and the Antigravity paragraph leave the cover (`docs/install.md` has both).

**Figures** are a three-column Markdown table followed by a link to the pilot findings entry. External badge images are not used: they add a third party to the page.

**Queue timeline** is an SVG in `docs/cover/`, one per language and theme (`queue-{en,es}-{black,white}.svg`), in a `<picture>`. A Markdown table was considered: it needs no files but loses the filled blocks that show when the person holds the baton.

**Handoff cards** are an HTML `<table>` of three cells with the `think`, `go` and `review` state pictures. HTML rows do not match the test's command-row pattern. The test that reads the order of the state pictures is changed to read only Markdown table rows, so it keeps guarding the command table.

**Command table** moves unchanged inside `<details>`, with the logo legend that now sits in "How it works".

**Tests** for the new requirements go in `tests/cover.test.mjs`. It does not compare whole sentences, only what the requirements name.

**Agreed copy.** Spanish uses "el issue".

| Where | English | Spanish |
|---|---|---|
| Headline | Stop babysitting your agent. Start shipping. | Deja de cuidar al agente. Empieza a entregar. |
| Category | AI agent orchestrator, from issue to merge | Orquestador de agentes de IA, del issue al merge |
| Hook | Review one while the next one builds. | Mientras revisas uno, ya se construye el siguiente. |
| Requirements | You need: Claude Code, git, GitHub and its CLI, Node 20.19 or later and OpenSpec. | Necesitas: Claude Code, git, GitHub y su CLI, Node 20.19 o superior y OpenSpec. |
| Figure 1 | 100+ merged pull requests on real projects | 100+ pull requests mergeados en proyectos reales |
| Figure 2 | 5 specialized AI reviewers | 5 revisores de IA especializados |
| Figure 3 | 100k+ lines in the largest project using it | 100 mil+ líneas en el proyecto más grande donde se usa |
| Status | Status: in use on real projects. Before 1.0, configuration and commands may change between versions; the changelog marks breaking changes. | Estado: en uso en proyectos reales. Antes de la 1.0, la configuración y los comandos pueden cambiar entre versiones; el changelog marca los cambios que rompen. |
| Collapsed title | What does the Relevo logo mean? (and all its commands) | ¿Qué significa el logo de Relevo? (y todos sus comandos) |

**A queue that keeps you moving / Una cola que no te deja esperando**
- EN: Ask for several builds and the queue takes it from there. You test what is ready while the agents keep going in the cloud. Timeline: Agents: issue #1, #2, #3; You: review #1, review #2, one step behind. Bullets: Waits for dependencies before starting. Holds issues that name the same file, to avoid conflicts. Pauses when you have too much waiting for review. Retries later when the model usage limit runs out. Urgent work jumps ahead.
- ES: Pide el build de varios issues y la cola se encarga. Tú pruebas lo que ya está listo mientras los agentes avanzan en la nube. Línea de tiempo: Agentes: issue #1, #2, #3; Tú: revisas #1, revisas #2, un paso atrás. Viñetas: Espera las dependencias antes de empezar. Retiene issues que nombran el mismo archivo, para evitar conflictos. Frena si ya tienes demasiado sin revisar. Si se agota el límite de uso del modelo, reintenta más tarde. Lo urgente se adelanta.

**A relay between you and your agents / Un relevo entre tú y tus agentes**
- You think / Tú piensas: Decide what to build and approve the issue. / Decides qué construir y apruebas el issue. `/relevo:think`
- Agents deliver / Los agentes entregan: One agent builds. Up to five reviewer agents audit it: spec, security, code, bugs and interface. / Un agente construye. Hasta cinco agentes revisores lo auditan: spec, seguridad, código, bugs e interfaz. `/relevo:go`
- You decide / Tú decides: Test, ask for fixes or approve the merge. / Pruebas, pides correcciones o apruebas el merge. `/relevo:review`

**Why Relevo? / ¿Por qué usar Relevo?**
- No agent grades its own work: The builder is not the reviewer. Separate agents audit against your spec. / Nadie se califica solo: Quien construye no es quien revisa. Revisores aparte auditan contra tu spec.
- You have the last word: Approving and merging are a person's decisions. / Tú tienes la última palabra: Aprobar y mergear son decisiones de una persona.
- You always know what is next: Every handoff says what happened, what is expected of you and which command to run. / Siempre sabes qué sigue: Cada traspaso dice qué pasó, qué se espera de ti y qué comando correr.
- It fits your project: Your rules, your checks, your limits. In the cloud or on your machine. / Se adapta a tu proyecto: Tus reglas, tus checks, tus límites. En la nube o en tu máquina.

**Your code, under control / Tu código, bajo control**
- EN: The agent never approves or merges: a person does. It builds with no web access and a closed list of tools. Protected paths, restricted secret files and a credential scan before every commit. Per-run limits that you set. Then: And you review before the merge. See every safeguard in the security model.
- ES: El agente no aprueba ni mergea: eso lo hace una persona. Construye sin acceso a la web y con una lista cerrada de herramientas. Rutas protegidas, archivos de secretos restringidos y escaneo de credenciales antes de cada commit. Límites por ejecución que tú configuras. Después: Y tú revisas antes del merge. Conoce a fondo las protecciones en el modelo de seguridad.

**FAQ / Preguntas frecuentes** (each a `<details>`, the first open)
- Does it work on large projects? Yes. It is used on a codebase of over 100,000 lines. On projects like that, tune the checks and the per-run limits.
  ¿Sirve para proyectos grandes? Sí. Se usa en un código de más de 100 mil líneas. En proyectos así conviene ajustar los checks y los límites de cada ejecución.
- Can it merge without me? No. A person asks for the merge. To also require someone else's approval, turn on review and GitHub branch protection (on private repositories it depends on your plan).
  ¿Puede mergear sin mí? No. El merge lo pide una persona. Para exigir además la aprobación de otra, activa la revisión y la protección de ramas de GitHub (en repos privados depende de tu plan).
- What does it cost? Relevo is free and MIT. You pay for the model, with an API key or your subscription, and for GitHub runners if you use them. With an API key, the per-run cost limit is a real cap.
  ¿Cuánto cuesta? Relevo es MIT y gratuito. Pagas el modelo, con una API key o tu suscripción, y el runner si usas la nube de GitHub. Con API key, el límite de costo por ejecución es un tope real.
- Does my code leave my infrastructure? The code the agent reads is sent to the model provider, even when the build runs on your own runner. Relevo adds no server of its own.
  ¿Mi código sale de mi infraestructura? El código que lee el agente se envía al proveedor del modelo, también si el build corre en tu propio runner. Relevo no agrega un servidor propio.
- What if a build fails halfway? The issue says what happened and what to do. When it stops at a limit or at QA, the work done is kept on its branch.
  ¿Y si un build falla a la mitad? El issue dice qué pasó y qué hacer. Cuando se detiene por un límite o por QA, el trabajo hecho se guarda en su rama.

**Description** of the three manifests: "AI agent orchestrator, from issue to merge: agents build and review, people decide." (`package.json` keeps its `Relevo: ` prefix.)

**Usage record**, measured on 2026-11-25, for the new entry of the pilot findings:
- Four private repositories: Vue and Flutter (one of them a Flutter plugin). Work from 2026-10-23 to 2026-11-25.
- 102 merged pull requests from a `feature/` or `fix/` branch whose description names Relevo or one of its review results. Promotions, chores and other branches are not counted. 88 of them are in one repository.
- Largest repository: about 120,000 hand-written lines (generated files excluded), of which about 75,000 are tests and stories. It narrowed the `test` check to the changed folders, raised the turn limit to 200 and builds on its own runner.
- Peer approval in that repository: 75 of its 88 pull requests approved by someone other than the author. 9 review reminders posted. No escalation seen. Reviewer selection not verified. Review mode was set to `none` on 2026-11-12; approvals continued.
- Two or three people per repository at most; larger teams were not observed.
- Cloud builds: of 70 closed progress comments in three of the repositories, 15 ended without a result. Their causes were not all classified.
- 30 "not merged" notices in the largest repository (among them conflicts, a base branch that moved, checks GitHub had not finished and a specification that could not be archived).

## Risks / Trade-offs

- [The figures come from private repositories and a reader cannot verify them] → the record states the date and the counting rule.
- [The 100+ rests on a margin of two over the threshold and on a text match] → the rule is written down; if a recount at apply time gives less than 100, the cover says what the recount gives.
- ["Stop babysitting your agent" is promotional and no comparison with using the model directly was measured] → no figure of speed or quality is published.
- [The cover is much longer than before] → the command table and the npm shortcut are collapsed.
- [The cover reaches GitHub's front page only after the promotion to `main`, and npm only with the next release] → listed as follow-up.
