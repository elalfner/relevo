# Dónde corre `go`

[English](execution.md) · Español

`go` puede construir un issue en la nube, en la máquina de una persona o en las dos. No hay un ajuste para eso en `relevo.yml`: sale de lo que está instalado, de qué secreto existe y de una variable del repositorio. Esta página explica cada pieza y qué significa para los límites.

## Los tres lugares

- **Ambas** es el valor por defecto: el workflow de `go` está instalado y existe un secreto del modelo, así que una etiqueta `ready` inicia una construcción en la nube, y cualquiera puede ejecutar `/relevo:go <n>` en su máquina.
- **Solo nube** es lo mismo, con personas que eligen no construir a mano. Úsalo para construir sin que nadie espere.
- **Solo máquinas**: `/relevo:init` no agrega los workflows de `go` ni de la cola. Cada persona construye con su propia sesión de Claude y su cuota, sin ningún secreto del modelo en el repositorio.

## Pausar la nube sin un pull request

Pon la variable del repositorio `RELEVO_CLOUD_GO` en `off` (Settings > Secrets and variables > Actions > Variables). Entonces una etiqueta `ready` no inicia nada y la cola no despacha nada, y el issue se queda en `ready` para una ejecución local. Borra la variable, o pon otro valor, para reanudar, y vuelve a aplicar `relevo:ready` a cada issue: los eventos de etiqueta que se saltaron no se repiten. Tiene que ser una variable y no un archivo porque un evento de etiqueta ejecuta los workflows de la rama por defecto, así que un cambio en un archivo necesitaría antes un pull request.

Si construyes a mano con la nube encendida, la nube puede iniciar el mismo issue en cuanto lo marques `ready`: pausa primero la nube.

## Cuando la nube no tiene credencial

Un repositorio con el workflow de `go` pero sin `ANTHROPIC_API_KEY` ni `CLAUDE_CODE_OAUTH_TOKEN` no falla. El issue se queda en `ready` y un comentario dice que la nube no está configurada, nombrando `/relevo:go <n>` para una ejecución local y los dos secretos para la nube. `/relevo:doctor` lo advierte.

## Dos credenciales

| | Clave de API | Token de suscripción |
|---|---|---|
| Secreto | `ANTHROPIC_API_KEY` | `CLAUDE_CODE_OAUTH_TOKEN` (de `claude setup-token`, quitándole todos los espacios en blanco) |
| `limits.run_max_cost` | un tope real de gasto | solo un tope nocional |
| Control principal | el costo | `limits.run_max_turns` y un `limits.concurrent_agents` bajo |
| Cuando se agota | un error del proveedor | se acaba la ventana de uso de la cuenta |

- Con una suscripción la cuota se comparte entre todas las ejecuciones y el uso interactivo de la cuenta dueña del token, por eso `/relevo:init` pone `limits.concurrent_agents` en 1.
- El modo se deduce del nombre del secreto. Si existen los dos, `/relevo:doctor` avisa y dice cuál usa el workflow.
- Lee los términos vigentes de Anthropic sobre el uso automatizado de una suscripción, y el README de `claude-code-action`, antes de apoyar a un equipo en un token de suscripción. Relevo no los juzga; `/relevo:doctor` deja un recordatorio de una línea.

## Qué instala el build

El agente del build carga el plugin de Relevo del paquete que el job desempaca en la versión que fija `RELEVO_VERSION` (`--plugin-dir` en `claude_args`), no de un marketplace: una sola versión fijada decide los scripts y las skills, no se clona nada del repositorio del plugin, y un repositorio de plugin privado no necesita `RELEVO_PLUGIN_TOKEN`. Un workflow copiado de una versión anterior todavía añade el marketplace; `/relevo:init` lo actualiza. El job de build del workflow `go` instala el toolchain del stack de la plataforma del issue, para que el agente y QA puedan ejecutar las comprobaciones de tu proyecto: Flutter con `subosito/flutter-action` y PHP con Composer para Laravel con `shivammathur/setup-php`. Cada paso está protegido por el stack, así que solo corre el del issue. Vue solo necesita Node, que el job ya tiene. Cambia las versiones y la caché en `relevo-go.yml` según tu proyecto. Instalar las dependencias lo añades tú (`npm ci --ignore-scripts`, `composer install --no-scripts`), porque el gestor de paquetes y el lockfile varían. `/relevo:doctor` falla cuando una plataforma Flutter o Laravel no tiene un paso activo, porque cada build en la nube fallaría en QA después de gastar la ejecución. Como segunda guarda, el job de build comprueba, justo antes de que empiece el agente, que cada herramienta que lista el perfil de la plataforma (`flutter`; `php` y `composer`) esté en el path del runner. Si falta alguna, no se gasta ningún turno del modelo: el issue pasa a `relevo:qa-failed` con un comentario que nombra las herramientas que faltan y dice que actives el paso del toolchain y vuelvas a poner `ready` después de quitar `qa-failed`.

## Runners self-hosted

Los workflows de Relevo corren en `ubuntu-latest` salvo que `relevo.yml` nombre otro runner. Para usar el tuyo, lista sus etiquetas:

