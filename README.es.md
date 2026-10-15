# Relevo

**Un flujo automático de issue a merge donde un agente construye y las personas verifican.**

[English](README.md) · Español

> *Relevo* viene del relevo de las carreras. Cada paso del flujo es un traspaso: el agente le pasa el testigo a una persona, y esa persona se lo pasa a un par.

> **Estado: desarrollo temprano.** Todos los comandos de abajo existen. El ciclo en solitario (`go`, `review`, `ship`) se ejecutó una vez en un repositorio real y un dispositivo Android real; las funciones de equipo (revisión entre pares, recordatorios y escalada de revisiones, selección de revisor) están cubiertas solo por pruebas y todavía no se han usado con un equipo real. Consulta los [hallazgos de los pilotos](docs/pilot-findings.md), escritos en inglés.

## Instalación

Relevo es un plugin de Claude Code. En una terminal:

```bash
claude plugin marketplace add elalfner/relevo
claude plugin install relevo@relevo
```

Reinicia Claude Code en tu proyecto y ejecuta `/relevo:doctor` para ver qué falta todavía.

Relevo funciona junto con algunas herramientas que no incluye: la herramienta de línea de comandos de [OpenSpec](https://github.com/Fission-AI/OpenSpec), `git`, la CLI de GitHub (`gh`), la toolchain de tu plataforma y, para `think`, las skills que aparecen [más abajo](#skills-que-usa-think). `/relevo:init` ofrece instalar lo que falte, un comando a la vez.

## La idea

Escribir código ya no es lo lento. Verificarlo sí. Relevo pone al agente donde es rápido (construir y revisarse a sí mismo) y a las personas donde son insustituibles (probar en un dispositivo real, revisar el trabajo de un par, decidir si se mergea).

```
 quien escribe      agente (nube)           responsable           par
 las specs          construye + QA          revisa en dispositivo aprueba + mergea
 issues listos  ──► sin esperar a nadie ──► corrige, abre PR  ──► y cierra el ciclo
 en un milestone
```

- **Primero las specs.** La entrada son issues detallados, listos para construir. El agente construye contra ellos y QA compara el diff contra ellos.
- **Se jala, no se empuja.** Un límite de trabajo en curso por persona evita que el agente entierre al equipo en ramas sin revisar.
- **Deciden las personas.** Aprobar y mergear son actos humanos explícitos, impuestos por la protección de ramas y nunca solo por un prompt.
- **Cada traspaso es un solo mensaje** que dice qué pasó, qué se espera de ti y qué comando ejecutar después.

## Velo funcionar

Una corrida real en el [sandbox](https://github.com/elalfner/relevo-sandbox), una app Flutter pequeña, para el [issue #5](https://github.com/elalfner/relevo-sandbox/issues/5), "Show the build number". Una sola persona hizo todos los roles.

| Paso | La persona | Relevo | Tiempo |
|---|---|---|---|
| 1 | piensa la idea (la exploración y la entrevista que ejecuta `/relevo:think`) y aprueba el texto del issue | explora el código, pregunta hasta que cada decisión está tomada y redacta el issue: escenarios, casos borde y el vocabulario nuevo en una sección `Documentation` | una conversación |
| 2 | etiqueta el issue `relevo:ready` | el trabajo ligero `decide` aplica los gates y reclama el issue | 17 s |
| 3 | nada | el trabajo `build` escribe la especificación, el código y las pruebas, y QA los revisa | 3 min 35 s |
| 4 | lee el traspaso y ejecuta `/relevo:review 5` en un teléfono | captura pantallas, audita el log y abre el [pull request](https://github.com/elalfner/relevo-sandbox/pull/16) | unos minutos |
| 5 | ejecuta `/relevo:ship 5` y confirma | mergea, archiva la especificación y cierra el issue | segundos |

El traspaso que el agente dejó en el issue, abreviado (los mensajes los escribe Relevo en el idioma que configures; este está en inglés):

```
@elalfner #5 "Show the build number" is built ✅

What happened: 11 of 11 tasks done, QA passed.
Branch: feature/5-show-the-build-number
What to test: 8 scenarios (checklist below)
Riskiest area, check it first: The real build number from an APK through the
Android package_info_plus plugin (tests only use the mock), and how the two
texts look on a small physical device.
Your next step: /relevo:review 5
```

Las entradas del glosario que salieron de la conversación viajaron dentro del issue y llegaron en el mismo pull request que la funcionalidad, así que nadie subió documentación a mano. La revisión entre pares, los recordatorios y la selección de revisor necesitan una segunda persona y no formaron parte de esta corrida.

## Comandos

Se distribuye como un plugin de Claude Code llamado `relevo`:

| Comando | Qué hace |
|---|---|
| `/relevo:init` | Configura el repositorio, las etiquetas, la protección de ramas y los workflows (idempotente, muestra un plan primero) |
| `/relevo:think` | Prepara el contexto antes de que exista un issue: ejecuta la skill `openspec-explore` y después la skill `grill-with-docs`, una tras otra, en la misma conversación. Las skills hacen el trabajo; `think` solo las encadena y pasa a `create`. No escribe archivos: las entradas de glosario y los registros de decisión que se acuerdan viajan en la sección `Documentation` del issue, así nadie tiene que subirlos a mano |
| `/relevo:create` | Convierte una idea en issues que pasan la comprobación de spec: pregunta solo lo que falta, comprueba, muestra y luego crea (nunca inicia una construcción) |
| `/relevo:go` | Construye un issue listo: comprobación de spec, construcción, QA con un reintento (se ejecuta solo en la nube) |
| `/relevo:review` | Revisión guiada en dispositivo: la persona maneja, el agente captura y audita los logs |
| `/relevo:fix` | Corrige lo que salió de la revisión, actualizando primero la spec |
| `/relevo:ship` | Verifica la aprobación, archiva la spec, mergea y cierra el ciclo |
| `/relevo:status` | Quién espera a quién, más un resumen diario |
| `/relevo:doctor` | Comprueba que el entorno y los ajustes del repositorio son correctos |

## Configuración

Un `relevo.yml` por repositorio: ramas, revisores, límites de trabajo en curso, política de evidencias, etiquetas e idioma.

## Construido con OpenSpec y mattpocock/skills

Relevo se especificó y se construyó como pide que trabajes: con [OpenSpec](https://github.com/Fission-AI/OpenSpec) (licencia MIT), primero la spec, luego el código y luego el piloto.

- El diseño vive en `openspec/`. [`changes/relevo-v1`](openspec/changes/relevo-v1) contiene la propuesta, las decisiones de diseño (D1 a D16, cada una con las alternativas que se descartaron), doce especificaciones y la lista de tareas. Los cambios posteriores, como `glossary-travels-with-the-issue`, siguen el mismo camino, y los terminados se archivan en `openspec/changes/archive/`.
- El historial muestra cómo fue creciendo: los commits y los pull requests, y los dos pilotos documentados en [docs/pilot-findings.md](docs/pilot-findings.md), con lo que falló y cómo se arregló. El [sandbox](https://github.com/elalfner/relevo-sandbox) es una app Flutter pequeña donde corrió el ciclo completo, y sigue ahí para leerse.
- El pensamiento se hizo con las skills de [mattpocock/skills](https://github.com/mattpocock/skills) (licencia MIT), las mismas que `/relevo:think` ejecuta por ti.

OpenSpec y esas skills son también con lo que trabaja el plugin: `think` las ejecuta, y `go` y `ship` usan la línea de comandos de OpenSpec para escribir y archivar la especificación de cada issue. Las copias que guarda este repositorio son herramientas de desarrollo y no forman parte del plugin (ver abajo).

## Skills que usa `think`

`/relevo:think` no reimplementa nada: ejecuta directamente dos skills que ya existen, así que su comportamiento es exactamente el de ellas.

| Skill | Viene de | Papel en `think` |
|---|---|---|
| `openspec-explore` | [OpenSpec](https://github.com/Fission-AI/OpenSpec) (`openspec init`) | explora la idea y el código |
| `grill-with-docs` | [mattpocock/skills](https://github.com/mattpocock/skills) | te entrevista hasta que cada decisión está tomada; las entradas de glosario y de registros de decisión que acuerda se entregan a `create`, no se escriben |
| `grilling`, `domain-modeling` | [mattpocock/skills](https://github.com/mattpocock/skills) | las usa `grill-with-docs` |

El plugin no las contiene: lo que copia `/plugin install` es `skills/`, `agents/` y `templates/`. Instálalas en tu proyecto (`openspec init` y `npx skills add mattpocock/skills`); si falta una, `think` se detiene y dice cuál.

Este repositorio sí guarda copias para trabajar en él: las skills y los comandos de OpenSpec bajo `.claude/` (generados por OpenSpec 1.14.1; se refrescan con `openspec update`) y las skills de mattpocock/skills bajo `.agents/skills/`, enlazadas desde `.claude/skills/` (instaladas con `npx skills add`, fijadas en `skills-lock.json`). Sus avisos de licencia están en [NOTICE](NOTICE).

## Agradecimientos

Relevo se apoya en [OpenSpec](https://github.com/Fission-AI/OpenSpec) y en [mattpocock/skills](https://github.com/mattpocock/skills), ambos con licencia MIT. Sus avisos están en [NOTICE](NOTICE).

## Licencia

[MIT](LICENSE)
