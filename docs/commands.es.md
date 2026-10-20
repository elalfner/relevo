# Comandos

[English](commands.md) · Español

Se distribuye como un plugin de Claude Code llamado `relevo`:

| Comando | Qué hace |
|---|---|
| `/relevo:init` | Configura el repositorio (incluidas las [plataformas y sus stacks](stacks.es.md)), las etiquetas, la protección de ramas y los workflows (idempotente, muestra un plan primero) |
| `/relevo:think` | Prepara el contexto antes de que exista un issue: ejecuta la skill `openspec-explore` y después la skill `grill-with-docs`, una tras otra, en la misma conversación. Las skills hacen el trabajo; `think` solo las encadena y pasa a `issue`. `grill-with-docs` está publicada de modo que solo tú puedes lanzarla, así que cuando toca, `think` te pide que ejecutes `/grill-with-docs` en la misma conversación. No escribe archivos: las entradas de glosario y los registros de decisión que se acuerdan viajan en la sección `Documentation` del issue, así nadie tiene que subirlos a mano |
| `/relevo:issue` | Convierte una idea en issues que pasan la comprobación de spec: pregunta solo lo que falta, comprueba, muestra y luego crea (nunca inicia una construcción). Con el número de un issue lo reescribe, solo mientras no esté en cola, en construcción ni construido |
| `/relevo:go` | Construye un issue listo: comprobación de spec, construcción, QA con un reintento (se ejecuta solo en la nube). Verifica que el texto del issue sea el aprobado, rechaza las rutas protegidas y dice qué hacer cuando la rama ya existe |
| `/relevo:review` | Revisión guiada en dispositivo: la persona maneja, el agente captura y audita los logs |
| `/relevo:fix` | Corrige lo que salió de la revisión, actualizando primero la spec |
| `/relevo:ship` | Verifica la aprobación, archiva la spec, mergea y cierra el ciclo |
| `/relevo:status` | Quién espera a quién, más un resumen diario |
| `/relevo:doctor` | Comprueba que el entorno y los ajustes del repositorio son correctos, incluidas las herramientas y skills que pide cada [perfil de stack](stacks.es.md) |

## Cada comando, con sus argumentos

### `/relevo:init`

Sin argumentos. Mira el repositorio, propone las plataformas, los ajustes y los workflows, muestra un plan y lo aplica solo después de que estés de acuerdo. Es seguro ejecutarlo otra vez.

```text
/relevo:init
```

### `/relevo:think [idea or #issue]`

Una idea, o el número de un issue que volvió con una pregunta abierta. Explora, después te entrevista, y termina con el acuerdo que `/relevo:issue` convierte en issues. No escribe ningún archivo.

```text
/relevo:think mostrar quién cumple años hoy en la pantalla de inicio
/relevo:think #42
```

### `/relevo:issue [what to build, the path of a saved agreement, or the number of an issue to update]`

Qué construir, la ruta de un acuerdo guardado, o el número de un issue que reescribir. Pregunta solo lo que falta, comprueba cada borrador, los muestra, los crea cuando los apruebas y después pregunta, como una pregunta aparte, si pone `ready`.

```text
/relevo:issue un botón de reinicio en la pantalla del contador
/relevo:issue 42
```

### `/relevo:go [issue-number] [--local] [--decision <base64>]`

El número de un issue `ready`. En la nube corre solo cuando se pone `ready`; a mano, `--local` lo construye en tu máquina en un worktree aparte. `--decision` lo pasa el workflow, no se escribe.

```text
/relevo:go 42 --local
```

### `/relevo:review [issue-number]`

El número de un issue `built`. Empieza la revisión en el dispositivo o en un navegador, muestra un resumen corto, la lista de capturas y la lista de verificación, y te espera. Tú escribes `ok 1 2`, `fail 3 <qué pasó>`, `capture <nombre>`, `waive <n> <motivo>` o `done`.

```text
/relevo:review 42
```

### `/relevo:fix [issue-number] [what is wrong]`

El issue y qué está mal, con tus palabras. Escribe primero el comportamiento correcto en la especificación, después el código, y devuelve el issue a donde estaba.

```text
/relevo:fix 42 el total muestra 3 cuando hay 4 clientes
```

### `/relevo:ship [issue-number]`

