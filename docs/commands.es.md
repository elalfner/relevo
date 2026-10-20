# Comandos

[English](commands.md) · Español

Se distribuye como un plugin de Claude Code llamado `relevo`:

| Comando | Qué hace |
|---|---|
| `/relevo:init` | Configura el repositorio (incluidas las [plataformas y sus stacks](stacks.es.md)), las etiquetas, la protección de ramas y los workflows (idempotente, muestra un plan primero) |
| `/relevo:think` | Prepara el contexto antes de que exista un issue: ejecuta la skill `openspec-explore` y después la skill `grill-with-docs`, una tras otra, en la misma conversación. Las skills hacen el trabajo; `think` solo las encadena y pasa a `issue`. `grill-with-docs` está publicada de modo que solo tú puedes lanzarla, así que cuando toca, `think` te pide que ejecutes `/grill-with-docs` en la misma conversación. No escribe archivos: las entradas de glosario y los registros de decisión que se acuerdan viajan en la sección `Documentation` del issue, así nadie tiene que subirlos a mano |
| `/relevo:issue` | Convierte una idea en issues que pasan la comprobación de spec: pregunta solo lo que falta, comprueba, muestra y luego crea (nunca inicia una construcción). Con el número de un issue lo reescribe, solo mientras no esté en cola, en construcción ni construido |
| `/relevo:go` | Construye un issue listo: comprobación de spec, construcción, QA con un reintento (se ejecuta solo en la nube). Verifica que el texto del issue sea el aprobado, rechaza las rutas protegidas y dice qué hacer cuando la rama ya existe |
| `/relevo:review` | Revisión guiada en dispositivo: la persona maneja, el agente captura y audita los logs |
| `/relevo:fix` | Corrige lo que salió de la revisión, actualizando primero la spec |
| `/relevo:ship` | Verifica la aprobación, archiva la spec, mergea y cierra el ciclo |
| `/relevo:status` | Quién espera a quién, más un resumen diario |
| `/relevo:doctor` | Comprueba que el entorno y los ajustes del repositorio son correctos, incluidas las herramientas y skills que pide cada [perfil de stack](stacks.es.md) |

## El formato del issue

`/relevo:issue` escribe el issue y `/relevo:go` lo construye, así que el issue es lo único que recibe quien construye. Además de los escenarios y los casos borde, puede llevar lo que el acuerdo dejó decidido, en secciones opcionales: `Outcome`, `Decisions` (cada una con un id `D1`, lo decidido, el porqué y lo descartado), `Constraints` (`C1`), `Code pointers`, `Verification`, `Assumptions` y `Open questions`. `go` las copia palabra por palabra al diseño del cambio, y QA rechaza una construcción que rompa una decisión o una restricción, citando su id. Un issue con una pregunta abierta, o con el texto `NEEDS CLARIFICATION`, vuelve a quien lo escribió como ambiguo. El formato está en [Writing an issue Relevo can build](issue-format.md).

- `/relevo:think` escribe lo que dejó decidido con ids antes de pedirte que ejecutes la entrevista, y `/relevo:issue` muestra una tabla de qué id fue a qué sección; un id solo se descarta si tú lo dices.
- `/relevo:think #42` parte de un issue que volvió con una pregunta abierta.
- Tras crear los issues, `/relevo:issue` hace una pregunta aparte: ¿pongo `ready` ahora? Nada empieza sin tu sí.
- Antes de redactar, `/relevo:issue` busca issues abiertos parecidos.
- `/relevo:review` empieza con un resumen corto (qué se pidió, el resultado, qué revisar primero) calculado a partir del issue.

## Qué comprueban `fix` y `ship`

`fix` y `ship` cambian una rama después de que una persona la miró, así que las reglas que no deben variar están en scripts.

- **Una corrección que QA rechaza se guarda, no se pierde.** Tras los reintentos, `fix` guarda el trabajo en un stash llamado `relevo-fix #<n> iteration <k>` y deja el árbol limpio. El siguiente `/relevo:fix <n>` te lo ofrece de vuelta (el stash existe solo en esa copia del repositorio). Un conflicto al restaurar se detiene y conserva el stash; descartarlo necesita tu confirmación escrita.
- **Una rama que solo tiene la especificación no se "corrige".** `fix` dice que borres la rama remota y vuelvas a aplicar `relevo:ready`.
- **La lista de tareas se comprueba.** Antes del desarrollador, las únicas tareas abiertas son las correcciones; una empieza por `Test:` (un test de regresión), salvo que todas las correcciones terminen con `(device only)`. Tras QA, no queda ninguna abierta.
- **`ship` se puede ejecutar otra vez.** Si el cambio ya está archivado en la rama, `ship` sigue desde el merge. Si el archivo deja conflictos solo dentro de `openspec/`, revierte el commit de archivo, trae la rama base y archiva de nuevo, con pushes normales. Un conflicto en código lo detiene.
- **Una aprobación vale para el código que vio.** Una aprobación dada sobre un commit anterior no cuenta; tras el commit de archivo, sigue contando la dada sobre la cabeza registrada al empezar.
- **El issue debe estar en `pr-open`**, y `ship` nombra el comando que falta (`/relevo:review` o `/relevo:fix`) si no. El cambio se valida y no tiene tareas abiertas antes de archivarse.
- **Quién ejecuta `ship`.** Con `review.merger: approver`, un miembro de `team.members` que no sea el autor ni quien escribe la spec (y, en modo `roles`, uno de `team.approvers`). Quien sea elegible pero no aprobó confirma por escrito que no lo hizo.

## Skills que usa `think`

`/relevo:think` no reimplementa nada: ejecuta directamente dos skills que ya existen, así que su comportamiento es exactamente el de ellas.

| Skill | Viene de | Papel en `think` |
|---|---|---|
| `openspec-explore` | [OpenSpec](https://github.com/Fission-AI/OpenSpec) (`openspec init`) | explora la idea y el código |
| `grill-with-docs` | [mattpocock/skills](https://github.com/mattpocock/skills) | te entrevista hasta que cada decisión está tomada; la lanzas tú con `/grill-with-docs` cuando `think` te lo pide, porque su autor la reservó para la persona; las entradas de glosario y de registros de decisión que acuerda se entregan a `create`, no se escriben |
| `grilling`, `domain-modeling` | [mattpocock/skills](https://github.com/mattpocock/skills) | las usa `grill-with-docs` |

El plugin no las contiene: lo que copia `/plugin install` es `skills/`, `agents/` y `templates/`. Instálalas en tu proyecto (`openspec init` y `npx skills add mattpocock/skills`); si falta una, `think` se detiene y dice cuál.

Este repositorio sí guarda copias para trabajar en él: las skills y los comandos de OpenSpec bajo `.claude/` (generados por OpenSpec 1.14.1; se refrescan con `openspec update`) y las skills de mattpocock/skills bajo `.agents/skills/`, enlazadas desde `.claude/skills/` (instaladas con `npx skills add`, fijadas en `skills-lock.json`). Sus avisos de licencia están en [NOTICE](../NOTICE).