```yaml
runner:
  labels: [self-hosted, linux-build]
```

`/relevo:init` pregunta si usas un runner self-hosted y escribe las etiquetas en `relevo.yml` y en cada `runs-on` de los workflows que agrega. `runs-on` se lee antes de que corra cualquier paso, así que un workflow no puede leer `relevo.yml` por sí mismo: el archivo y los workflows tienen que coincidir, y `/relevo:doctor` falla y nombra el archivo cuando no lo hacen (por ejemplo después de editar un workflow a mano, o cuando el workflow de ship viene de una plantilla más nueva). Para cambiar el runner después, cambia `runner.labels` y cada `runs-on`.

Lo que Relevo asume del runner:

- **Tiene `git`, `gh` y `jq`.** Las imágenes de GitHub los traen y la tuya puede que no. El job de build los comprueba junto con las herramientas del stack, y un runner al que le falta una se detiene antes del agente, sin gastar un turno del modelo, con un comentario en el issue que nombra la herramienta. Node lo instala el job.
- **Conserva sus archivos entre jobs.** Relevo nunca pregunta si el runner es efímero, porque no puede comprobar la respuesta. Cada job instala OpenSpec en la carpeta temporal del job, en la versión de `OPENSPEC_VERSION`, no de forma global; la ejecución con Antigravity guarda su binario, su plugin y sus ajustes en una carpeta home del job; y un último paso, que corre aunque el job falle, quita lo que el job agregó al workspace. No limpia el resto del workspace, porque tus propios jobs pueden depender de sus cachés.
- **Los toolchains son cosa tuya.** En un runner self-hosted puedes mantener los pasos de Flutter o PHP de `relevo-go.yml` (instalan el toolchain en cada job) o preinstalar los SDK en la máquina y comentar los pasos; la comprobación del toolchain del job de build pasa de cualquier modo mientras las herramientas estén en el path. `/relevo:doctor` no ve un SDK en la máquina, así que con el paso comentado sigue reportando que el workflow de go no instala ningún toolchain; en ese caso puedes ignorar ese fallo, y conviene anotar por qué quitaste el paso.
- **Antigravity necesita Linux x86-64.** El binario fijado es `linux-x64`.

Un runner con `limits.concurrent_agents: 1` es la misma máquina que corre los checks de tus pull requests, así que un build de hasta 60 minutos los retrasa. Agrega runners con las mismas etiquetas en lugar de subir el límite.

