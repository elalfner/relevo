# Instalación

[English](install.md) · Español

¿Eres nuevo? [Primeros pasos](get-started.es.md) te lleva de cero a tu primer pull request fusionado, paso a paso. Esta página es la referencia de lo que necesitas.

Relevo es un plugin de Claude Code. En una terminal:

```bash
npm install -g @elalfner/relevo
relevo install
```

`relevo install` instala el plugin para todos los proyectos de la máquina. Para instalarlo solo en un repositorio, ejecuta `relevo install --scope project` (compartido con el equipo en `.claude/settings.json`) o `--scope local` (solo para ti). Sin npm, los dos comandos de `claude plugin` hacen lo mismo:

```bash
claude plugin marketplace add elalfner/relevo --sparse .claude-plugin
claude plugin install relevo@relevo
```

Solo se instala el plugin (scripts, skills, agents, perfiles de stack y plantillas); la documentación está en línea.

Reinicia Claude Code en tu proyecto y ejecuta `/relevo:doctor` para ver qué falta todavía.

## Qué se instala

- **El plugin, y solo el plugin.** El paquete `@elalfner/relevo` contiene el manifiesto, los scripts, las skills, los agents, los perfiles de stack, las plantillas, la licencia y el aviso. No contiene la documentación, los tests, el historial de OpenSpec, el changelog ni el material de marca; léelos en línea en el [repositorio](https://github.com/elalfner/relevo).
- **Máquina o proyecto.** `relevo install` (ámbito `user`) deja los comandos disponibles en todos los proyectos de la máquina. `--scope project` declara el plugin en `.claude/settings.json` del repositorio, así que quien lo abra recibe el mismo plugin; `--scope local` lo deja solo para ti. `relevo update` actualiza el plugin y su catálogo.
- **En los workflows.** Cada workflow descarga el mismo paquete en la versión que fija (`RELEVO_VERSION`), nunca el repositorio, y se detiene con el nombre del archivo que falta si el paquete no tiene un script. `/relevo:doctor` avisa de un workflow sin versión fijada o de la época en que clonaban el repositorio.

## Qué necesitas

- **Claude Code**, donde corre el plugin.
- **Un repositorio de GitHub.** La versión 1 usa GitHub para los issues, los pull requests y las Actions.
- **Un proyecto en Flutter, Vue o Laravel.** Son los stacks para los que Relevo trae un perfil; en Flutter, `review` funciona hoy con Android en un dispositivo (la web necesita el autopilot, que está desactivado por defecto). Los demás stacks se declaran en [Stacks y plataformas](stacks.es.md).
- **Herramientas con las que Relevo trabaja pero que no incluye:** la herramienta de línea de comandos de [OpenSpec](https://github.com/Fission-AI/OpenSpec) (Node.js 20.19 o más reciente), `git`, la CLI de GitHub (`gh`), la toolchain de tu plataforma y, para `think`, las skills que aparecen en [Comandos](commands.es.md#skills-que-usa-think). `/relevo:init` ofrece instalar lo que falte, un comando a la vez.
- **Un secreto con la clave de API del modelo** en los secretos de GitHub Actions del repositorio, para las ejecuciones sin supervisión.
- **Protección de ramas en la rama de integración.** En GitHub necesita un repositorio público o un plan de pago. Sin ella, aprobar y mergear solo se impone con la confirmación escrita que pide `ship`.
- **Alguien con permisos de administrador** que ejecute `/relevo:init` una vez.

## Primeros pasos

1. Instala el plugin como arriba y ejecuta `/relevo:doctor`.
2. Ejecuta `/relevo:init`. Muestra un plan primero, y se puede volver a ejecutar sin problema.
3. Ajusta `relevo.yml` ([Configuración](configuration.es.md)).
4. Piensa una idea con `/relevo:think`, crea los issues con `/relevo:issue` y etiquétalos `relevo:ready`. Desde ahí corre [el ciclo](how-it-works.es.md).
