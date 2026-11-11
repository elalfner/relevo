# Configuración

[English](configuration.md) · Español

Relevo lee su comportamiento de un `relevo.yml` por repositorio, en la raíz. `/relevo:init` lo crea y lo actualiza. Nunca pongas en él claves de API ni tokens: van en el almacén de secretos del repositorio.

Valida el archivo con:

```bash
node scripts/validate-config.mjs relevo.yml
```

La plantilla que se distribuye, con un comentario en cada línea, es [templates/relevo.yml](../templates/relevo.yml). Las reglas están en [la especificación](../openspec/specs/configuration/spec.md), escrita en inglés.

| Ajuste | Qué controla | En la plantilla |
|---|---|---|
| `branches.base` | rama de integración: toda rama de construcción sale de ella y su pull request apunta a ella, sea cual sea la rama por defecto del repositorio | `dev` |
| `branches.release` | rama de publicación, que se promueve desde la base en un pull request aparte | `main` |
| `links` | repositorios de los que un issue puede depender con `Depends-on: owner/repo#N`, o a los que puede apuntar con `owner/repo:path` en `Design reference` y `Code pointers` (una lista cerrada); uno privado se lee con el secreto `RELEVO_LINKS_TOKEN`, un token fine-grained con acceso de lectura a issues, pull requests y contenido | ninguno |
| `tracker`, `git_provider`, `platforms` | dónde viven los issues y los pull requests, y las plataformas que se construyen ([Stacks y plataformas](stacks.es.md)); la línea anterior `platform: flutter-android` sigue funcionando | `github`, `github`, una plataforma Flutter para Android |
| `team.members` | usuarios de GitHub de las personas que construyen y revisan | vacío |
| `team.spec_writer` | quién escribe las specs; nunca revisa ni mergea | ninguno |
| `team.approvers` | quién puede aprobar, solo se usa cuando `review.mode` es `roles` | vacío |
| `review.mode` | `none` (en solitario), `peer` o `roles` | `peer` |
| `review.merger` | quién ejecuta `/relevo:ship`: `author` o `approver` | `approver` |
| `review.autopilot` | cuánto de la revisión puede conducir el agente: `off` (la persona lo hace todo), `precheck` (el agente recorre las líneas y anota su resultado; la persona confirma cada línea) o `verify` (el agente también puede marcar las líneas que probó con una aserción, un finder semántico, el log o el código de salida de un comando del proyecto; la persona confirma el resto y da el acuerdo). Un destino web necesita `precheck` o `verify`, y la revisión recomienda `verify`; haz commit del ajuste en la rama base | `off` |
| `review.ship_without_ci` | `true` deja que la etiqueta `relevo:ship` fusione un pull request sobre el que no corrió ningún check; `/relevo:ship` se lo pregunta a la persona | `false` |
| `review.allowed_origins` | orígenes web que una revisión conducida puede visitar además de `localhost`, por ejemplo `https://staging.example.com` | `[]` |
| `restricted_paths` | rutas o globs, relativos al repositorio, que ningún agente ni script de Relevo lee, y que se suman a la lista incorporada (`.env` y `.env.*` salvo los archivos de ejemplo (`.env.example`, `.env.sample`, `.env.template`, `.env.dist`), llaves privadas y certificados, archivos de credenciales como `.npmrc` y `.netrc`, configuración de servicios móviles, `secrets/`). Solo suma: no puede quitar una entrada incorporada, un perfil no puede debilitarla, y se rechaza una ruta absoluta o una que salga del repositorio ([Seguridad](security.es.md)) | `[]` |
| `skills.allow_scripts` | nombres de las skills extra que tienen scripts y pueden usarse; una skill con scripts que no está en la lista se deja fuera, y `/relevo:doctor` lo dice | vacío |
| `limits.built_unreviewed_per_person` | issues construidos que una persona puede tener esperando; un issue con una etiqueta `relevo:urgent` válida empieza igualmente | 2 |
| `limits.concurrent_agents` | ejecuciones sin supervisión a la vez | 3 |
| `limits.review_sla_hours` | horas antes de un recordatorio, y el mismo tiempo otra vez antes de escalar | 8 |
| `limits.run_max_turns` | turnos por ejecución sin supervisión: el runner limita al agente principal y Relevo limita a los subagentes juntos al mismo número | 100 |
| `limits.run_max_minutes` | minutos tras los cuales una ejecución sin supervisión no inicia más agentes (mínimo 5). Mantenla al menos 5 por debajo del `timeout-minutes` del job de build del workflow go, que es 60 | 50 |
| `limits.building_alert_hours` | horas sin actividad antes de reportar como atascado un issue en `building` ([Dónde corre `go`](execution.es.md)) | 3 |
| `limits.run_max_cost` | **obligatorio** con `agent.build: claude` (el valor por defecto), y se rechaza con `antigravity`: dólares por ejecución sin supervisión; elige el tuyo | 5 |
| `limits.run_max_tokens` | **obligatorio** con `agent.build: antigravity`, y se rechaza con `claude`: tokens por ejecución sin supervisión, que la guardia de ejecución de Relevo hace cumplir porque Antigravity no tiene un límite propio | ninguno |
| `runner.labels` | runner de todos los workflows de Relevo, como lista de etiquetas (`[self-hosted, linux-build]`); `/relevo:init` la escribe en los archivos de workflow y `/relevo:doctor` comprueba que coincidan. Relevo asume que cualquier runner persiste entre jobs, así que no hay un ajuste para eso ([Runners self-hosted](execution.es.md#runners-self-hosted)) | `[ubuntu-latest]` |
| `agent.build` | qué agente construye en la nube: `claude`, o `antigravity` (lo que cada uno puede y no puede hacer cumplir está en [Seguridad](security.es.md)) | `claude` |
| `qa.retries` | intentos del desarrollador después de que QA rechaza | 1 |
| `agents.dev.model`, `agents.dev.effort` | modelo (un alias como `sonnet` o un identificador completo) y esfuerzo (`low`, `medium`, `high`, `xhigh`, `max`) del agente de desarrollo | `sonnet`, `high` |
| `agents.qa.<lente>.model`, `agents.qa.<lente>.effort` | lo mismo para cada revisor de QA: `spec`, `security`, `code` o `interface`. Una lente desconocida falla; no hay clave para apagar una | `spec` y `security`: `opus`, `high`; `code`: `sonnet`, `high`; `interface`: `sonnet`, `medium` |
| `qa.rules_from` | reglas del proyecto que QA lee en cada ejecución: un archivo o una lista | `CLAUDE.md` |
| `evidence.policy` | `attach_to_pr`, o `local_only` para datos sensibles | `attach_to_pr` |
| `digest.issue` | número del issue donde se publica el resumen diario como comentario | ninguno |
| `language` | idioma de los mensajes de traspaso (`en`, `es`) | `en` |
| `design.images` | `true` descarga una imagen pegada en un issue y se la muestra al modelo (una captura puede mostrar datos de clientes); los archivos que ya están en el repositorio no dependen de esto | `false` |
| `design.system.tokens` | Archivos o carpetas dentro del repositorio con los colores, espacios y estilos de texto (un archivo de tema, un CSS de variables). El paso de interfaz de `think` lee solo estas rutas, o las que confirmes. Cada una debe existir y no ser restringida ni protegida | `[]` |
| `design.system.components` | Carpetas con los componentes reutilizables que una pantalla nueva debe usar | `[]` |
| `design.system.references` | Carpetas dentro del repositorio con capturas o bocetos para mirar | `[]` |
| `trust` | `private-team` o `public` | `private-team` |
| `labels` | renombra cualquier etiqueta; las claves son fijas, los nombres son tuyos | `relevo:ready`, `relevo:built`, … |

## Plataformas, perfiles y comprobaciones

- Cada entrada de `platforms` tiene un `stack`, un `path` y, para los stacks que los tienen, `targets`. [Stacks y plataformas](stacks.es.md) explica los perfiles que se incluyen.
- El perfil de un stack viene en capas: el archivo `stacks/<stack>.md` del plugin, y después `.relevo/stacks/<stack>.md` de tu repositorio. El tuyo añade texto de higiene, herramientas, skills y comandos que el plugin no tiene; no puede reemplazar un comando del plugin. Hazle commit, porque la nube y tus compañeros lo leen de git.
- Para reemplazar un comando, escríbelo en `platforms.<name>.checks`, a la vista, por ejemplo `analyze: "vendor/bin/pint --test && vendor/bin/phpstan analyse"`. Solo se pueden reemplazar los comandos que nombra el perfil (`analyze`, `test`, `format`).

## El modelo y el esfuerzo de cada agente

QA se compone de cuatro revisores (ver [Qué lee cada revisor de QA de un perfil](stacks.es.md#qué-lee-cada-revisor-de-qa-de-un-perfil)), y el agente de desarrollo y cada revisor tienen su propio `model` y `effort` bajo `agents`. Escribe solo lo que quieras cambiar; lo demás conserva su valor por defecto.

```yaml
agents:
  qa:
    security: { model: sonnet }   # el revisor de seguridad con el modelo que de otro modo no usaría
```

- **Las claves**, completas: `agents.dev.model`, `agents.dev.effort`, `agents.qa.spec.model`, `agents.qa.spec.effort`, `agents.qa.security.model`, `agents.qa.security.effort`, `agents.qa.code.model`, `agents.qa.code.effort`, `agents.qa.interface.model`, `agents.qa.interface.effort`.
- **El costo de los valores por defecto.** `spec` y `security` usan el modelo más potente (`opus`) por defecto, así que QA cuesta más que cuando era un solo agente con `sonnet`. Para mantener el costo anterior, pon ambos en `sonnet`:
  ```yaml
  agents:
    qa:
      spec: { model: sonnet }
      security: { model: sonnet }
  ```
  Los valores por defecto cambian solo con la evidencia de una evaluación de los revisores sobre defectos sembrados.
- **Un modelo es un nombre, no una lista.** Escribe un alias o un identificador completo; Relevo no lo comprueba contra una lista porque la lista cambia, y el entorno de ejecución rechaza el que no conoce.
- **Ningún ajuste apaga un revisor ni baja lo que bloquea.** Las excepciones de un proyecto van en su propio archivo de reglas (`qa.rules_from`), que el revisor `spec` ya lee. Toda regla de ese archivo es un requisito salvo que su línea (o el encabezado que la contiene) esté marcada `[advice]`; un hallazgo que cita un requisito como `Rule: <archivo>:<línea> "<sus palabras>"` bloquea, sin importar qué revisor lo escribió.
- **Con Antigravity** los ajustes se aceptan y no se aplican: no se escriben en los agentes que renderiza. `/relevo:doctor` y `/relevo:init` imprimen un aviso que nombra cada uno y siguen.

### Elegir el modelo de cada issue: `auto`

Un rol puede ser `auto` en lugar de un nombre de modelo. Entonces un script (`scripts/model-plan.mjs`, que `go` ejecuta una vez antes del primer lanzamiento) escoge su modelo según el issue, entre un piso y un techo; el agente principal no decide nada.

```yaml
agents:
  ladder: [haiku, sonnet, opus]     # el orden de los modelos, de menor a mayor (es el valor por defecto)
  dev:
    model: auto
    ceiling: sonnet                  # opcional: el modelo más alto que auto puede usar para este rol
    floor: haiku                     # opcional: el más bajo que puede escoger por tamaño
  qa:
    spec:
      model: auto
```

- **La escalera** es solo un orden. Relevo no comprueba los nombres contra una lista de modelos; un modelo nuevo es una línea más en `agents.ladder`.
- **El rango.** Sin `ceiling` es el modelo por defecto del rol (desarrollador `sonnet`, spec y security `opus`, code e interface `sonnet`), y sin `floor` es un escalón más abajo. Una lente de QA nunca queda por debajo de `sonnet` por defecto (la evaluación de lentes no aprobó `haiku` para `code` e `interface`, `docs/lens-evaluation.md`); escribe un `floor` para bajar más. Así `auto` no puede costar más que los valores por defecto salvo que subas un techo.
- **La puntuación.** El tamaño del cambio (tareas pendientes más escenarios del issue: hasta 6 toma el piso, hasta 14 el punto medio, más el techo), subido un escalón cuando el issue permite un archivo de dependencias en `Allow-paths:` o nombra un área sensible para la seguridad (autenticación, credencial, token, contraseña, pago, permiso, secreto, cifrado). La lente de seguridad va a su techo en ambos casos. Si no hay tareas ni escenarios que puntuar, se usa el modelo por defecto del rol. El esfuerzo no se puntúa: sigue siendo el configurado.
- **El issue puede pedir.** Una línea `Model: <nombre>` (desarrollador) o `QA-model: <nombre>` (todas las lentes) se lee solo para un rol en `auto`. Puede bajar el modelo libremente y subirlo solo hasta el techo; un nombre que no está en la escalera se ignora, y con `trust: public` las líneas se ignoran. Las líneas son parte del texto del issue, así que el hash del issue las cubre. `/relevo:issue` puede proponer una, con su motivo, y la escribe solo si lo confirmas.
- **Un rol que no es `auto`** conserva el modelo escrito, diga lo que diga el issue. `limits.run_max_cost` sigue siendo el tope duro en todos los casos.
- **El comentario dice qué se usó.** El comentario de uso de una corrida lista, para cada rol, el modelo, el esfuerzo, si vino de la configuración, de `auto` o del issue, y por qué. Si el plan no se puede hacer, `go` usa la configuración y lo dice.
- **Un reintento sube un escalón.** Cuando la puerta está en rojo o QA rechaza el trabajo y el desarrollador corre otra vez en modo fix, un desarrollador en `auto` sube un nombre en `agents.ladder` (`haiku` a `sonnet`, luego `opus`) y nunca pasa de su `ceiling`. Un desarrollador cuyo modelo está escrito en `relevo.yml` se queda en él, y las lentes no suben. Con el techo por defecto (`sonnet`) un reintento nunca cuesta más que los valores por defecto; sube `agents.dev.ceiling` para permitir un reintento en `opus`. El comentario dice cada paso.

## Qué significan los límites

- `limits.run_max_cost` es obligatorio y lo eliges tú. Con una clave de API es un tope real de gasto por ejecución. Con un token de suscripción el costo que reporta el log es nocional, así que es solo una red de seguridad contra una ejecución descontrolada.
- Con `agent.build: antigravity` no hay un límite de costo que fijar, porque el agente no lo tiene: el límite es `limits.run_max_tokens`, y la cuota y el presupuesto del proyecto de Google Cloud dueño de la clave son el tope que de verdad se cumple. `trust: public` todavía no se acepta con él.
- `limits.run_max_turns` es el control principal con una suscripción, junto con un `limits.concurrent_agents` bajo: la cuota la comparten todas las ejecuciones y el uso interactivo de la cuenta.
- **Dos topes de turnos, no una suma.** El runner cuenta contra `--max-turns` solo los turnos del agente principal. Relevo cuenta a los subagentes: cuando cada uno termina, `go` registra sus llamadas a herramientas desde el bloque de uso que cierra su reporte (sus turnos son las llamadas más uno), y antes de lanzar el siguiente agente (el desarrollador otra vez, o la siguiente lente de QA) consulta a `run-budget.mjs`. Cuando los turnos de los subagentes juntos llegan a `limits.run_max_turns`, o la ejecución lleva `limits.run_max_minutes`, no empieza otro agente y la ejecución toma la ruta de fallo con la razón `run limit reached`, con el nombre de los agentes que no corrieron. El guardia detiene una ejecución solo con una cifra que puede leer; un agente que ya está corriendo no se detiene a la mitad. El comentario sobre la ejecución sigue diciendo cuándo el total de turnos pasó el límite.
- **El trabajo no se pierde en un límite.** Cuando `go` se detiene en un límite, hace commit del trabajo como `wip: stopped by limit (#N)` y lo sube a la rama del issue, y `/relevo:fix` continúa desde ahí. Cuando el runner corta al agente (el límite de turnos o de costo del runner) o el job se cancela o vence, un paso del workflow go que siempre corre hace lo mismo con el árbol de trabajo que queda, con los mismos escaneos de cualquier commit (rutas protegidas, archivos restringidos, marcadores, credenciales); nunca fuerza un push y no sobrescribe nada: solo empuja un fast-forward de lo que hay en el remoto, y deja intacta una rama remota con commits que esta ejecución no tiene.
- Una ejecución que alcanza un límite de turnos, de minutos o de costo se detiene y el issue pasa a `qa-failed` con el motivo, y el comentario dice si el trabajo se guardó. [Dónde corre `go`](execution.es.md) tiene el resto.
