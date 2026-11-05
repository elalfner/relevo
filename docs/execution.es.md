# Dónde corre `go`

[English](execution.md) · Español

`go` puede construir un issue en la nube, en la máquina de una persona o en las dos. No hay un ajuste para eso en `relevo.yml`: sale de lo que está instalado, de qué secreto existe y de una variable del repositorio. Esta página explica cada pieza y qué significa para los límites.

## Los tres lugares

- **Ambas** es el valor por defecto: el workflow de `go` está instalado y existe un secreto del modelo, así que una etiqueta `ready` inicia una construcción en la nube, y cualquiera puede ejecutar `/relevo:go <n>` en su máquina.
- **Solo nube** es lo mismo, con personas que eligen no construir a mano. Úsalo para construir sin que nadie espere.
- **Solo máquinas**: `/relevo:init` no agrega los workflows de `go` ni de la cola. Cada persona construye con su propia sesión de Claude y su cuota, sin ningún secreto del modelo en el repositorio.

## Qué rama lee la nube

Un evento de etiqueta ejecuta los workflows de la rama por defecto del repositorio, y esos workflows hacen checkout de esa rama, así que la nube también lee `relevo.yml` de la rama por defecto. Una construcción en tu máquina lee en cambio el `relevo.yml` de tu copia de trabajo.

Dónde empieza una construcción no depende de la rama por defecto: la rama de un issue siempre sale de `origin/<branches.base>`, en la nube y en una máquina, y su pull request apunta a la rama base.

Con `main` como rama por defecto y `dev` como base, una construcción sigue partiendo de `dev`, pero un cambio a `relevo.yml` o a un workflow en `dev` llega a la nube solo después de promover `dev` a `main`. Si la rama base es la rama por defecto, esos cambios aplican en cuanto se fusionan en ella, y un pull request con `Closes #<n>` en su descripción cierra también el issue. `/relevo:doctor` avisa cuando el `relevo.yml` de la rama por defecto difiere del de la rama base.

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
- El secreto y la línea de credencial de `relevo-go.yml` (la que no está comentada) deben ser del mismo modo. Si solo existe un secreto y el workflow pasa el otro, una construcción en la nube se detiene sin credencial, así que `/relevo:doctor` avisa antes de la primera construcción y dice qué línea poner. `/relevo:init` cambia esa línea por ti, y respeta una que ya cambiaste.
- Lee los términos vigentes de Anthropic sobre el uso automatizado de una suscripción, y el README de `claude-code-action`, antes de apoyar a un equipo en un token de suscripción. Relevo no los juzga; `/relevo:doctor` deja un recordatorio de una línea.

## Qué instala el build

El agente del build carga el plugin de Relevo del paquete que el job desempaca en la versión que fija `RELEVO_VERSION` (`--plugin-dir` en `claude_args`), no de un marketplace: una sola versión fijada decide los scripts y las skills, no se clona nada del repositorio del plugin, y un repositorio de plugin privado no necesita `RELEVO_PLUGIN_TOKEN`. Un workflow copiado de una versión anterior todavía añade el marketplace; `/relevo:init` lo actualiza. El job de build del workflow `go` instala el toolchain del stack de la plataforma del issue, para que el agente y QA puedan ejecutar las comprobaciones de tu proyecto: Flutter con `subosito/flutter-action` y PHP con Composer para Laravel con `shivammathur/setup-php`. Cada paso está protegido por el stack, así que solo corre el del issue. Vue solo necesita Node, que el job ya tiene. Cambia las versiones y la caché en `relevo-go.yml` según tu proyecto. Instalar las dependencias lo añades tú (`npm ci --ignore-scripts`, `composer install --no-scripts`), porque el gestor de paquetes y el lockfile varían. `/relevo:doctor` falla cuando una plataforma Flutter o Laravel no tiene un paso activo, porque cada build en la nube fallaría en QA después de gastar la ejecución. Como segunda guarda, el job de build comprueba, justo antes de que empiece el agente, que cada herramienta que lista el perfil de la plataforma (`flutter`; `php` y `composer`) esté en el path del runner. Si falta alguna, no se gasta ningún turno del modelo: el issue pasa a `relevo:qa-failed` con un comentario que nombra las herramientas que faltan y dice que actives el paso del toolchain y vuelvas a poner `ready` después de quitar `qa-failed`.

## La puerta de validación y su recibo

