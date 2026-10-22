# Modelo de seguridad

[English](security.md) · Español

Relevo deja que un agente de IA escriba y ejecute código en tu repositorio, sin supervisión. Esta página dice qué hace para que eso sea seguro y qué no hace. Reduce el riesgo; no lo elimina, y la revisión humana del pull request es la última barrera.

## Qué protege Relevo y cómo

| Amenaza | Medida | Quién lo hace cumplir |
|---|---|---|
| El agente empuja a la rama base o a la de publicación | una regla que permite al agente crear solo ramas `feature/*`; `/relevo:init` la crea y `/relevo:doctor` avisa si falta | la plataforma |
| El agente o la automatización aprueba o fusiona | aprobar y fusionar son actos humanos explícitos: `/relevo:ship` pide una confirmación escrita, y el autor no puede aprobar su propio pull request | la plataforma, y `ship` |
| El texto de un issue, comentario o log se toma como una instrucción | el texto se trata como datos, y el agente tiene una lista cerrada de herramientas sin acceso a la web (`WebFetch`, `WebSearch`, `curl` y `wget` se rechazan) | el ejecutor |
| El issue se edita después de que alguien le puso `ready` | el texto aprobado se resume con un hash y `go` se niega a construir otro distinto (`issue-hash.mjs`) | un script |
| Una ejecución cambia los archivos que controlan el workflow | los workflows, `relevo.yml`, `.relevo/`, las carpetas de skills y el archivo de reglas del proyecto son rutas protegidas; un commit que las toca se rechaza (`commit-change.mjs`) | un script |
| Una ejecución añade una dependencia que ejecuta código al instalarse | los archivos de dependencias están protegidos salvo que el issue los liste en `Allow-paths:`, las dependencias se instalan sin scripts de paquetes, y QA rechaza una dependencia que el diseño no justifica | un script, y QA |
| Un pull request cambia las skills que sigue el agente | las skills extra se leen de la rama base, nunca de la rama en trabajo, y una skill con scripts solo corre si `skills.allow_scripts` la lista | un script |
| Un repositorio debilita las comprobaciones de un stack | el perfil de un repositorio puede añadir al del plugin pero no reemplazar un comando; solo lo hace `platforms.<name>.checks`, a la vista | un script |
| Un secreto o una marca temporal llega a un commit | el diff se escanea antes de cada commit y push (`scan-diff.mjs`) y el commit se aborta si hay coincidencia | un script |
| Una ejecución gasta sin límite | cada ejecución tiene límites de turnos y de costo (`limits.run_max_turns`, `limits.run_max_cost`), y una que alcanza uno se detiene | el ejecutor |
| El texto de un repositorio enlazado trae instrucciones | se lee como datos, con un token de solo lectura (`RELEVO_LINKS_TOKEN`) | el ejecutor, y una lista cerrada de repositorios |
| Una imagen en un issue muestra datos de clientes al modelo, o una descarga va adonde no debe | las imágenes pegadas se descargan solo cuando `design.images` está activo; las descarga un script, no el agente, solo de los dominios de adjuntos de GitHub y de repositorios enlazados, con límites de tamaño y de tipo y el token enviado solo a GitHub; los archivos quedan fuera de git | un script |
| Una revisión conducida llega a un sitio al que no debe | el navegador del agente es limpio y solo alcanza `localhost`, la página en revisión y `review.allowed_origins`, y las credenciales de prueba se pasan por nombre de variable y se redactan | un script |
| El runner ejecuta una versión de Relevo distinta de la que leíste | los workflows instalan el paquete publicado en una versión fijada (`RELEVO_VERSION`), publicado desde un tag con procedencia, y se detienen si falta un script | el runner |

## Qué no protege

- **La inyección de prompts no tiene una defensa completa.** Una instrucción oculta en un README, un comentario o un paquete aún puede desviar al agente. Relevo reduce lo que puede hacer un agente desviado (sin web, una lista cerrada de herramientas, rutas protegidas, límites), no si puede desviarse.
- **El código que escribe el agente corre en el ejecutor.** Las pruebas y la construcción corren con la red y los permisos del ejecutor. La lista cerrada restringe las herramientas del agente, no el sistema operativo, así que un código malicioso que el agente fue llevado a escribir correría ahí hasta que QA y la revisión lo detengan.
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

## En un repositorio público

- Pon `trust: public`. Solo el `ready` de un mantenedor inicia una ejecución, nada corre con contenido de forks, y `review.mode` no puede ser `none`.
- Lee un issue escrito por un desconocido antes de poner `ready`: lo que lees es lo que se construye, y el hash lo garantiza.
- Restringe la red de salida del ejecutor si tu plataforma lo permite; Relevo no lo hace por ti.
- Mantén activado en el repositorio un escáner de secretos con bloqueo de push.

## Secretos

- Los secretos viven solo en el almacén de secretos del repositorio: `ANTHROPIC_API_KEY` o `CLAUDE_CODE_OAUTH_TOKEN` (o `GEMINI_API_KEY` con `agent.build: antigravity`) para el modelo, y `RELEVO_LINKS_TOKEN` para los repositorios de `links`.
- Nunca van en `relevo.yml`, en un issue ni en un commit, y `/relevo:doctor` muestra solo si un secreto existe, nunca su valor.
- Los workflows no exponen secretos al código que viene de forks.
