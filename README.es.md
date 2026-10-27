<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/svg/relevo-lockup-horizontal-white.svg">
  <img alt="Relevo" src="docs/brand/svg/relevo-lockup-horizontal-black.svg" width="420">
</picture>

**Un flujo automático de issue a merge donde agentes de IA construyen y las personas verifican.**

[English](README.md) · Español · [Documentación](docs/README.es.md)

</div>

> *Relevo* viene del relevo de las carreras. El issue entra, los agentes de IA construyen y revisan el trabajo en la nube, y tú solo intervienes para pensar, probar en un dispositivo real y decidir. Cada paso es un traspaso: el agente le pasa el testigo a una persona, y esa persona se lo pasa a un par.

> **Estado: desarrollo temprano.** Todos los comandos de abajo existen. El ciclo en solitario (`go`, `review`, `ship`) se ejecutó una vez en un repositorio real y un dispositivo Android real; las funciones de equipo (revisión entre pares, recordatorios y escalada de revisiones, selección de revisor) están cubiertas solo por pruebas y todavía no se han usado con un equipo real. Consulta los [hallazgos de los pilotos](docs/pilot-findings.md), escritos en inglés.

## Instalación

Relevo es un plugin de Claude Code. En una terminal:

```bash
claude plugin marketplace add elalfner/relevo --sparse .claude-plugin
claude plugin install relevo@relevo
```

Eso lo instala para todos los proyectos de la máquina. Para instalarlo solo en un repositorio, añade `--scope project` al segundo comando (compartido con el equipo en `.claude/settings.json`) o `--scope local` (solo para ti). Solo se instala el plugin (scripts, skills, agents, perfiles de stack y plantillas); la documentación está en línea.

Un atajo, si prefieres un solo comando: `npm install -g @elalfner/relevo` te da `relevo install`, que pregunta dónde instalarlo (el proyecto viene preseleccionado; `relevo install --scope project` se salta la pregunta), `relevo update` y `relevo doctor`.

```bash
npm install -g @elalfner/relevo
relevo install
```

Para usar Relevo desde Antigravity (el IDE, la App o la CLI), ejecuta `relevo init`: pregunta qué herramientas usa tu equipo e instala un plugin generado para cada una. Los detalles están en [Instalación](docs/install.es.md#otras-herramientas-antigravity).

Reinicia Claude Code en tu proyecto y ejecuta `/relevo:doctor` para ver qué falta todavía. Qué necesitas y los primeros pasos están en [Instalación](docs/install.es.md).

## Cómo funciona

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/animation/relevo-logo-animated-white.svg">
  <img alt="Relevo" src="docs/brand/animation/relevo-logo-animated-black.svg" width="220">
</picture>

*El logo es el flujo: el issue entra por la izquierda, los agentes de IA trabajan dentro del círculo y la feature sale por la derecha. El círculo se llena de negro solo cuando una persona tiene el testigo: pensar y revisar.*

</div>

|  | Comando | Qué hace |
|:---:|---|---|
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-init-white.svg"><img alt="init" src="docs/brand/states/relevo-state-init-black.svg" width="72"></picture> | `/relevo:init` | Configura tu repositorio una sola vez: config, etiquetas, protección de ramas y workflows. |
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-feature-white.svg"><img alt="feature" src="docs/brand/states/relevo-state-feature-black.svg" width="72"></picture> | **feature** | No es un comando, pero es el motivo de todo este flujo: el concepto de lo que quieres lograr. Cada ciclo empieza aquí, y todo lo demás lo convierte de idea en trabajo entregado. |
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-think-white.svg"><img alt="think" src="docs/brand/states/relevo-state-think-black.svg" width="72"></picture> | `/relevo:think` | Tú y la IA exploran la idea y acuerdan cada decisión antes de que exista un issue. |
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-issue-white.svg"><img alt="issue" src="docs/brand/states/relevo-state-issue-black.svg" width="72"></picture> | `/relevo:issue` | Convierte la idea en issues que pasan la comprobación de spec, o reescribe un issue que aún no se está construyendo. |
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-go-white.svg"><img alt="go" src="docs/brand/states/relevo-state-go-black.svg" width="72"></picture> | `/relevo:go` | Los agentes de IA construyen el issue y QA lo revisa, automáticamente en la nube, sin que nadie espere. |
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-review-white.svg"><img alt="review" src="docs/brand/states/relevo-state-review-black.svg" width="72"></picture> | `/relevo:review` | Pruebas en un dispositivo real mientras el agente captura y audita los logs. |
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-fix-white.svg"><img alt="fix" src="docs/brand/states/relevo-state-fix-black.svg" width="72"></picture> | `/relevo:fix` | Corrige lo que encontró la revisión, actualizando primero la spec. |
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-ship-white.svg"><img alt="ship" src="docs/brand/states/relevo-state-ship-black.svg" width="72"></picture> | `/relevo:ship` | Verifica la aprobación, archiva la spec, mergea y cierra el ciclo. |

Además, `/relevo:status` (quién espera a quién) y `/relevo:doctor` (comprueba tu configuración). Todos los comandos, en detalle: [Comandos](docs/commands.es.md). Una corrida real, de la idea al pull request mergeado: [Cómo funciona](docs/how-it-works.es.md).

## Por qué Relevo

- **Primero las specs.** El agente construye contra issues detallados, y QA compara el diff contra ellos.
- **Se jala, no se empuja.** Un límite de trabajo en curso por persona evita que el agente entierre al equipo en ramas sin revisar.
- **Deciden las personas.** Aprobar y mergear son actos humanos explícitos, impuestos por la protección de ramas y nunca solo por un prompt.
- **Cada traspaso es un solo mensaje** que dice qué pasó, qué se espera de ti y qué comando ejecutar después.

## Documentación

- [Primeros pasos](docs/get-started.es.md): de cero a tu primer pull request fusionado, paso a paso.
- [Instalación](docs/install.es.md): qué necesitas y los primeros pasos.
- [Actualizar](docs/upgrading.es.md): pasar un proyecto a una versión nueva, en el orden correcto.
- [Cómo funciona](docs/how-it-works.es.md): la idea, y una corrida real de la idea al pull request mergeado.
- [Comandos](docs/commands.es.md): los nueve comandos, y las skills que usa `think`.
- [Configuración](docs/configuration.es.md): el archivo `relevo.yml`.
- [Stacks y plataformas](docs/stacks.es.md): declara tus plataformas y agrega tus propias reglas.
- [Dónde corre `go`](docs/execution.es.md): la nube, tu máquina o ambas, y las dos credenciales.
- [Guía](docs/guide.es.md): qué hacer después, y qué hacer cuando algo sale mal.
- [Modelo de seguridad](docs/security.es.md): qué protege Relevo y qué no.
- [Toda la documentación](docs/README.es.md): referencia, cómo se construyó y la marca.

## Agradecimientos

Relevo se apoya en [OpenSpec](https://github.com/Fission-AI/OpenSpec) y en [mattpocock/skills](https://github.com/mattpocock/skills), ambos con licencia MIT. Sus avisos están en [NOTICE](NOTICE).

## Licencia

[MIT](LICENSE) para el software y la documentación. El nombre y el logo de Relevo no están cubiertos por ella: consulta [TRADEMARKS.es.md](TRADEMARKS.es.md).
