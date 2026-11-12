# Guía

[English](guide.md) · Español

Esta página responde "¿qué hago ahora?". Las otras páginas dicen qué es cada comando y cada ajuste; esta sigue un issue desde la idea hasta la fusión y dice qué hacer cuando algo no sale como estaba previsto.

## La vida de un issue

Un issue está siempre en un estado, que muestra una etiqueta, y cada estado tiene un siguiente paso. Esta misma tabla es lo que dicen los mensajes de traspaso.

| Estado | Siguiente comando | Quién |
|---|---|---|
| `ready` | ninguno: el agente empieza solo; para construir en tu máquina, `/relevo:go <n> --local` | nadie |
| `queued` | ninguno: empieza cuando la persona asignada tiene capacidad | nadie |
| `building` | ninguno: el agente lo está construyendo | nadie |
| `blocked` | ninguno: empieza cuando se fusionan los issues de los que depende | nadie |
| `built` | `/relevo:review <n>` | la persona asignada |
| `in-review` | `/relevo:review <n>` para continuar; si algo falla, `/relevo:fix <n>` | la persona asignada |
| `pr-open` | `/relevo:ship <n>`, después de que alguien que no sea el autor apruebe en GitHub; o pon `relevo:ship` al issue | quien aprueba |
| `needs-spec` | `/relevo:issue <n>`; si la pregunta necesita explorarse, antes `/relevo:think #<n>` | quien escribe la spec |
| `qa-failed` | `/relevo:fix <n>`; si la rama solo tiene la especificación, bórrala y vuelve a poner `ready`; si QA encontró algo que solo una persona puede aportar o decidir, `/relevo:issue <n>` después | la persona asignada |
| `changes-requested` | `/relevo:fix <n>` | el autor |
| `needs-reviewer` | ninguno: asigna un revisor, o pide a alguien que lo tome | quien escribe la spec |
| `ship` | ninguno: el workflow de ship lo está fusionando; si se detiene, su comentario dice por qué y se quita la etiqueta | nadie |
| `urgent` | ninguno: acompaña al estado de arriba y pide un inicio anticipado (ver abajo) | nadie |

Antes de que un issue tenga estado, `/relevo:think` explora la idea y `/relevo:issue` escribe el issue. `/relevo:status` muestra quién espera a quién.

## Qué hago cuando…

### La revisión encontró una falla

No edites el código tú. Escribe qué salió mal en la línea de la lista (`fail <número> <qué pasó>`), y ejecuta `/relevo:fix <n> <qué salió mal>`. Corrige primero la especificación y después el código, y el issue vuelve a donde estaba. Empieza `/relevo:review <n>` otra vez: las líneas que confirmaste siguen confirmadas, la que falló se prueba de nuevo.

### Un revisor pidió cambios

El issue pasa a `changes-requested` y se avisa al autor. Ejecuta `/relevo:fix <n> <lo que pidió el revisor>`. Al terminar, el issue vuelve a `pr-open` y se le pide al revisor que mire otra vez.

### Falló QA

El issue pasa a `qa-failed` y se avisa a la persona asignada, con el primer hallazgo. Cuando la construcción en la nube fue rechazada tras los reintentos (o dejó tareas sin terminar), el trabajo no se pierde: la rama lo guarda como un commit `wip: rejected by QA`, y el comentario dice que es código que QA no aprobó. Lo mismo pasa cuando una ejecución se detiene en un límite (los turnos de los subagentes, los minutos de `limits.run_max_minutes`) o la corta el runner o el timeout del job: el trabajo queda en la rama como `wip: stopped by limit`, el comentario dice que se guardó, y `/relevo:fix <n>` lo verifica y termina las tareas que faltan. Una construcción deja además un checkpoint después de cada sección de tareas (`wip: checkpoint k/n`), así que un corte pierde a lo sumo una sección; si vuelves a poner `ready` con el mismo texto del issue y nadie ha hecho commit en la rama, la ejecución en la nube reanuda desde ella y construye solo lo que falta. Ejecuta `/relevo:fix <n>`: toma el hallazgo de ese comentario como el defecto, así que no tienes que describirlo, y corre las comprobaciones que QA no pudo correr. Para repensar el issue, usa `/relevo:think` y luego `/relevo:issue <n>`. Si el comentario dice, en cambio, que no se construyó porque el runner no tiene una herramienta (por ejemplo `flutter`), el job de build se detuvo antes del agente y no se gastó ningún turno del modelo: activa el paso del toolchain en `relevo-go.yml`, quita `relevo:qa-failed` y vuelve a poner `ready`. Si el commit seguro rechazó el trabajo (una ruta protegida, un archivo restringido, un archivo fuera de la plataforma, un marcador o una posible credencial), no se sube nada y el comentario lo dice; entonces no hay rama que corregir: resuelve la causa que indica el comentario, quita `relevo:qa-failed` y vuelve a poner `ready`. Si la rama tiene código que escribiste tú, ejecuta `/relevo:fix <n>` y describe lo que encontró QA. Si solo tiene la especificación (la construcción falló antes de escribir código), borra la rama remota y vuelve a poner `ready`.