El número de un issue `pr-open` cuyo pull request aprobó alguien que no es el autor. Muestra lo que va a pasar, pide un sí escrito, archiva la especificación, fusiona y cierra el issue.

```text
/relevo:ship 42
```

### `/relevo:status`

Sin argumentos. Quién espera a quién, los issues `ready` asignados a ti y cualquier construcción que dejó de reportar.

```text
/relevo:status
```

### `/relevo:doctor`

Sin argumentos. Comprueba las herramientas, las skills, `relevo.yml`, los workflows y los ajustes del repositorio, y dice cómo arreglar cada problema.

```text
/relevo:doctor
```

## El formato del issue

`/relevo:issue` escribe el issue y `/relevo:go` lo construye, así que el issue es lo único que recibe quien construye. Además de los escenarios y los casos borde, puede llevar lo que el acuerdo dejó decidido, en secciones opcionales: `Outcome`, `Decisions` (cada una con un id `D1`, lo decidido, el porqué y lo descartado), `Constraints` (`C1`), `Code pointers`, `Verification`, `Assumptions` y `Open questions`. `go` las copia palabra por palabra al diseño del cambio, y QA rechaza una construcción que rompa una decisión o una restricción, citando su id. Un issue con una pregunta abierta, o con el texto `NEEDS CLARIFICATION`, vuelve a quien lo escribió como ambiguo. El formato está en [Writing an issue Relevo can build](issue-format.md).

- `/relevo:think` escribe lo que dejó decidido con ids antes de pedirte que ejecutes la entrevista, y `/relevo:issue` muestra una tabla de qué id fue a qué sección; un id solo se descarta si tú lo dices.
- `/relevo:think #42` parte de un issue que volvió con una pregunta abierta.
- Tras crear los issues, `/relevo:issue` hace una pregunta aparte: ¿pongo `ready` ahora? Nada empieza sin tu sí.
- Antes de redactar, `/relevo:issue` busca issues abiertos parecidos.
- `/relevo:review` empieza con un resumen corto (qué se pidió, el resultado, qué revisar primero) calculado a partir del issue.

## Qué comprueba `review`

`review` es donde una persona cierra el ciclo, así que sus guardas no pasan por accidente.

- **Un log vacío no demuestra nada.** Si el log del dispositivo está vacío, o ninguna de sus líneas la escribió la app, la auditoría dice `REVIEW INCONCLUSIVE`. No es un pase y no se puede exentar: arranca la app de nuevo, repite los pasos y audita otra vez.
- **Puedes aceptar un hallazgo conocido, por escrito.** `waive <número> <motivo>` es solo tuyo; el agente nunca lo sugiere. Cuando todos los hallazgos están exentos el veredicto dice `REVIEW PASSED (with waivers)` y el cuerpo del pull request los lista con tus motivos. Un hallazgo que no exentaste sigue bloqueando, y las exenciones se borran si una corrección cambia la especificación.
- **El log se guarda mientras pruebas**, así una revisión larga no pierde líneas por el buffer del dispositivo.
- **Un micro-fix es un commit** antes de que se abra el pull request.
- **Prueba el código actual**: trae la rama remota antes de fusionar la base, y te pide confirmar por escrito si no eres la persona asignada.
- **Sin un segundo pull request**: se reutiliza el que ya exista para la rama, y un push rechazado se detiene con el motivo.

## Dejar que el agente ayude con la revisión

Por defecto la persona lo hace todo en `review` y el agente solo observa. Con `review.autopilot` en `precheck` o `verify` el agente también puede recorrer la lista, y la persona sigue confirmando las líneas y dando el acuerdo antes de que se abra un pull request.

