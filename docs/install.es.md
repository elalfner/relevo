# Instalación

[English](install.md) · Español

¿Eres nuevo? [Primeros pasos](get-started.es.md) te lleva de cero a tu primer pull request fusionado, paso a paso. Esta página es la referencia de lo que necesitas.

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

Reinicia Claude Code en tu proyecto y ejecuta `/relevo:doctor` para ver qué falta todavía.

## Qué se instala

- **El plugin, y solo el plugin.** El paquete `@elalfner/relevo` contiene el manifiesto, los scripts, las skills, los agents, los perfiles de stack, las plantillas, la licencia y el aviso. No contiene la documentación, los tests, el historial de OpenSpec, el changelog ni el material de marca; léelos en línea en el [repositorio](https://github.com/elalfner/relevo).
- **Máquina o proyecto.** `claude plugin install relevo@relevo` (ámbito `user`, el predeterminado) deja los comandos disponibles en todos los proyectos de la máquina. `--scope project` declara el plugin en `.claude/settings.json` del repositorio, así que quien lo abra recibe el mismo plugin; `--scope local` lo deja solo para ti. `claude plugin marketplace update relevo` y `claude plugin update relevo@relevo` lo actualizan, y `relevo update` lo hace en un solo comando.
- **OpenSpec en una sesión web.** Una sesión de Claude Code en la web empieza en un contenedor nuevo sin OpenSpec. `/relevo:init` ofrece un hook `SessionStart` en `.claude/settings.json` que lo instala cuando falta (`npm install --global @fission-ai/openspec`), solo en una sesión remota; sube el archivo. Sin él, `go` se detiene con el comando de instalación en lugar de seguir sin OpenSpec.
- **En los workflows.** Cada workflow descarga el mismo paquete en la versión que fija (`RELEVO_VERSION`), nunca el repositorio, y se detiene con el nombre del archivo que falta si el paquete no tiene un script. La primera línea de cada workflow, `# relevo-template: X.Y.Z`, es la versión del texto del que se copió: no es la versión fijada, y subir esa versión a mano mueve los scripts pero no el texto. Para pasarlos a una versión más nueva, cambia la versión fijada en cada workflow después de leer el changelog; `relevo update` no toca tus workflows. `/relevo:doctor` avisa de un workflow sin versión fijada, con una versión distinta de la del plugin instalado, o de la época en que clonaban el repositorio.

## Otras herramientas: Antigravity

Claude Code instala el plugin por sí mismo. Otra herramienta recibe un plugin generado para ella desde las mismas fuentes, con los mismos comandos (`/relevo:go`, `/relevo:issue`, …). `relevo init` lo prepara:

```bash
relevo init
relevo init --tools claude,antigravity --scope project
```

- **Qué herramientas, y dónde.** En una terminal pregunta qué herramientas (Claude Code, Antigravity) y si el ámbito es el proyecto o la máquina, con el proyecto preseleccionado dentro de un repositorio git. `--tools`, `--scope project|machine` y `--yes` se saltan las preguntas, y sin terminal nunca espera.
- **Claude Code:** lo mismo que `relevo install`; no se genera nada para él.
- **Antigravity, proyecto:** el plugin se escribe en `.agents/plugins/relevo/`, que leen el IDE, la App y la CLI. Haz commit para compartirlo. Un archivo `.relevo-adapter.json` dentro registra la versión y un hash de cada archivo.
- **Antigravity, máquina:** el plugin se genera y se instala con `agy plugin install` (necesita la CLI de Antigravity, `agy`, en el path) en `~/.gemini/config/plugins/relevo/`.
- **Mantenlo al día.** `relevo update` vuelve a generar el plugin, y `relevo doctor` (y `/relevo:doctor`) avisan de un archivo que falta, de uno de otra versión y de uno editado a mano. `update` no sobrescribe un archivo editado salvo que pases `--force`.
- **La carpeta del plugin no puede tener un espacio** (ni un carácter de shell) en su ruta, porque las skills ejecutan sus scripts por esa ruta; el comando lo dice y no cambia nada.
- **`relevo init` no es `/relevo:init`.** El comando deja en su sitio los archivos de Relevo para una herramienta; la skill prepara las etiquetas, las reglas y los workflows del repositorio. Haz las dos cosas.
- **Qué cambia respecto de Claude Code:** la construcción en la nube y lo que puede hacer cumplir ([Seguridad](security.es.md#qué-agente-construye)), y `/relevo:go <n> --local`, que inicia `claude`, o `agy` cuando `agent.build` es `antigravity`, en un worktree aparte; en una sesión de Antigravity `/relevo:go <n>` ya construye en un worktree aislado propio. Una construcción completa con Antigravity, local o en la nube, no se ha probado de extremo a extremo.

## Qué necesitas

- **Claude Code**, donde corre el plugin.
- **Un repositorio de GitHub.** La versión 1 usa GitHub para los issues, los pull requests y las Actions.
- **Un proyecto en Flutter, Vue, Laravel o Supabase.** Son los stacks para los que Relevo trae un perfil; en Flutter, `review` funciona hoy con Android en un dispositivo (la web necesita el autopilot, que está desactivado por defecto). Los demás stacks se declaran en [Stacks y plataformas](stacks.es.md).
- **Herramientas con las que Relevo trabaja pero que no incluye:** la herramienta de línea de comandos de [OpenSpec](https://github.com/Fission-AI/OpenSpec) (Node.js 20.19 o más reciente), `git`, la CLI de GitHub (`gh`), la toolchain de tu plataforma y, para `think`, las skills que aparecen en [Comandos](commands.es.md#skills-que-usa-think). `/relevo:init` ofrece instalar lo que falte, un comando a la vez.
- **Un secreto con la clave de API del modelo** en los secretos de GitHub Actions del repositorio, para las ejecuciones sin supervisión.
- **Protección de ramas en la rama de integración.** En GitHub necesita un repositorio público o un plan de pago. Sin ella, aprobar y mergear solo se impone con la confirmación escrita que pide `ship`.
- **Alguien con permisos de administrador** que ejecute `/relevo:init` una vez.

## Primeros pasos

1. Instala el plugin como arriba y ejecuta `/relevo:doctor`.
2. Ejecuta `/relevo:init`. Muestra un plan primero, y se puede volver a ejecutar sin problema.
3. Ajusta `relevo.yml` ([Configuración](configuration.es.md)).
4. Piensa una idea con `/relevo:think`, crea los issues con `/relevo:issue` y etiquétalos `relevo:ready`. Desde ahí corre [el ciclo](how-it-works.es.md).
