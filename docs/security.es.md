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

## En un repositorio público

- Pon `trust: public`. Solo el `ready` de un mantenedor inicia una ejecución, nada corre con contenido de forks, y `review.mode` no puede ser `none`.
- Lee un issue escrito por un desconocido antes de poner `ready`: lo que lees es lo que se construye, y el hash lo garantiza.
- Restringe la red de salida del ejecutor si tu plataforma lo permite; Relevo no lo hace por ti.
- Mantén activado en el repositorio un escáner de secretos con bloqueo de push.

## Secretos

- Los secretos viven solo en el almacén de secretos del repositorio: `ANTHROPIC_API_KEY` o `CLAUDE_CODE_OAUTH_TOKEN` para el modelo, y `RELEVO_LINKS_TOKEN` para los repositorios de `links`.
- Nunca van en `relevo.yml`, en un issue ni en un commit, y `/relevo:doctor` muestra solo si un secreto existe, nunca su valor.
- Los workflows no exponen secretos al código que viene de forks.