- **Dónde funciona.** Una app Flutter en un dispositivo Android se maneja con `flutter_driver` (la app necesita `lib/main_driver.dart` con `enableFlutterDriverExtension()`); una app web (Vue, o Flutter en web) se maneja en un navegador propio con un script de Playwright que el agente escribe a partir de los escenarios y que `qa` lee antes. Un destino web no tiene revisión manual, así que necesita `precheck` o `verify`. La revisión de iOS aún no está disponible.
- **Qué no puede hacer.** Nunca usa coordenadas, `adb shell input`, Appium ni Maestro, nunca tu navegador, nunca un sitio que no sea `localhost`, la página en revisión o uno de `review.allowed_origins`, y nunca envía un mensaje ni hace una llamada en otra app. Antes de empezar confirmas por escrito que la app apunta a datos que no son de producción. Un usuario de prueba se da como el nombre de una variable de entorno; el agente nunca ve el valor.
- **Qué registra.** En `precheck` anota su propio resultado por línea y tú confirmas cada una. En `verify` puede marcar una línea `ok (auto)` solo cuando el `THEN` lo probó una aserción, un finder o el log, y el pull request lista esas líneas. El aspecto, la animación y la fidelidad a una imagen siguen siendo tuyos.
- **El valor por defecto es `off`** porque la revisión conducida aún no se ha ejecutado contra una app real; el repositorio la activa.
- **Un script no está aislado.** El ejecutor rechaza un script que toque el sistema de archivos, el proceso o la red fuera del navegador, pero eso es una alarma, no un aislamiento; lee un script que vaya a tocar algo sensible.

## Qué comprueban `fix` y `ship`

`fix` y `ship` cambian una rama después de que una persona la miró, así que las reglas que no deben variar están en scripts.

- **Una corrección que QA rechaza se guarda, no se pierde.** Tras los reintentos, `fix` guarda el trabajo en un stash llamado `relevo-fix #<n> iteration <k>` y deja el árbol limpio. El siguiente `/relevo:fix <n>` te lo ofrece de vuelta (el stash existe solo en esa copia del repositorio). Un conflicto al restaurar se detiene y conserva el stash; descartarlo necesita tu confirmación escrita.
- **Una rama que solo tiene la especificación no se "corrige".** `fix` dice que borres la rama remota y vuelvas a aplicar `relevo:ready`.
- **La lista de tareas se comprueba.** Antes del desarrollador, las únicas tareas abiertas son las correcciones; una empieza por `Test:` (un test de regresión), salvo que todas las correcciones terminen con `(device only)`. Tras QA, no queda ninguna abierta.
- **`ship` se puede ejecutar otra vez.** Si el cambio ya está archivado en la rama, `ship` sigue desde el merge. Si el archivo deja conflictos solo dentro de `openspec/`, revierte el commit de archivo, trae la rama base y archiva de nuevo, con pushes normales. Un conflicto en código lo detiene.
- **Una aprobación vale para el código que vio.** Una aprobación dada sobre un commit anterior no cuenta; tras el commit de archivo, sigue contando la dada sobre la cabeza registrada al empezar.
- **El issue debe estar en `pr-open`**, y `ship` nombra el comando que falta (`/relevo:review` o `/relevo:fix`) si no. El cambio se valida y no tiene tareas abiertas antes de archivarse.
- **Quién ejecuta `ship`.** Con `review.merger: approver`, un miembro de `team.members` que no sea el autor ni quien escribe la spec (y, en modo `roles`, uno de `team.approvers`). Quien sea elegible pero no aprobó confirma por escrito que no lo hizo.

## Skills que usa `think`

`/relevo:think` no reimplementa nada: ejecuta directamente dos skills que ya existen, así que su comportamiento es exactamente el de ellas.

| Skill | Viene de | Papel en `think` |
|---|---|---|
| `openspec-explore` | [OpenSpec](https://github.com/Fission-AI/OpenSpec) (`openspec init`) | explora la idea y el código |
| `grill-with-docs` | [mattpocock/skills](https://github.com/mattpocock/skills) | te entrevista hasta que cada decisión está tomada; la lanzas tú con `/grill-with-docs` cuando `think` te lo pide, porque su autor la reservó para la persona; las entradas de glosario y de registros de decisión que acuerda se entregan a `create`, no se escriben |
| `grilling`, `domain-modeling` | [mattpocock/skills](https://github.com/mattpocock/skills) | las usa `grill-with-docs` |

El plugin no las contiene: lo que copia `/plugin install` es `skills/`, `agents/` y `templates/`. Instálalas en tu proyecto (`openspec init` y `npx skills add mattpocock/skills`); si falta una, `think` se detiene y dice cuál.

Este repositorio sí guarda copias para trabajar en él: las skills y los comandos de OpenSpec bajo `.claude/` (generados por OpenSpec 1.14.1; se refrescan con `openspec update`) y las skills de mattpocock/skills bajo `.agents/skills/`, enlazadas desde `.claude/skills/` (instaladas con `npx skills add`, fijadas en `skills-lock.json`). Sus avisos de licencia están en [NOTICE](../NOTICE).