Antes de que empiece cualquier revisor, un script (`scripts/validation-gate.mjs`) ejecuta una sola vez las comprobaciones que no necesitan juicio: los comandos `analyze` y `test` del perfil del stack desde la carpeta de la plataforma, el escáner del diff para marcadores temporales y credenciales, y la comprobación de archivos restringidos. Imprime `green`, `red` o `could-not-run`, y ningún agente lo ejecuta. Una puerta `red` vuelve al agente de desarrollo con el final de la salida que falló y gasta uno de sus intentos; una puerta `could-not-run` (falta una herramienta) termina la ejecución con «automated validation could not run» y nombra la herramienta, porque el agente de desarrollo no puede instalarla.

La puerta escribe un **recibo** en `.relevo-receipt/` dentro de la carpeta de trabajo. Git ignora esa carpeta, así que el recibo nunca está en el diff ni en un commit. Guarda un hash del diff contra la rama base (sin los archivos generados del perfil), el commit base, cada comando con su código de salida, su duración y los últimos 4.000 caracteres de su salida (con una marca que dice cuánto se omitió), y el estado. Antes de que empiece cada revisor, `scripts/receipt-check.mjs` recalcula el hash del diff tal como está ahora; si un archivo cambió desde que se escribió el recibo, o el estado no es `green`, no empieza ningún revisor y la puerta se ejecuta otra vez.

El recibo protege contra una omisión o un error: un revisor no puede empezar sobre código cuyas comprobaciones no se ejecutaron. No es una defensa contra un agente que escribe un archivo falso; las barreras del commit siguen siendo las que obligan.

## Comprobaciones antes del agente

El job de construcción lee el issue antes de que empiece el agente y se detiene, sin gastar un turno del modelo, cuando falta algo que claramente necesita: una referencia que no se pudo descargar, un archivo o una variable declarados en `External inputs` que no están, o una ruta de la clave `installed:` del perfil del stack que el paso de instalación no creó. El issue vuelve a `needs-spec` (o a `qa-failed` si falta la instalación) con un comentario que dice qué falta. La especificación se revisa otra vez al escribirla, antes de cualquier código: una tarea que edita una ruta protegida o agrega una dependencia que el issue no permite detiene la ejecución ahí.

- **Es un paso nuevo del workflow.** Un proyecto lo toma ejecutando `/relevo:init` (actualiza el workflow en su sitio) y subiendo `RELEVO_VERSION`. Un workflow copiado de una versión anterior sigue funcionando sin esta comprobación.
- **Las dependencias necesitan un paso de instalación.** Donde el perfil lista rutas en `installed:`, activa en el workflow el paso de instalación de tu stack (la plantilla trae ejemplos comentados para Flutter y Laravel). Sin él, una ejecución ahora se detiene pronto en lugar de dejar que QA falle tarde.
- **Solo ahorra trabajo.** Las comprobaciones nunca reemplazan las barreras que ya existen; ver [Seguridad](security.es.md).

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

### Varios runners en una misma máquina

Cada proceso de runner ejecuta un job a la vez, así que varios runners en una máquina son la forma de correr builds en paralelo allí. Lo que cada uno guarda aparte y lo que comparten:

| Aparte en cada runner | Compartido por todos los runners de la máquina |
|---|---|
| El workspace (su propia carpeta `_work`) | El home del usuario del runner (`~/.claude` y los archivos que las herramientas guardan allí) |
| `$RUNNER_TEMP`, donde cada job instala OpenSpec y el plugin | Las cachés de paquetes de las herramientas (pub, composer, gradle, npm) |
| La caché de herramientas de las acciones de toolchain | El daemon de Docker |
| La rama del issue (un build por issue) | Los puertos de la máquina |

Un runner registrado con tu propio usuario también comparte `~/.claude` con tus sesiones interactivas de Claude Code. Las escrituras simultáneas en una caché o un archivo de ajustes compartido pueden chocar; no se ha probado aquí. Registrar cada runner con su propio usuario de la máquina, o en su propio contenedor, quita el home y las cachés compartidos. No quita el daemon de Docker ni los puertos.

