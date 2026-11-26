<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/svg/relevo-lockup-horizontal-white.svg">
  <img alt="Relevo" src="docs/brand/svg/relevo-lockup-horizontal-black.svg" width="420">
</picture>

# Deja de cuidar al agente. Empieza a entregar.

**Orquestador de agentes de IA, del issue al merge**

Mientras revisas uno, ya se construye el siguiente.

[English](README.md) · Español · [Documentación](docs/README.es.md)

<picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/animation/relevo-logo-animated-white.svg"><img alt="Relevo" src="docs/brand/animation/relevo-logo-animated-black.svg" width="220"></picture>

</div>

```bash
claude plugin marketplace add elalfner/relevo --sparse .claude-plugin
claude plugin install relevo@relevo
```

Reinicia Claude Code en tu proyecto y ejecuta `/relevo:doctor` para ver qué falta todavía. Qué necesitas y los primeros pasos están en [Instalación](docs/install.es.md).

Necesitas: Claude Code, git, GitHub y su CLI, Node 20.19 o superior y OpenSpec.

<details>
<summary>¿Prefieres un solo comando? Usa npm</summary>

`npm install -g @elalfner/relevo` te da `relevo install`, que pregunta dónde instalarlo (el proyecto viene preseleccionado; `relevo install --scope project` se salta la pregunta), `relevo update` y `relevo doctor`.

```bash
npm install -g @elalfner/relevo
relevo install
```

</details>

<div align="center">

`Claude Code` · `Spec-driven` · `Multi-agent` · `MIT`

| 100+ | 5 | 100 mil+ |
|:---:|:---:|:---:|
| pull requests mergeados en proyectos reales | agentes de IA que revisan tu código | líneas en el proyecto más grande donde se usa |

[Cómo se contaron](docs/pilot-findings.md#use-on-real-projects-measured-2026-11-25) (en inglés)

</div>

## Relevo caza errores antes de que tú pruebes

<div align="center">

<picture><source media="(prefers-color-scheme: dark)" srcset="docs/cover/qa-es-white.svg"><img alt="Un agente construye, corren tus checks y un equipo de agentes que no escribió el código examina el trabajo: Spec, Seguridad, Código, Bugs e Interfaz. Lo que bloquea se corrige y se revisa otra vez; después lo recibes tú." src="docs/cover/qa-es-black.svg" width="480"></picture>

<sub>Interfaz corre cuando hay pantallas. Bugs avisa, o bloquea si lo activas.</sub>

</div>

Antes corren los checks de tu proyecto. Lo que bloquea vuelve a corregirse y se revisa otra vez, sin que tú intervengas.

## Una cola que no te deja esperando

Pide el build de varios issues y la cola se encarga. Tú pruebas lo que ya está listo mientras los agentes avanzan en la nube.

<div align="center">

<picture><source media="(prefers-color-scheme: dark)" srcset="docs/cover/queue-es-white.svg"><img alt="Los agentes construyen los issues 1, 2 y 3; tú revisas cada uno mientras se construye el siguiente" src="docs/cover/queue-es-black.svg" width="640"></picture>

</div>

- Espera las dependencias antes de empezar.
- Retiene issues que nombran el mismo archivo, para evitar conflictos.
- Frena si ya tienes demasiado sin revisar.
- Si se agota el límite de uso del modelo, reintenta más tarde.
- Lo urgente se adelanta.

## Un relevo entre tú y tus agentes

<table>
<tr>
<td align="center" valign="top" width="33%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-think-white.svg"><img alt="think" src="docs/brand/states/relevo-state-think-black.svg" width="96"></picture><br><b>Tú piensas</b><br>Decides qué construir y apruebas el issue.<br><code>/relevo:think</code></td>
<td align="center" valign="top" width="33%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-go-white.svg"><img alt="go" src="docs/brand/states/relevo-state-go-black.svg" width="96"></picture><br><b>Los agentes entregan</b><br>Un agente construye y un equipo de agentes lo revisa.<br><code>/relevo:go</code></td>
<td align="center" valign="top" width="33%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-review-white.svg"><img alt="review" src="docs/brand/states/relevo-state-review-black.svg" width="96"></picture><br><b>Tú decides</b><br>Pruebas, pides correcciones o apruebas el merge.<br><code>/relevo:review</code></td>
</tr>
</table>

## ¿Por qué usar Relevo?

- **Tú tienes la última palabra.** Aprobar y mergear son decisiones de una persona.
- **Siempre sabes qué sigue.** Cada traspaso dice qué pasó, qué se espera de ti y qué comando correr.
- **Se adapta a tu proyecto.** Tus reglas, tus checks, tus límites. En la nube o en tu máquina.

## Tu código, bajo control

- El agente no aprueba ni mergea: eso lo hace una persona.
- Construye sin acceso a la web y con una lista cerrada de herramientas.
- Rutas protegidas, archivos de secretos restringidos y escaneo de credenciales antes de cada commit.
- Límites por ejecución que tú configuras.

Y tú revisas antes del merge. Conoce a fondo las protecciones en el [modelo de seguridad](docs/security.es.md).

## Preguntas frecuentes

<details open>
<summary><b>¿Sirve para proyectos grandes?</b></summary>

Sí. Se usa en un código de más de 100 mil líneas. En proyectos así conviene ajustar los checks y los límites de cada ejecución.

</details>

<details>
<summary><b>¿Puede mergear sin mí?</b></summary>

No. El merge lo pide una persona. Para exigir además la aprobación de otra, activa la revisión y la protección de ramas de GitHub (en repos privados depende de tu plan).

</details>

<details>
<summary><b>¿Cuánto cuesta?</b></summary>

Relevo es MIT y gratuito. Pagas el modelo, con una API key o tu suscripción, y el runner si usas la nube de GitHub. Con API key, el límite de costo por ejecución es un tope real.

</details>

<details>
<summary><b>¿Mi código sale de mi infraestructura?</b></summary>

El código que lee el agente se envía al proveedor del modelo, también si el build corre en tu propio runner. Relevo no agrega un servidor propio.

</details>

<details>
<summary><b>¿Y si un build falla a la mitad?</b></summary>

El issue dice qué pasó y qué hacer. Cuando se detiene por un límite o por QA, el trabajo hecho se guarda en su rama.

</details>

<br>

<details>
<summary><b>¿Qué significa el logo de Relevo? (y todos sus comandos)</b></summary>

<div align="center">

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

</details>

> **Estado: en uso en proyectos reales.** Antes de la 1.0, la configuración y los comandos pueden cambiar entre versiones; el [changelog](CHANGELOG.md) marca los cambios que rompen.

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
