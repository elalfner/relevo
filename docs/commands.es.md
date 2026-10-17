# Comandos

[English](commands.md) · Español

Se distribuye como un plugin de Claude Code llamado `relevo`:

| Comando | Qué hace |
|---|---|
| `/relevo:init` | Configura el repositorio, las etiquetas, la protección de ramas y los workflows (idempotente, muestra un plan primero) |
| `/relevo:think` | Prepara el contexto antes de que exista un issue: ejecuta la skill `openspec-explore` y después la skill `grill-with-docs`, una tras otra, en la misma conversación. Las skills hacen el trabajo; `think` solo las encadena y pasa a `issue`. `grill-with-docs` está publicada de modo que solo tú puedes lanzarla, así que cuando toca, `think` te pide que ejecutes `/grill-with-docs` en la misma conversación. No escribe archivos: las entradas de glosario y los registros de decisión que se acuerdan viajan en la sección `Documentation` del issue, así nadie tiene que subirlos a mano |
| `/relevo:issue` | Convierte una idea en issues que pasan la comprobación de spec: pregunta solo lo que falta, comprueba, muestra y luego crea (nunca inicia una construcción). Con el número de un issue lo reescribe, solo mientras no esté en cola, en construcción ni construido |
| `/relevo:go` | Construye un issue listo: comprobación de spec, construcción, QA con un reintento (se ejecuta solo en la nube) |
| `/relevo:review` | Revisión guiada en dispositivo: la persona maneja, el agente captura y audita los logs |
| `/relevo:fix` | Corrige lo que salió de la revisión, actualizando primero la spec |
| `/relevo:ship` | Verifica la aprobación, archiva la spec, mergea y cierra el ciclo |
| `/relevo:status` | Quién espera a quién, más un resumen diario |
| `/relevo:doctor` | Comprueba que el entorno y los ajustes del repositorio son correctos |

## Skills que usa `think`

`/relevo:think` no reimplementa nada: ejecuta directamente dos skills que ya existen, así que su comportamiento es exactamente el de ellas.

| Skill | Viene de | Papel en `think` |
|---|---|---|
| `openspec-explore` | [OpenSpec](https://github.com/Fission-AI/OpenSpec) (`openspec init`) | explora la idea y el código |
| `grill-with-docs` | [mattpocock/skills](https://github.com/mattpocock/skills) | te entrevista hasta que cada decisión está tomada; la lanzas tú con `/grill-with-docs` cuando `think` te lo pide, porque su autor la reservó para la persona; las entradas de glosario y de registros de decisión que acuerda se entregan a `create`, no se escriben |
| `grilling`, `domain-modeling` | [mattpocock/skills](https://github.com/mattpocock/skills) | las usa `grill-with-docs` |

El plugin no las contiene: lo que copia `/plugin install` es `skills/`, `agents/` y `templates/`. Instálalas en tu proyecto (`openspec init` y `npx skills add mattpocock/skills`); si falta una, `think` se detiene y dice cuál.

Este repositorio sí guarda copias para trabajar en él: las skills y los comandos de OpenSpec bajo `.claude/` (generados por OpenSpec 1.14.1; se refrescan con `openspec update`) y las skills de mattpocock/skills bajo `.agents/skills/`, enlazadas desde `.claude/skills/` (instaladas con `npx skills add`, fijadas en `skills-lock.json`). Sus avisos de licencia están en [NOTICE](../NOTICE).