- **Los builds que pueden correr a la vez** son, como máximo, el menor entre `limits.concurrent_agents` y los runners libres. Todos los workflows de Relevo (`go`, `review`, `ship`, `queue`, `sla`, `digest`) corren con las mismas etiquetas, así que registra más runners que `limits.concurrent_agents`: con tres runners y un límite de 3, tres builds ocupan todos los runners y retrasan los checks de tus pull requests y los demás workflows.
- **El stack Supabase no se paraleliza en una máquina.** Sus comprobaciones arrancan contenedores en la máquina (mira [Stacks](stacks.es.md)), y dos builds así a la vez pueden chocar en los puertos y en los contenedores. No dejes que dos builds de una plataforma Supabase corran juntos en una máquina, o da a cada runner su propia máquina.
- **`limits.concurrent_agents` no es exacto cuando las puertas se solapan.** La puerta de un issue cuenta los issues con la etiqueta `relevo:building`, y la puerta de un issue no espera a la de otro. Con un solo runner las puertas hacen cola detrás del job en curso y el límite se mantiene. Con dos o más runners, o en los runners de GitHub, dos issues etiquetados a la vez pueden encontrar ambos un hueco libre y arrancar, así que el límite puede superarse en tantos como puertas se solapen. La siguiente evaluación de la cola ve la cuenta real y no arranca nada más hasta que se libere un hueco. Es un límite conocido, no un ajuste.
- **La cola arranca cuando termina un build.** Las etiquetas que pone una ejecución usan el token del workflow, y GitHub no inicia ningún workflow por un evento hecho con él; por eso `go` tiene un último job, `requeue`, que lanza `relevo-queue` cuando el build terminó (con éxito, fallido o cortado) y cuando el job ligero falla tras reclamar el issue. Es un job aparte para que solo él tenga `actions: write`; el job que ejecuta el agente no lo tiene. Si el repositorio no tiene `relevo-queue.yml`, avisa y la planificación es el único camino.