El código del agente corre con los permisos del usuario del runner, que en tu propia máquina puede llegar a tu red. La barrera es un runner efímero o un contenedor; mira [Seguridad](security.es.md#qué-no-protege). Comprobado en un runner self-hosted: `$RUNNER_TEMP` se vacía entre jobs, pero `claude-code-action` guarda su estado en el home del usuario del runner (ajustes, cachés y las transcripciones de sus sesiones en `~/.claude/projects`), y Relevo no lo borra; límpialo tú si las transcripciones, que contienen lo que el agente leyó y escribió, no deben quedarse.

## Qué reporta una ejecución en la nube

Después de cada ejecución en la nube, un comentario da los turnos, el costo y los tokens que reporta el log del ejecutor del agente (el costo es nocional con una suscripción). Si el log no los tiene, no se publica nada. Una ejecución que se detuvo porque se alcanzó el límite de uso o el crédito lo dice y te indica volver a poner `ready` más tarde; cualquier otro fallo conserva el comentario genérico con el enlace a la ejecución.

Ese mismo comentario lleva un marcador oculto con esas cifras, que el resumen diario suma: termina con una línea como `Uso, últimos 7 días: 3 ejecuciones, 35 turnos, unos $3.75, 1350 tokens.` y dice cuándo el costo es nocional (en todas las ejecuciones, o `nocional en 1 de 2 ejecuciones`). Solo cuentan las ejecuciones de los últimos siete días que dejaron marcador. Las hechas antes de que tu proyecto suba `RELEVO_VERSION` a la versión que escribe el marcador no lo tienen y no se cuentan, y las cifras nunca se deducen del texto del comentario, así que la línea se va llenando durante la primera semana. El resumen sigue sin publicarse cuando nadie espera nada, sea cual sea el uso.

## Construir en tu máquina

```bash
/relevo:go 42 --local
```

Ejecuta `scripts/go-local.mjs` del plugin, que ejecuta `claude -p "/relevo:go 42"` (o `agy -p` cuando `agent.build: antigravity`) en un git worktree separado junto a tu repositorio, así que tus cambios sin commitear no importan, con los mismos límites de turnos y costo y las mismas listas cerradas de herramientas que el workflow. El worktree se borra cuando la ejecución termina bien y se conserva, imprimiendo su ruta, cuando no. `--dry-run` muestra lo que haría.

En una sesión de Claude Code, ejecutar `/relevo:go <issue>` sin `--local` también construye en un worktree propio, así que puedes correr dos a la vez y seguir trabajando en tu checkout. La skill lo crea con `scripts/go-worktree.mjs` (junto a tu repositorio, en `.relevo-worktrees/`, desde `origin/<base>`, el mismo lugar que `--local`), entra en él y construye ahí; ves la construcción en tu sesión. Cuando el issue termina `built`, o una compuerta lo detiene antes de construir nada, el worktree se borra; tras una ejecución fallida se conserva y se imprime su ruta. Si el worktree de ese issue ya existe (otra ejecución lo está construyendo, o una fallida lo dejó) la ejecución se detiene y te dice el comando que lo borra. Dentro de un worktree que ya existe, como el de `--local`, construye donde está. Usa `--local` cuando quieras la construcción en su propio proceso con las listas cerradas de herramientas del workflow. `/relevo:review` sigue corriendo en tu checkout principal.

En sesiones interactivas de chat de Antigravity, ejecutar `/relevo:go <issue>` ejecuta la construcción dentro de un subagente aislado con `Workspace: 'share'`. Esto genera un worktree efímero automático, permitiendo que múltiples chats construyan issues concurrentemente sin colisiones de ramas ni de OpenSpec. La raíz del repositorio se mantiene limpia en la rama base, reservada para el desarrollador y para sesiones interactivas de `/relevo:review` con dispositivos conectados. Al abrir el pull request, `review` devuelve la raíz a la rama base, solo en el checkout principal y solo si ningún otro worktree tiene esa rama; nunca hace fallar la review por ello.

`/relevo:status` lista los issues `ready` asignados a ti con el comando a ejecutar cuando la nube no está construyendo, y alerta de un issue que lleva `building` sin actividad `limits.building_alert_hours` horas, con cómo reiniciarlo.

## Con Antigravity

`agent.build: antigravity` hace que la construcción en la nube ejecute `agy` en lugar de `claude-code-action`; el resto del workflow, las compuertas y los reportes son el mismo archivo. El secreto es `GEMINI_API_KEY`, y el límite es `limits.run_max_tokens` en lugar de `limits.run_max_cost`, porque Antigravity no tiene límite de costo: una guardia de ejecución que Relevo lanza alrededor del agente hace cumplir los límites de turnos y de tokens de `relevo.yml`, y la cuota del proyecto de Google Cloud dueño de la clave es el tope que de verdad se cumple. Lo que puede y no puede hacer cumplir está en [Seguridad](security.es.md#qué-agente-construye). `/relevo:init` pregunta qué agente construye y escribe el workflow y `relevo.yml` para él. Este camino se probó sobre el texto del workflow, con un agente falso y con los comandos de la CLI real, todavía no sobre un ejecutor real.

## Fusionar con una etiqueta

`relevo-ship.yml` fusiona un issue aprobado cuando una persona le pone la etiqueta `relevo:ship`, con las mismas comprobaciones que `/relevo:ship` y sin modelo, así que no necesita credencial del modelo ni copia local. `/relevo:init` lo añade en cualquier configuración, también cuando `go` corre solo en las máquinas. Como los otros workflows, corre desde la rama por defecto, así que funciona cuando está ahí. La variable del repositorio `RELEVO_CLOUD_SHIP` en `off` lo pausa: la etiqueta no hace nada hasta que borres la variable y vuelvas a poner la etiqueta.

**Los checks del commit de archivo.** Fusionar hace commit de la especificación archivada en la rama y lo sube antes del merge. Un push hecho con el token propio del workflow no lanza ningún workflow, así que ese commit no tiene checks propios. Como solo cambia `openspec/`, cuentan los checks del head aprobado, y el comentario tras el merge lo dice. La misma regla vale para `/relevo:ship`.

**Cuando la rama base exige checks.** Entonces GitHub se niega a fusionar un commit sin ellos, y la ejecución se detiene antes de archivar, diciendo qué falta. Configura una GitHub App una vez:

1. Crea una GitHub App de tu cuenta u organización (Settings > Developer settings > GitHub Apps), sin webhook, con los permisos de repositorio Contents, Pull requests e Issues en lectura y escritura.
2. Instálala solo en este repositorio.
3. Guarda su App ID como el secret del repositorio `RELEVO_SHIP_APP_ID` y una clave privada generada por ella como `RELEVO_SHIP_APP_KEY`.
4. No añadas la App a la lista de excepciones (bypass) de ningún ruleset: tiene que seguir las mismas reglas que todos.

Con la App, la ejecución sube, fusiona y cierra con el token de la App, así que tu CI corre sobre el commit de archivo, y la ejecución lo espera hasta 30 minutos. Si los checks tardan más, se detiene sin fusionar, y volver a poner la etiqueta sigue desde el merge. La App también vale la pena cuando dependes de workflows que corren con los pushes a la rama base, porque un merge hecho con el token del workflow no lanza ninguno. `/relevo:doctor` dice si hace falta la App y si existen sus secrets.

**Ningún check.** Si no corrió ningún check sobre el código aprobado, la etiqueta se detiene, porque solo la revisión lo respalda y una etiqueta no puede confirmarlo. Ejecuta `/relevo:ship <n>`, que te lo pregunta, o pon `review.ship_without_ci: true` en `relevo.yml`.
