# Configuración

[English](configuration.md) · Español

Relevo lee su comportamiento de un `relevo.yml` por repositorio, en la raíz. `/relevo:init` lo crea y lo actualiza. Nunca pongas en él claves de API ni tokens: van en el almacén de secretos del repositorio.

Valida el archivo con:

```bash
node scripts/validate-config.mjs relevo.yml
```

La plantilla que se distribuye, con un comentario en cada línea, es [templates/relevo.yml](../templates/relevo.yml). Las reglas están en [la especificación](../openspec/specs/configuration/spec.md), escrita en inglés.

| Ajuste | Qué controla | En la plantilla |
|---|---|---|
| `branches.base` | rama de integración: los pull requests de las features apuntan a ella | `dev` |
| `branches.release` | rama de publicación, que se promueve desde la base en un pull request aparte | `main` |
| `links` | repositorios de los que un issue puede depender con `Depends-on: owner/repo#N` (una lista cerrada); uno privado se lee con el secreto de solo lectura `RELEVO_LINKS_TOKEN` | ninguno |
| `tracker`, `git_provider`, `platforms` | dónde viven los issues y los pull requests, y las plataformas que se construyen ([Stacks y plataformas](stacks.es.md)); la línea anterior `platform: flutter-android` sigue funcionando | `github`, `github`, una plataforma Flutter para Android |
| `team.members` | usuarios de GitHub de las personas que construyen y revisan | vacío |
| `team.spec_writer` | quién escribe las specs; nunca revisa ni mergea | ninguno |
| `team.approvers` | quién puede aprobar, solo se usa cuando `review.mode` es `roles` | vacío |
| `review.mode` | `none` (en solitario), `peer` o `roles` | `peer` |
| `review.merger` | quién ejecuta `/relevo:ship`: `author` o `approver` | `approver` |
| `review.autopilot` | cuánto de la revisión puede conducir el agente: `off` (la persona lo hace todo), `precheck` (el agente recorre las líneas y anota su resultado; la persona confirma cada línea) o `verify` (el agente también puede marcar las líneas que probó con una aserción, un finder semántico o el log; la persona confirma el resto y da el acuerdo) | `off` |
| `review.allowed_origins` | orígenes web que una revisión conducida puede visitar además de `localhost`, por ejemplo `https://staging.example.com` | `[]` |
| `limits.built_unreviewed_per_person` | issues construidos que una persona puede tener esperando | 2 |
| `limits.concurrent_agents` | ejecuciones sin supervisión a la vez | 3 |
| `limits.review_sla_hours` | horas antes de un recordatorio, y el mismo tiempo otra vez antes de escalar | 8 |
| `limits.run_max_turns` | turnos por ejecución sin supervisión | 100 |
| `limits.building_alert_hours` | horas sin actividad antes de reportar como atascado un issue en `building` ([Dónde corre `go`](execution.es.md)) | 3 |
| `limits.run_max_cost` | **obligatorio**: dólares por ejecución sin supervisión; elige el tuyo | 5 |
| `qa.retries` | intentos del desarrollador después de que QA rechaza | 1 |
| `qa.rules_from` | reglas del proyecto que QA lee en cada ejecución: un archivo o una lista | `CLAUDE.md` |
| `evidence.policy` | `attach_to_pr`, o `local_only` para datos sensibles | `attach_to_pr` |
| `digest.issue` | número del issue donde se publica el resumen diario como comentario | ninguno |
| `language` | idioma de los mensajes de traspaso (`en`, `es`) | `en` |
| `trust` | `private-team` o `public` | `private-team` |
| `labels` | renombra cualquier etiqueta; las claves son fijas, los nombres son tuyos | `relevo:ready`, `relevo:built`, … |
