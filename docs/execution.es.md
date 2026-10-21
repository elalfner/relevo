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

El job de build del workflow `go` instala el toolchain del stack de la plataforma del issue, para que el agente y QA puedan ejecutar las comprobaciones de tu proyecto: Flutter con `subosito/flutter-action` y PHP con Composer para Laravel con `shivammathur/setup-php`. Cada paso está protegido por el stack, así que solo corre el del issue. Vue solo necesita Node, que el job ya tiene. Cambia las versiones y la caché en `relevo-go.yml` según tu proyecto. Instalar las dependencias lo añades tú (`npm ci --ignore-scripts`, `composer install --no-scripts`), porque el gestor de paquetes y el lockfile varían. `/relevo:doctor` falla cuando una plataforma Flutter o Laravel no tiene un paso activo, porque cada build en la nube fallaría en QA después de gastar la ejecución. Como segunda guarda, el job de build comprueba, justo antes de que empiece el agente, que cada herramienta que lista el perfil de la plataforma (`flutter`; `php` y `composer`) esté en el path del runner. Si falta alguna, no se gasta ningún turno del modelo: el issue pasa a `relevo:qa-failed` con un comentario que nombra las herramientas que faltan y dice que actives el paso del toolchain y vuelvas a poner `ready` después de quitar `qa-failed`.

## Qué reporta una ejecución en la nube

Después de cada ejecución en la nube, un comentario da los turnos, el costo y los tokens que reporta el log del ejecutor del agente (el costo es nocional con una suscripción). Si el log no los tiene, no se publica nada. Una ejecución que se detuvo porque se alcanzó el límite de uso o el crédito lo dice y te indica volver a poner `ready` más tarde; cualquier otro fallo conserva el comentario genérico con el enlace a la ejecución.

## Construir en tu máquina

```bash
/relevo:go 42 --local
```

Ejecuta `scripts/go-local.mjs` del plugin, que ejecuta `claude -p "/relevo:go 42"` (o `agy -p` cuando `agent.build: antigravity`) en un git worktree separado junto a tu repositorio, así que tus cambios sin commitear no importan, con los mismos límites de turnos y costo y las mismas listas cerradas de herramientas que el workflow. El worktree se borra cuando la ejecución termina bien y se conserva, imprimiendo su ruta, cuando no. `--dry-run` muestra lo que haría.

En sesiones interactivas de chat de Antigravity, ejecutar `/relevo:go <issue>` ejecuta la construcción dentro de un subagente aislado con `Workspace: 'share'`. Esto genera un worktree efímero automático, permitiendo que múltiples chats construyan issues concurrentemente sin colisiones de ramas ni de OpenSpec. La raíz del repositorio se mantiene limpia en la rama base, reservada para el desarrollador y para sesiones interactivas de `/relevo:review` con dispositivos conectados. Al abrir el pull request, `review` devuelve la raíz a la rama base.

`/relevo:status` lista los issues `ready` asignados a ti con el comando a ejecutar cuando la nube no está construyendo, y alerta de un issue que lleva `building` sin actividad `limits.building_alert_hours` horas, con cómo reiniciarlo.

## Con Antigravity

`agent.build: antigravity` hace que la construcción en la nube ejecute `agy` en lugar de `claude-code-action`; el resto del workflow, las compuertas y los reportes son el mismo archivo. El secreto es `GEMINI_API_KEY`, y el límite es `limits.run_max_tokens` en lugar de `limits.run_max_cost`, porque Antigravity no tiene límite de costo: una guardia de ejecución que Relevo lanza alrededor del agente hace cumplir los límites de turnos y de tokens de `relevo.yml`, y la cuota del proyecto de Google Cloud dueño de la clave es el tope que de verdad se cumple. Lo que puede y no puede hacer cumplir está en [Seguridad](security.es.md#qué-agente-construye). `/relevo:init` pregunta qué agente construye y escribe el workflow y `relevo.yml` para él. Este camino se probó sobre el texto del workflow, con un agente falso y con los comandos de la CLI real, todavía no sobre un ejecutor real.