El código del agente corre con los permisos del usuario del runner, que en tu propia máquina puede llegar a tu red. La barrera es un runner efímero o un contenedor; mira [Seguridad](security.es.md#qué-no-protege). Comprobado en un runner self-hosted: `$RUNNER_TEMP` se vacía entre jobs, pero `claude-code-action` guarda su estado en el home del usuario del runner (ajustes, cachés y las transcripciones de sus sesiones en `~/.claude/projects`), y Relevo no lo borra; límpialo tú si las transcripciones, que contienen lo que el agente leyó y escribió, no deben quedarse.

## Qué reporta una ejecución en la nube

Después de cada ejecución en la nube, un comentario da los turnos, el costo y los tokens que reporta el log del ejecutor del agente (el costo es nocional con una suscripción). Si el log no los tiene, no se publica nada. Cuando el log los tiene, el comentario lista además cada agente (el principal y cada subagente) con su modelo, esfuerzo, turnos, minutos y un costo estimado, y el costo real de cada modelo. El costo de un agente es una parte del costo de su modelo según el lado de entrada ponderado de sus mensajes (los tokens de salida de un mensaje en streaming son una captura previa a que la respuesta esté completa), por eso se escribe "unos"; las estimaciones de un modelo suman su costo real. El marcador oculto lleva las mismas cifras bajo `agents` y `models`, que el resumen diario ignora. Una ejecución que se detuvo porque se alcanzó el límite de uso o el crédito lo dice y te indica volver a poner `ready` más tarde; cualquier otro fallo conserva el comentario genérico con el enlace a la ejecución.

Ese mismo comentario lleva un marcador oculto con esas cifras, que el resumen diario suma: termina con una línea como `Uso, últimos 7 días: 3 ejecuciones, 35 turnos, unos $3.75, 1350 tokens.` y dice cuándo el costo es nocional (en todas las ejecuciones, o `nocional en 1 de 2 ejecuciones`). Solo cuentan las ejecuciones de los últimos siete días que dejaron marcador. Las hechas antes de que tu proyecto suba `RELEVO_VERSION` a la versión que escribe el marcador no lo tienen y no se cuentan, y las cifras nunca se deducen del texto del comentario, así que la línea se va llenando durante la primera semana. El resumen sigue sin publicarse cuando nadie espera nada, sea cual sea el uso.

El mismo marcador guarda también los segundos que tardó cada fase del build (con el intento de cada ciclo de QA) y la clase del resultado: `built`, `inputs`, `policy`, `qa-non-fixable`, `qa-fixable-after-retries`, `conflict`, `limit` (la ejecución se detuvo en un límite o la cortaron) u `other`. `/relevo:status` y el resumen diario imprimen una línea como `Resultados, últimos 7 días: 4 construidas, 1 detenidas por entradas faltantes; segundos por fase: desarrollo 1200s, QA 400s; 2 sin registro de fases.` Las ejecuciones hechas antes de que tu proyecto subiera `RELEVO_VERSION` no tienen fases ni clase y se cuentan como `sin registro de fases`. No se guarda nada para esto; la línea se lee de los marcadores cada vez. La fase la anuncia la skill `go`, así que las cifras valen lo que valga ese anuncio. El marcador guarda también, aparte de las fases, los segundos de cada lente de QA con su intento (`spec`, `security`, `code`, `interface`), que anuncia la skill `go` al lanzar cada lente. Una lente dura hasta que empieza la siguiente lente o la siguiente fase, así que su cifra incluye la comprobación del recibo que precede a la siguiente. `/relevo:status` y el resumen diario no las suman; léelas del marcador de la ejecución.

## Cuando una ejecución se detiene en un límite o la cortan

Una ejecución en la nube tiene cuatro límites: `limits.run_max_turns` (el runner cuenta al agente principal, Relevo a los subagentes juntos), `limits.run_max_minutes`, `limits.run_max_cost` y el `timeout-minutes` del job de build. Antes de lanzar otro agente, `go` consulta a `run-budget.mjs`, que cuenta los turnos de los subagentes desde el bloque de uso que cierra cada reporte y los minutos desde que la ejecución entró en `planning`. Cuando se alcanzó un límite no empieza otro agente: la ejecución toma la ruta de fallo con la razón `run limit reached`, hace commit del trabajo como `wip: stopped by limit (#N)`, lo sube a la rama del issue y nombra a los agentes que no corrieron. El guardia falla abierto: cuando no puede leer sus entradas lo dice y la ejecución sigue.

Cuando el propio runner corta al agente (su límite de turnos o de costo) o el job se cancela o vence, la ruta de fallo nunca corre. Un paso del workflow go que siempre corre, **Keep the work of a run that was cut**, mira el issue: si sigue en `building` o `ready` no se registró ningún resultado, así que hace commit de lo que queda en el árbol de trabajo y lo sube, con los mismos escaneos de todo commit de Relevo. Su resultado dice en el comentario qué pasó con el trabajo:

- **guardado**: el trabajo está en la rama del issue; `/relevo:fix <n>` lo verifica y continúa.
- **no guardado**, con el archivo y la razón: se encontró una ruta protegida, un archivo restringido, un marcador temporal o una posible credencial, y no se subió nada.
- **no subido**: se hizo el commit pero falló el push.
- **rama existente**: la rama ya estaba en el remoto, así que no se tocó.
- **nada**: la rama nunca se creó o el árbol de trabajo no tenía nada que guardar.

Nunca fuerza un push. El job tiene que vivir lo suficiente para que el paso corra, así que mantén `limits.run_max_minutes` al menos cinco minutos por debajo del `timeout-minutes` del job de build (`/relevo:doctor` avisa cuando no es así).

## Checkpoints y reanudación

El desarrollador no construye todo en un solo lanzamiento. `go` divide las tareas pendientes en grupos, uno por sección de `tasks.md` (tres tareas o menos son un grupo), lanza al desarrollador para un grupo a la vez, y después de cada grupo hace commit de los archivos que cambiaron como `wip: checkpoint <k>/<n> (#N)` y sube la rama del issue. El commit lleva el hash del texto del issue como trailer (`Issue-hash:`) y pasa por el mismo commit seguro de todo commit (rutas protegidas, archivos restringidos, marcadores, credenciales); el push es un fast-forward y nunca se fuerza. Cada lanzamiento empieza con un contexto más corto, y un corte o un límite pierde a lo sumo el grupo en curso.

Cuando el issue vuelve a `ready` y su rama existe en el remoto, `go` consulta a `resume-check.mjs`. **Reanuda** desde la rama, construye solo las tareas pendientes y no escribe especificación cuando todos los commits sobre la base son de Relevo para este issue (la especificación, un checkpoint, o el trabajo guardado en un límite), la punta es un checkpoint o un commit de límite con el hash del texto del issue, y el texto no cambió. Cualquier otro caso detiene la ejecución con `branch already exists`, como antes: un commit de una persona, un issue cuyo texto cambió, trabajo que QA rechazó (eso es para `/relevo:fix`), o una rama con solo la especificación. Para empezar de cero, borra la rama remota y vuelve a poner `ready`.

Los checkpoints quedan en el historial de la rama, porque aplastarlos exigiría un force push; el squash de `/relevo:ship` los quita de la rama base.

## Cuánto tarda cada etapa

El resumen termina con una línea que dice adónde se va el tiempo de un issue: la mediana de cada etapa que terminó en los últimos siete días y, entre paréntesis, cuántas fueron. Las cinco etapas siguen las etiquetas del ciclo de vida:

| Etapa en la línea | Desde | Hasta |
|---|---|---|
| puerta | `relevo:ready` (o `relevo:queued`) | `relevo:building` |
| construcción | `relevo:building` | `relevo:built` |
| esperando por ti | `relevo:built` | `relevo:in-review` |
| revisión en dispositivo | `relevo:in-review` | `relevo:pr-open` |
| revisión del compañero | `relevo:pr-open` | el issue cerrado como completado |

- **Solo cuenta el camino normal.** Una construcción que QA rechaza, un issue devuelto a quien escribe la especificación, un bloqueo o una petición de cambios no son una etapa, y los días que pasan ahí no forman parte de ninguna. Un issue construido otra vez tras un fallo suma la construcción que funcionó.
- **Una etapa sin muestras no sale en la línea.** En una revisión en solitario las etapas se saltan y no hay nada que mostrar; un resumen sin ninguna etapa no tiene esta línea, y sigue sin publicarse cuando nadie espera nada.
- **Una etapa cuenta en la semana en que terminó**, por larga que fuera: una revisión que empezó hace nueve días y terminó hace dos cuenta con toda su duración.
- **No se guarda nada.** Los tiempos se leen de los eventos que GitHub conserva de los issues, del más nuevo al más viejo y hasta el final de la semana, y después de los eventos de cada issue que terminó una etapa. Si la lectura falla, el resumen sale sin la línea. Un proyecto recibe la línea cuando sube `RELEVO_VERSION` en `relevo-digest.yml` a la versión que la trae.

## Seguir una ejecución en la nube

Mientras una construcción en la nube corre, un comentario del issue muestra cuánto lleva. Se edita en el mismo sitio, nunca se le añade otro, y se ve así:

```text
Construcción de Relevo en curso: QA (intento 2 de 3)
Tareas: 6 de 9
Lleva 7 min
```

- **La fase** es planificación, especificación, desarrollo, QA o entrega. El skill `go` la anuncia al entrar en cada paso, con el número de intento sobre los reintentos permitidos (`qa_retries`) cuando QA rechaza el trabajo y el desarrollo empieza de nuevo. Si no anuncia nada, la fase se deduce del árbol de trabajo, que no distingue QA de un nuevo intento de desarrollo.
- **Las tareas** son las casillas marcadas de `tasks.md` sobre el total. El workflow las cuenta él mismo cada 30 segundos, así que no dependen del agente.
- **Los minutos** son minutos enteros desde que empezó la ejecución. Una ejecución cuyos minutos siguen creciendo mientras sus tareas y su fase no cambian está atascada, o en un paso largo: abre la ejecución para leer su log. El comentario solo se edita cuando cambia su texto, más o menos una vez por minuto.
- **Cuando la ejecución termina**, sea cual sea el resultado, el comentario se sustituye por una línea que apunta al resultado (o, si la ejecución no dejó ninguno, lo dice) y enlaza la ejecución. El resultado es el comentario que siempre se publicó.

Muestra la fase y el intento, no lo que hace un subagente dentro de ellos. Una ejecución local (`go --local`) no tiene este comentario: tú estás viendo la sesión. Para tenerlo en un proyecto que ya tiene el workflow, pasa el nuevo `relevo-go.yml` por `/relevo:init`, que lo fusiona con tus cambios, y sube `RELEVO_VERSION`; hasta entonces las ejecuciones construyen como antes, sin él. El informe nunca hace fallar una ejecución: si GitHub rechaza una edición, la construcción sigue.

## Construir en tu máquina

```bash
/relevo:go 42 --local
```

Ejecuta `scripts/go-local.mjs` del plugin, que ejecuta `claude -p "/relevo:go 42"` (o `agy -p` cuando `agent.build: antigravity`) en un git worktree separado junto a tu repositorio, así que tus cambios sin commitear no importan, con los mismos límites de turnos y costo y las mismas listas cerradas de herramientas que el workflow. El worktree se borra cuando la ejecución termina bien y se conserva, imprimiendo su ruta, cuando no. `--dry-run` muestra lo que haría.

En una sesión de Claude Code, ejecutar `/relevo:go <issue>` sin `--local` también construye en un worktree propio, así que puedes correr dos a la vez y seguir trabajando en tu checkout. La skill lo crea con `scripts/go-worktree.mjs` (junto a tu repositorio, en `.relevo-worktrees/`, desde `origin/<base>`, el mismo lugar que `--local`), entra en él y construye ahí; ves la construcción en tu sesión. Cuando el issue termina `built`, o una compuerta lo detiene antes de construir nada, el worktree se borra; tras una ejecución fallida se conserva y se imprime su ruta. Si el worktree de ese issue ya existe (otra ejecución lo está construyendo, o una fallida lo dejó) la ejecución se detiene y te dice el comando que lo borra. Dentro de un worktree que ya existe, como el de `--local`, construye donde está. Cuándo usar cada una está en [En la sesión o por separado](commands.es.md#en-la-sesión-o-por-separado). `/relevo:review` sigue corriendo en tu checkout principal; la revisión de un backend Laravel no necesita dispositivo, solo los tests del proyecto y su `vendor/`, y la de una base de datos Supabase necesita la CLI de Supabase y Docker en marcha, y solo toca los contenedores locales.

En sesiones interactivas de chat de Antigravity, ejecutar `/relevo:go <issue>` ejecuta la construcción dentro de un subagente aislado con `Workspace: 'share'`. Esto genera un worktree efímero automático, permitiendo que múltiples chats construyan issues concurrentemente sin colisiones de ramas ni de OpenSpec. La raíz del repositorio se mantiene limpia en la rama base, reservada para el desarrollador y para sesiones interactivas de `/relevo:review` con dispositivos conectados. Al abrir el pull request, `review` devuelve la raíz a la rama base, solo en el checkout principal y solo si ningún otro worktree tiene esa rama; nunca hace fallar la review por ello.

`/relevo:status` lista los issues `ready` asignados a ti con el comando a ejecutar cuando la nube no está construyendo, y alerta de un issue que lleva `building` sin actividad `limits.building_alert_hours` horas, con cómo reiniciarlo.

`/relevo:review`, `/relevo:ship` y `/relevo:fix` corren donde los inicias, en tu checkout principal o en un worktree que abriste (por ejemplo con el botón Worktree de Claude Code). En un worktree, `review` y `ship` no vuelven después a la rama base, y `ship` no borra la rama local: el worktree se queda en su rama y el informe lo dice. Si otro worktree tiene la rama del issue (un `go` fallido conserva su worktree), se detienen antes de cambiar nada y nombran ese worktree y su ruta.

### Worktrees desde tu rama base

El botón Worktree de Claude Code crea la rama desde la rama predeterminada del remoto (`origin/HEAD`) y no acepta un nombre de rama. Si trabajas en `dev` y la rama predeterminada es `main`, cada worktree que crea parte de `main`. `go` no se ve afectado: siempre construye desde `origin/<branches.base>`. Poner `worktree.baseRef` en `"head"` parte de tu `HEAD` local, que está desactualizado salvo que el checkout principal esté en la rama base y al día, así que aquí no es la respuesta.

Si quieres que el botón parta de tu rama base, un hook `WorktreeCreate` puede crear el worktree él mismo. Es opcional y Relevo no lo instala. Guarda este script (cambia `dev` por tu `branches.base`) como `~/.claude/hooks/worktree-from-base.sh` y hazlo ejecutable:

```bash
#!/bin/bash
in=$(cat)
name=$(echo "$in" | jq -r .name)
cwd=$(echo "$in" | jq -r .cwd)
common=$(git -C "$cwd" rev-parse --path-format=absolute --git-common-dir) || exit 1
root=$(dirname "$common")
git -C "$root" fetch -q origin dev >&2 || exit 1
git -C "$root" worktree add -q -b "worktree-$name" "$root/.claude/worktrees/$name" origin/dev >&2 || exit 1
echo "$root/.claude/worktrees/$name"
```

Luego regístralo en `.claude/settings.local.json` (hace falta una sesión nueva para que cargue un hook):

```json
{
  "hooks": {
    "WorktreeCreate": [
      { "hooks": [{ "type": "command", "command": "$HOME/.claude/hooks/worktree-from-base.sh" }] }
    ]
  }
}
```

El hook imprime en stdout solo la ruta del worktree; todo lo demás va a stderr. Lo que cede: reemplaza la creación por defecto, así que `.worktreeinclude` ya no se procesa (copia a mano archivos como `.env`) y la rama es `worktree-<nombre>`, no el prefijo de la app. Comprobado con Claude Desktop en una máquina: el botón Worktree ejecutó el hook con `session_id`, `cwd` y `name` como entrada y creó el worktree desde `origin/dev`. La documentación de Claude Code describe el mismo evento para la línea de comandos, que aquí no se probó.

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
