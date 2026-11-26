# Design

## Context

The five agents are `agents/qa-{spec,security,code,bugs,interface}.md`. `interface` runs only when the change matches interface rules. `qa.bugs` is `advisory` by default, so its findings block nothing. Only blocking findings return to the developer, within `qa.retries`. The cover requirements are in the `documentation` spec; `tests/readme-sync.test.mjs` keeps both languages with the same structure.

## Goals / Non-Goals

**Goals:** the approved copy, below the figures and above the queue.

**Non-Goals:** examples of mistakes caught (rejected: they read as minor and make the agents look weak) and figures (none are recorded yet).

## Decisions

**A table, one row per agent.** A list of three filters was rejected: it hid what the agents do. A sentence naming them was rejected for the same reason.

**The test reads the agent files.** It counts `agents/qa-*.md` and expects as many rows, so a sixth agent cannot be forgotten.

**Agreed copy.**

## Relevo catches mistakes before you start testing

One agent builds. Then a team of agents that did not write the code examines it:

| Agent | What it hunts |
|---|---|
| **Spec** | scenarios with no code or test, tasks taken for done |
| **Security** | injection, permission flaws, exposed secrets |
| **Code** | weak tests, leftovers and bad practices of your stack |
| **Bugs** | wrong conditions, functions that break their callers |
| **Interface** | what breaks your design rules |

<sub>Interface runs when there are screens. Bugs advises, or blocks if you turn it on.</sub>

Your project's checks run first. What blocks goes back to be fixed and is reviewed again, without you stepping in.

**You receive work that has already been reviewed.**

## Relevo caza errores antes de que tú pruebes

Un agente construye. Después, un equipo de agentes que no escribió el código lo examina:

| Agente | Qué caza |
|---|---|
| **Spec** | escenarios sin código o sin prueba, tareas dadas por hechas |
| **Seguridad** | inyecciones, fallos de permisos, secretos expuestos |
| **Código** | pruebas débiles, restos y malas prácticas de tu stack |
| **Bugs** | condiciones mal puestas, funciones que rompen a quien las usa |
| **Interfaz** | lo que incumple tus reglas de diseño |

<sub>Interfaz corre cuando hay pantallas. Bugs avisa, o bloquea si lo activas.</sub>

Antes corren los checks de tu proyecto. Lo que bloquea vuelve a corregirse y se revisa otra vez, sin que tú intervengas.

**Tú recibes el trabajo ya revisado.**

**Middle card.** EN: "One agent builds and a team of agents reviews it." ES: "Un agente construye y un equipo de agentes lo revisa."

## Risks / Trade-offs

- ["Reviewed" can be read as "free of mistakes"] → the third handoff and the security section still say that the person tests before the merge.
- [When the retries run out the work is not handed over as passed] → the section says only what happens to what blocks, not that all of it ends fixed.
