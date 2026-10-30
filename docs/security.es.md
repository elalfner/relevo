# Modelo de seguridad

[English](security.md) · Español

Relevo deja que un agente de IA escriba y ejecute código en tu repositorio, sin supervisión. Esta página dice qué hace para que eso sea seguro y qué no hace. Reduce el riesgo; no lo elimina, y la revisión humana del pull request es la última barrera.

## Qué protege Relevo y cómo

| Amenaza | Medida | Quién lo hace cumplir |
|---|---|---|
| El agente empuja a la rama base o a la de publicación | una regla que permite al agente crear solo ramas `feature/*`; `/relevo:init` la crea y `/relevo:doctor` avisa si falta | la plataforma |
| El agente o la automatización aprueba o fusiona | aprobar y fusionar son actos humanos explícitos: `/relevo:ship` pide una confirmación escrita, el workflow de ship fusiona solo cuando una persona puso `relevo:ship` (una etiqueta de un bot no fusiona nada), y el autor no puede aprobar su propio pull request | la plataforma, y `ship` |
| Un pull request hace a su autor elegible para fusionarlo | el workflow de ship lee `relevo.yml` de la rama base y sus scripts del paquete publicado, y no ejecuta nada de la rama (git corre sin hooks) | el runner, y un script |
| El texto de un issue, comentario o log se toma como una instrucción | el texto se trata como datos, y el agente tiene una lista cerrada de herramientas sin acceso a la web (`WebFetch`, `WebSearch`, `curl` y `wget` se rechazan) | el ejecutor |
| Alguien sin el derecho se salta la capacidad de revisión del equipo | `relevo:urgent` cuenta solo si quien la puso podía marcar el issue como `ready` (mantenedor cuando `trust` es `public`); cualquier otra etiqueta se quita con un comentario, y nunca salta la especificación, las dependencias ni `limits.concurrent_agents` | un script |
| El issue se edita después de que alguien le puso `ready` | el texto aprobado se resume con un hash y `go` se niega a construir otro distinto (`issue-hash.mjs`) | un script |
| Una ejecución cambia los archivos que controlan el workflow | los workflows, `relevo.yml`, `.relevo/`, las carpetas de skills y el archivo de reglas del proyecto son rutas protegidas; un commit que las toca se rechaza (`commit-change.mjs`) | un script |
| Un agente o un script lee un archivo que guarda un secreto, o lo publica | una lista de archivos restringidos (archivos de entorno, llaves privadas, archivos de credenciales, configuración de servicios móviles, `secrets/` y `restricted_paths` de `relevo.yml`) que se le dice a los agentes que no lean, que un worktree nunca contiene y que ningún script de Relevo abre ni publica; uno en un diff, o versionado, termina la ejecución en `qa-failed` con el motivo "restricted file in the diff" ([Archivos restringidos](#archivos-restringidos)) | el ejecutor, y un script |
| Una ejecución añade una dependencia que ejecuta código al instalarse | los archivos de dependencias están protegidos salvo que el issue los liste en `Allow-paths:`, las dependencias se instalan sin scripts de paquetes, y QA rechaza una dependencia que el diseño no justifica | un script, y QA |
| Un pull request cambia las skills que sigue el agente | las skills extra se leen de la rama base, nunca de la rama en trabajo, y una skill con scripts solo corre si `skills.allow_scripts` la lista | un script |
| Un repositorio debilita las comprobaciones de un stack | el perfil de un repositorio puede añadir al del plugin pero no reemplazar un comando; solo lo hace `platforms.<name>.checks`, a la vista | un script |
| Un secreto o una marca temporal llega a un commit | el diff se escanea antes de cada commit y push (`scan-diff.mjs`) y el commit se aborta si hay coincidencia | un script |
| Una ejecución gasta sin límite | cada ejecución tiene límites de turnos y de costo (`limits.run_max_turns`, `limits.run_max_cost`), y una que alcanza uno se detiene | el ejecutor |
| El texto de un repositorio enlazado trae instrucciones | se lee como datos, con un token de solo lectura (`RELEVO_LINKS_TOKEN`: issues, pull requests y contenido) que el agente nunca tiene: solo lo reciben el gate, la cola y el paso que obtiene las referencias antes del agente | el ejecutor, y una lista cerrada de repositorios |
| Una imagen en un issue muestra datos de clientes al modelo, o una descarga va adonde no debe | las imágenes pegadas se descargan solo cuando `design.images` está activo; las descarga un script, no el agente, solo de los dominios de adjuntos de GitHub y de repositorios enlazados, en un paso anterior al agente en la nube, con límites de tamaño y de tipo y el token enviado solo a GitHub; los archivos quedan fuera de git | un script |
| Una revisión conducida llega a un sitio al que no debe | el navegador del agente es limpio y solo alcanza `localhost`, la página en revisión y `review.allowed_origins`, y las credenciales de prueba se pasan por nombre de variable y se redactan | un script |
| Una revisión conducida muestra una captura al modelo, escribe archivos o corre sin el permiso de la persona | el script de revisión toma capturas solo con `capture(nombre, check)`, que las guarda y no devuelve nada; no puede tomar una por su cuenta, pasar una ruta de archivo al navegador ni imprimir para el agente; el ejecutor solo arranca con la confirmación de los datos, antes del acuerdo, y con el script exacto que `qa` aprobó | un script, y QA |
| Una revisión conducida rompe el servidor de desarrollo de la persona | los servidores extra solo los arranca y detiene `extra-server.mjs`, que nunca toca un servidor que no arrancó, y la revisión no cambia de rama bajo un servidor que corre desde el árbol de trabajo | un script |
| El runner ejecuta una versión de Relevo distinta de la que leíste | los workflows instalan el paquete publicado en una versión fijada (`RELEVO_VERSION`), publicado desde un tag con procedencia, y se detienen si falta un script; el agente en la nube carga su plugin de ese mismo paquete (`--plugin-dir`), no de un marketplace que le daría la última versión | el runner |
| Un job deja herramientas, ajustes o archivos en un runner que los conserva entre jobs | cada job instala sus herramientas en su propia carpeta temporal en una versión fijada, la ejecución con Antigravity usa una carpeta home del job, y un último paso quita lo que el job agregó al workspace; `/relevo:doctor` dice que un runner self-hosted se asume persistente | el workflow; que la máquina sea un entorno aislado depende del runner |

## Qué no protege

- **La inyección de prompts no tiene una defensa completa.** Una instrucción oculta en un README, un comentario o un paquete aún puede desviar al agente. Relevo reduce lo que puede hacer un agente desviado (sin web, una lista cerrada de herramientas, rutas protegidas, límites), no si puede desviarse.
- **El código que escribe el agente corre en el ejecutor.** Las pruebas y la construcción corren con la red y los permisos del ejecutor. La lista cerrada restringe las herramientas del agente, no el sistema operativo, así que un código malicioso que el agente fue llevado a escribir correría ahí hasta que QA y la revisión lo detengan.
- **Un runner self-hosted no es un entorno aislado.** Relevo asume que conserva sus archivos entre jobs, limpia lo que agregan sus propios pasos y no puede saber si la máquina es efímera. El código del agente corre con los permisos del usuario del runner y la red de la máquina, que en tu propio hardware puede llegar a servicios internos y a las credenciales de otros jobs. La barrera real es un runner efímero (creado para un solo job) o un contenedor; mantén el repositorio privado y no compartas el runner con proyectos que no controlas. Los runners registrados con un mismo usuario de la máquina comparten lo que puede leer el agente de cualquiera de ellos, incluidos los workspaces de los demás, así que da a cada runner su propio usuario o un contenedor ([Varios runners en una misma máquina](execution.es.md#varios-runners-en-una-misma-máquina)). `runner.labels` en `relevo.yml` solo elige dónde corren los workflows ([Dónde corre `go`](execution.es.md#runners-self-hosted)).
- **El modo local corre con tus credenciales.** `/relevo:go <n> --local` y la revisión corren en tu máquina, con tus herramientas y tus cuentas. Lee lo que se te pide ejecutar.
- **La protección de ramas puede no estar disponible.** En un repositorio privado de un plan gratuito de GitHub la plataforma rechaza las reglas anteriores; entonces aprobar y fusionar solo lo hace cumplir la confirmación escrita de `ship`.
- **El script de una revisión conducida no es un entorno aislado.** El ejecutor rechaza un script que toque el sistema de archivos o el proceso, pero eso es una alarma; `qa` lee el script antes y tú debes leer uno que toque algo sensible.
- **Una persona sigue siendo la última barrera.** QA y la auditoría detectan lo que están escritas para detectar. Un pull request que parece correcto aún puede estar mal; `review.mode` en `peer` o `roles` pone a una segunda persona sobre él.

## Qué agente construye

`agent.build` en `relevo.yml` elige el agente de la construcción en la nube: `claude` (el predeterminado) o `antigravity`. Todo lo de la primera tabla que hace cumplir un script o la plataforma es igual para los dos. Lo que pertenece al ejecutor propio del agente no lo es, y esta tabla dice en qué se diferencia. "Parcial" significa que el control existe pero es más débil de lo que suena.

| Control | Claude Code | Antigravity CLI |
|---|---|---|
| Lista cerrada de herramientas, sin web | lo hace cumplir el ejecutor | **parcial**: `permissions.allow` y `permissions.deny` en un archivo de ajustes a nivel de usuario que el workflow escribe fuera del repositorio, así que un pull request no puede aflojarlos. Es una lista de prefijos de comandos: `node` puede ejecutar cualquier script, como Bash para Claude |
| Límite de turnos | lo hace cumplir el ejecutor | lo hace cumplir la guardia de ejecución de Relevo, que lee el flujo de eventos y detiene al agente; la herramienta no tiene un límite propio |
| Límite de costo | lo hace cumplir el ejecutor (un tope real con una clave de API) | **no existe.** `limits.run_max_tokens` (que hace cumplir la guardia) y la cuota y el presupuesto del proyecto de Google Cloud dueño de la clave son el tope; una alerta de presupuesto no es un tope, así que usa una clave hecha solo para Relevo en su propio proyecto con una cuota |
| Skills que solo una persona puede iniciar | `disable-model-invocation` | se respeta la misma clave (visto en la CLI 1.4.4) |
| Credencial | `ANTHROPIC_API_KEY` o `CLAUDE_CODE_OAUTH_TOKEN` | `GEMINI_API_KEY` |
| El agente en sí | la action en `@v1` | el binario, fijado por versión y sha512 en el workflow |
| `trust: public` | permitido | rechazado hasta que un cambio posterior lo levante |

Lo que la tabla no dice, para Antigravity:

- **La clave la pueden leer los comandos del agente.** `GEMINI_API_KEY` es una variable de entorno de la ejecución, así que el agente puede leerla. Una clave limitada a la API de Gemini, en un proyecto con una cuota, hace que eso sea inofensivo en el peor caso.
- **Una herramienta rechazada no hace fallar a la herramienta.** Antigravity sale con 0 cuando se rechaza una herramienta. La guardia lee el rechazo del flujo de eventos y hace fallar la ejecución, y dice cuál fue.
- **La guardia cuenta lo que reporta la herramienta.** Un turno es una respuesta del modelo, del agente principal o de un subagente. Los tokens son entrada más salida como los reporta la herramienta; los tokens leídos de la caché no se cuentan, así que el límite es más holgado que el trabajo que hizo el modelo.
- **Una lista de prefijos no es una frontera del sistema operativo.** La lista cerrada restringe qué comandos puede iniciar el agente, no lo que hace un comando permitido. Es el mismo límite que el de arriba para Claude.
- **No probado:** que la calidad de la QA adversarial se mantenga con un modelo de Gemini; una ejecución completa en la nube sobre un ejecutor real (mira los límites conocidos del changelog); si la CLI puede actualizarse sola durante una ejecución.

## Archivos restringidos

Hay archivos que no debería leer ningún agente ni ningún script de Relevo: archivos de entorno, llaves privadas, almacenes de credenciales. La lista es la lista base de abajo más `restricted_paths` en `relevo.yml`, que solo suma (un perfil no puede debilitarla, y `relevo.yml` no puede quitar una entrada). Es aparte de las rutas protegidas, que tratan de lo que un diff puede escribir.

**La lista base.** `.env` y `.env.*` a cualquier profundidad, salvo los archivos de ejemplo `.env.example`, `.env.sample`, `.env.template` y `.env.dist` (las skills y los stacks los leen para los nombres de las variables); llaves privadas y certificados (`*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.p8`, `*.ppk`, `*.keystore`, `*.jks`, `id_rsa`, `id_dsa`, `id_ecdsa`, `id_ed25519`); archivos de credenciales de gestores de paquetes y del shell (`.npmrc`, `.netrc`, `.pypirc`, `.git-credentials`, `.pgpass`, `.htpasswd`); la configuración de servicios de las apps móviles (`google-services.json`, `GoogleService-Info.plist`, `key.properties`); y una carpeta `secrets/` en la raíz y en la raíz de cada plataforma. La coincidencia es por nombre de ruta, y un nombre que no esperabas (`key.json`) no está en ella: agrégalo a `restricted_paths`.

**Qué cubren las denegaciones de herramienta de `.env.*`.** Las reglas de Claude Code no pueden decir "salvo `.env.example`", así que las denegaciones del workflow en la nube y de `/relevo:init` listan las variantes comunes (`.env.local`, `.env.development`, `.env.production`, `.env.staging`, `.env.test`, `.env.testing`, `.env.dev`, `.env.prod`, `.env.qa`, `.env.ci`, `.env.preview` y `.env.*.local`), no todos los `.env.*`. Una variante fuera de esa lista (`.env.docker`, `.env.backup`, `.env.old`, `.env.stage`) está restringida para los scripts de Relevo y no está en el worktree, pero ninguna herramienta del agente la deniega: agrega esos nombres a `restricted_paths`, que sí escribe una denegación por cada entrada. Los cuatro archivos de ejemplo son los únicos nombres exentos.

**Un archivo de configuración móvil versionado hace fallar cada ejecución.** Un repositorio que versiona a propósito `google-services.json` o `GoogleService-Info.plist` (algunos equipos lo hacen, porque los valores no son secretos) tiene un archivo restringido versionado, así que `go` se detiene con el motivo "restricted file in the diff" y `/relevo:doctor` falla. La lista no tiene excepción para ellos: deja de versionar el archivo y mantenlo fuera de git, o acepta que las ejecuciones se detengan.

**La comprobación es por nombre.** La ruta se resuelve contra la carpeta de trabajo antes de compararla, así que `a/./b`, `a//b` y `a/../a/b` son el mismo nombre, pero un enlace simbólico a un archivo restringido no se sigue: un enlace con un nombre común no se reconoce.

### Tres niveles de ocultamiento

| Nivel | Qué ve el agente | Dónde se cumple |
|---|---|---|
| **No está en el árbol** | "no such file": el archivo no está | el árbol que construye Relevo. `go` construye en un worktree de git, que solo contiene archivos versionados, y ningún script copia ni enlaza un archivo restringido ahí (un archivo `.worktreeinclude` es una función de Claude Code que sí lo hace, y el worktree de Relevo no lo procesa). Un archivo restringido que está versionado es un fallo, no algo que ocultar: `go` se detiene ahí y `/relevo:doctor` falla |
| **Lectura denegada** | la lectura se bloquea y se le avisa al agente; un listado del directorio todavía muestra el nombre | los ajustes del agente, abajo |
| **Shell en sandbox** | el sistema operativo rechaza al proceso que abre el archivo | Claude Code, donde una persona activa su sandbox (el workflow en la nube no); Antigravity no |

El primer nivel es el único que responde "no such file". En el segundo y el tercero el agente se entera de que algo está bloqueado.

### Qué hace cumplir cada agente

| | Claude Code | Antigravity CLI |
|---|---|---|
| Las herramientas de archivos del agente | **se cumple**: reglas `Read(...)` en `permissions.deny`, escritas por `/relevo:init` entre las líneas `# relevo:restricted begin` y `# relevo:restricted end` del workflow en la nube, en el input `settings` de la action, que la action mezcla en los ajustes de usuario del ejecutor, fuera del repositorio | **se cumple** para las rutas exactas de la lista: una regla `read_file(...)` por cada archivo restringido que existe en el árbol, escrita fuera del repositorio al empezar la ejecución. La herramienta no documenta globs, y un nombre sin ruta solo coincide en la raíz, así que un archivo creado después de empezar la ejecución no queda cubierto |
| Los scripts de Relevo | **se cumple**: se niegan a abrir o publicar un archivo restringido, y el commit seguro rechaza uno en el diff | **se cumple**, igual |
| Un comando de archivos en un shell (`cat .env`) | **se cumple** para los comandos que Claude Code reconoce (`cat`, `head`, `tail`, `sed`, redirecciones), con las reglas `Read` | **no cubierto**: la denegación no alcanza a un comando (probado), y los comandos de la lista permitida pueden leer el archivo |
| Un proceso que abre el archivo por sí mismo (un script, `node -e`) | **no cubierto en la nube**: el workflow escribe `sandbox.filesystem.denyRead` pero no activa el sandbox, porque no se ha demostrado que la construcción siga descargando, comentando, etiquetando y subiendo con él activado. Donde una persona activa el sandbox de Claude Code (una ejecución local), la denegación rechaza al proceso | **no cubierto** |
| Un comando que lee sin nombrar el archivo (`grep -r`) | **parcial**: ninguna regla `Read` lo cubre por nombre; en la nube no está cubierto, y donde una persona activa el sandbox la denegación sí | **no cubierto** |
| El contenido que ya llegó a una transcripción o a un log | **no cubierto** | **no cubierto** |
| Un archivo restringido versionado por error | **no cubierto**: está en el historial. `go` y `/relevo:doctor` lo reportan, y hay que rotar el secreto | **no cubierto**, igual |

En la máquina de una persona Relevo propone y comprueba, y nunca hace cumplir: `/relevo:init` muestra las entradas y las escribe en tus ajustes solo tras un sí a ese punto, y `/relevo:doctor` avisa, por nombre de ruta y sin abrir ningún archivo, de cada archivo restringido que existe en la carpeta de trabajo y que ninguna denegación cubre.

**Ningún archivo de ignorar es un control.** Una entrada de `.gitignore` saca un archivo de git, no del alcance de un agente; `.claudeignore` no tiene efecto según la documentación de Claude Code, y `.claudecode.json` no está documentado como control. Relevo escribe solo ajustes que la documentación de la herramienta lista como denegación de lectura, y no ofrece ninguno de esos archivos como protección.

## En un repositorio público

- Pon `trust: public`. Solo el `ready` de un mantenedor inicia una ejecución, nada corre con contenido de forks, y `review.mode` no puede ser `none`.
- Lee un issue escrito por un desconocido antes de poner `ready`: lo que lees es lo que se construye, y el hash lo garantiza.
- Restringe la red de salida del ejecutor si tu plataforma lo permite; Relevo no lo hace por ti.
- Mantén activado en el repositorio un escáner de secretos con bloqueo de push.

## Secretos

- Los secretos viven solo en el almacén de secretos del repositorio: `ANTHROPIC_API_KEY` o `CLAUDE_CODE_OAUTH_TOKEN` (o `GEMINI_API_KEY` con `agent.build: antigravity`) para el modelo, `RELEVO_LINKS_TOKEN` para los repositorios de `links`, y `RELEVO_SHIP_APP_ID` y `RELEVO_SHIP_APP_KEY` para la GitHub App del workflow de ship, cuando la rama base exige checks.
- Nunca van en `relevo.yml`, en un issue ni en un commit, y `/relevo:doctor` muestra solo si un secreto existe, nunca su valor.
- Los workflows no exponen secretos al código que viene de forks.