### Quién lo rechazó: la puerta o uno de los revisores

QA ya no es un solo agente. Primero un script (la **puerta**) ejecuta una sola vez el análisis, los tests y los escaneos, sin modelo; después cuatro revisores (las **lentes**) miran cada uno lo que le toca. El comentario nombra al que detuvo la construcción:

| Dice | Qué significa | Qué hacer |
|---|---|---|
| la puerta está roja | falló el análisis, un test, el escaneo de marcadores temporales y credenciales o la comprobación de archivos restringidos; no corrió ningún revisor | `/relevo:fix <n>`; el comentario trae el final de la salida que falló |
| automated validation could not run | falta una herramienta que el perfil necesita en el runner | instálala (el agente de desarrollo no puede); no se revisó nada |
| `spec` | el código no hace lo que dice un escenario, una tarea, una decisión o una restricción del issue, o toca un archivo fuera de la plataforma, un archivo de configuración o una dependencia que el issue no permite | lee el hallazgo; `/relevo:fix <n>` o cambia el issue |
| `security` | un problema de seguridad en el diff, con la línea que lo muestra | `/relevo:fix <n>` |
| `code` | un test débil, un resto olvidado o lo que el perfil del stack lista como defecto | `/relevo:fix <n>` |
| `interface` | el cambio rompe una regla de interfaz o no coincide con una referencia de diseño | `/relevo:fix <n>`. En el **último** intento este revisor solo aconseja: sus hallazgos no bloquean |
| lens report invalid | un revisor no respondió con la forma esperada dos veces | vuelve a ejecutarlo; el código no tenía nada malo |

Cuando la puerta está roja, el agente de desarrollo lo corrige antes de que corra cualquier revisor, y eso gasta uno de los intentos, así que el total sigue siendo `qa.retries + 1`.

**Las notas consultivas.** Cuando la construcción pasa, QA todavía puede dejarte notas: los hallazgos del revisor `interface` en el último intento y los escenarios que solo una persona en un dispositivo puede confirmar. El comentario `built` dice cuántas hay y nombra el revisor de las tres primeras, y `/relevo:review` añade cada una al checklist, pendiente, con el revisor que dudó. Mira esas primero.

### Se acabó la cuota

Una ejecución en la nube que se detiene por un límite de uso o un crédito vacío lo dice en el último comentario, y el issue vuelve solo a `queued`: el comentario dice cuándo se reintentará (después de la hora de restablecimiento que da el log de la ejecución, en UTC, o, si el log no la da, tras una espera de 30 minutos, luego 2 horas y luego 5 horas, y dice que esa hora es una estimación). El reintento continúa desde el trabajo que se guardó en la rama, empieza solo (los demás issues en espera siguen cuando termina) y se hace como máximo 3 veces; después el issue queda en `qa-failed` y el comentario te pide que lo revises, y puedes volver a poner `ready` o construirlo en tu máquina con `/relevo:go <n> --local`. Si pones `ready` tú mismo, empieza de inmediato. Con una suscripción la cuota se comparte con el uso interactivo de la misma cuenta, así que un día muy activo puede agotarla.

### No sé cuál es el comportamiento correcto

No adivines en una corrección. Ejecuta `/relevo:think` para explorarlo (o `/relevo:think #<n>` para un issue que volvió con una pregunta), y después `/relevo:issue <n>` para escribir la respuesta en el issue. Un issue con una pregunta abierta no pasa la comprobación y no se construye.

### Un issue no puede esperar

Pon `relevo:urgent` al issue, junto a su estado, cuando no deba esperar en la cola detrás de otros ni detrás del trabajo sin revisar de la persona asignada. Un issue urgente se mira antes que el resto y no lo frena que la persona asignada ya tenga `limits.built_unreviewed_per_person` issues construidos esperando. Sigue necesitando todo lo demás: una especificación completa, dependencias fusionadas (un urgente que depende de un issue abierto queda `blocked` y el aviso lo dice) y un hueco libre de agente (`limits.concurrent_agents`). Cuando empieza por encima del límite, el mensaje de traspaso le dice a la persona asignada cuántos issues construidos esperan ahora.

La etiqueta solo cuenta si quien la puso podía marcar el issue como `ready`: acceso de escritura, o de mantenedor cuando `trust` es `public`. Si no, se quita la etiqueta y un comentario dice por qué. Ponerla a un issue `queued` inicia la evaluación de la cola de inmediato.

### El issue volvió a needs-spec

Lee el último comentario: dice qué falta. Si falta información, ejecuta `/relevo:issue <n>` y complétala. Si hay una pregunta abierta, decídela, antes con `/relevo:think #<n>` si necesitas explorar. Después vuelve a poner `ready`.

