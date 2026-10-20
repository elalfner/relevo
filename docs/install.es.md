# Instalación

[English](install.md) · Español

¿Eres nuevo? [Primeros pasos](get-started.es.md) te lleva de cero a tu primer pull request fusionado, paso a paso. Esta página es la referencia de lo que necesitas.

Relevo es un plugin de Claude Code. En una terminal:

```bash
claude plugin marketplace add elalfner/relevo
claude plugin install relevo@relevo
```

Reinicia Claude Code en tu proyecto y ejecuta `/relevo:doctor` para ver qué falta todavía.

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