El comentario dice por qué, y el build se detuvo antes de que empezara el agente, así que no se gastó ningún turno del modelo:

- **`missing`**: no se pudo leer una referencia del issue (un archivo de diseño, un repositorio enlazado). Corrige la referencia o el acceso de `RELEVO_LINKS_TOKEN`.
- **`inputs`**: el issue declara en su sección `External inputs` algo que no está: un archivo que no existe en la rama base o una variable que no está definida. Agrégalo, o escribe qué debe hacer el issue sin eso. Un secreto o una entrada manual que el job no puede comprobar no es motivo para detenerse: aparece en el aviso de entrega como `Inputs to confirm before you test`.
- **`policy`**: una tarea de la especificación cambia una ruta protegida o un archivo restringido, o agrega una dependencia que el issue no permite. Agrega el manifiesto a `Allow-paths:` si la dependencia es intencional, o cambia la tarea. Una ejecución sin supervisión nunca edita un archivo protegido.

### Una rama que tiene conflictos con la base

`/relevo:review <n>` primero mezcla la rama base en la rama. Cuando hay archivos en conflicto, los conflictos dentro de las rutas que el cambio puede tocar se entregan al agente de desarrollo en su modo de integración; luego QA revisa el resultado y solo después se hace el commit del merge. Un conflicto en cualquier otro archivo, o uno que QA no acepta, termina con el merge abortado y sin cambios, y la revisión te dice qué archivos resolver tú. `/relevo:status` muestra, para una rama atrasada respecto a la base, si el merge tendría conflictos y en qué archivos.

## Cómo leer la revisión de una vista previa

Cuando `think` te muestra una vista previa en HTML, te dice el resultado de la revisión automática de cada elemento:

- **pass**: se midió y está dentro del umbral.
- **fail**: está fuera del umbral y `think` nombra el elemento. Corrige el archivo y revisa otra vez, como máximo dos veces; si sigue fallando ves la vista previa con el elemento que falla nombrado.
- **not checked**: la revisión no pudo decidir (texto sobre una imagen, un degradado o un color parcialmente transparente). No es un pass: míralo tú.
- **approximate**: un valor vino de una aproximación, como un color derivado por opacidad, así que la relación no es exacta.

Si la máquina no tiene automatización de navegador, no se revisó nada y `think` lo dice; nunca muestra como revisada una vista previa que no lo fue. Una vista previa móvil es un boceto aproximado en un marco de teléfono: comprueba que el texto cabe, que los objetivos táctiles son suficientemente grandes y que el contraste se sostiene, y no dice nada de cómo se verá realmente la app. La revisión en el dispositivo es donde se decide la apariencia.

## Fix o un issue nuevo

- Usa `/relevo:fix <n>` cuando lo construido no hace lo que dice su issue, o el revisor pidió un cambio de la misma funcionalidad: el defecto está en lo construido.
- Escribe un issue nuevo cuando el trabajo es correcto pero quieres otra cosa, o algo más: es otra funcionalidad, con sus propios escenarios.
- Si el comportamiento correcto nunca se escribió, es un hueco del issue y no un defecto: `fix` lo escribe antes como escenario, así que descríbelo como el comportamiento que esperas.

## Nube, local o ambos

- **Ambos** (el valor por defecto) construye en la nube cuando se pone `ready`, y aun así puedes construir a mano.
- Para construir a mano, ejecuta `/relevo:go <n>` en tu sesión para mirar e intervenir, o añade `--local` para dejarlo corriendo con los límites de la nube: [la diferencia](commands.es.md#en-la-sesión-o-por-separado).
- **Solo nube** sirve para construir sin que nadie espere; **solo máquinas** no tiene secreto de modelo en el repositorio y cada persona usa su propia sesión.
- Para cambiar sin un pull request, pon la variable del repositorio `RELEVO_CLOUD_GO` en `off` y la nube se detiene; bórrala para reanudar, y vuelve a poner `ready` a los issues que esperaron. Los detalles están en [Dónde corre `go`](execution.es.md).

## Credenciales y límites

- Con una clave de API, `limits.run_max_cost` es un tope real de gasto; con una suscripción es solo nocional y los controles son `limits.run_max_turns` y un `limits.concurrent_agents` bajo.
- Cada ejecución en la nube deja un comentario con sus turnos, costo y tokens cuando el log los tiene.
- Una ejecución que alcanza su límite de turnos o de costo se detiene y el issue queda en `qa-failed` con el motivo.

## Repositorios públicos

- Pon `trust: public`. Solo el `ready` de un mantenedor inicia una ejecución, y `review.mode` no puede ser `none`.
- El issue que escribió un desconocido no se construye hasta que un mantenedor lo haya leído: cópialo a un issue tuyo, o edítalo, y pon `ready` tú. Lo que lees es lo que se construye.
- Lee [Modelo de seguridad](security.es.md) antes de empezar: dice qué está protegido y qué no.
