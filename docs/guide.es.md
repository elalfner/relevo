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
| `qa-failed` | `/relevo:fix <n>`; si la rama solo tiene la especificación, bórrala y vuelve a poner `ready` | la persona asignada |
| `changes-requested` | `/relevo:fix <n>` | el autor |
| `needs-reviewer` | ninguno: asigna un revisor, o pide a alguien que lo tome | quien escribe la spec |
| `ship` | ninguno: el workflow de ship lo está fusionando; si se detiene, su comentario dice por qué y se quita la etiqueta | nadie |

Antes de que un issue tenga estado, `/relevo:think` explora la idea y `/relevo:issue` escribe el issue. `/relevo:status` muestra quién espera a quién.

## Qué hago cuando…

### La revisión encontró una falla

No edites el código tú. Escribe qué salió mal en la línea de la lista (`fail <número> <qué pasó>`), y ejecuta `/relevo:fix <n> <qué salió mal>`. Corrige primero la especificación y después el código, y el issue vuelve a donde estaba. Empieza `/relevo:review <n>` otra vez: las líneas que confirmaste siguen confirmadas, la que falló se prueba de nuevo.

### Un revisor pidió cambios

El issue pasa a `changes-requested` y se avisa al autor. Ejecuta `/relevo:fix <n> <lo que pidió el revisor>`. Al terminar, el issue vuelve a `pr-open` y se le pide al revisor que mire otra vez.

### Falló QA

El issue pasa a `qa-failed` y se avisa a la persona asignada, con el primer hallazgo. Cuando la construcción en la nube fue rechazada tras los reintentos (o dejó tareas sin terminar), el trabajo no se pierde: la rama lo guarda como un commit `wip: rejected by QA`, y el comentario dice que es código que QA no aprobó. Ejecuta `/relevo:fix <n>`: toma el hallazgo de ese comentario como el defecto, así que no tienes que describirlo, y corre las comprobaciones que QA no pudo correr. Para repensar el issue, usa `/relevo:think` y luego `/relevo:issue <n>`. Si el comentario dice, en cambio, que no se construyó porque el runner no tiene una herramienta (por ejemplo `flutter`), el job de build se detuvo antes del agente y no se gastó ningún turno del modelo: activa el paso del toolchain en `relevo-go.yml`, quita `relevo:qa-failed` y vuelve a poner `ready`. Si el commit seguro rechazó el trabajo (una ruta protegida, un archivo fuera de la plataforma, un marcador o una posible credencial), no se sube nada y el comentario lo dice. Si la rama tiene código que escribiste tú, ejecuta `/relevo:fix <n>` y describe lo que encontró QA. Si solo tiene la especificación (la construcción falló antes de escribir código), borra la rama remota y vuelve a poner `ready`.

### Se acabó la cuota

Una ejecución en la nube que se detiene por un límite de uso o un crédito vacío lo dice en el último comentario. El issue no se pierde: vuelve a poner `ready` más tarde, o constrúyelo en tu máquina con `/relevo:go <n> --local`. Con una suscripción la cuota se comparte con el uso interactivo de la misma cuenta, así que un día muy activo puede agotarla.

### No sé cuál es el comportamiento correcto

No adivines en una corrección. Ejecuta `/relevo:think` para explorarlo (o `/relevo:think #<n>` para un issue que volvió con una pregunta), y después `/relevo:issue <n>` para escribir la respuesta en el issue. Un issue con una pregunta abierta no pasa la comprobación y no se construye.

### El issue volvió a needs-spec

Lee el último comentario: dice qué falta. Si falta información, ejecuta `/relevo:issue <n>` y complétala. Si hay una pregunta abierta, decídela, antes con `/relevo:think #<n>` si necesitas explorar. Después vuelve a poner `ready`.

## Fix o un issue nuevo

- Usa `/relevo:fix <n>` cuando lo construido no hace lo que dice su issue, o el revisor pidió un cambio de la misma funcionalidad: el defecto está en lo construido.
- Escribe un issue nuevo cuando el trabajo es correcto pero quieres otra cosa, o algo más: es otra funcionalidad, con sus propios escenarios.
- Si el comportamiento correcto nunca se escribió, es un hueco del issue y no un defecto: `fix` lo escribe antes como escenario, así que descríbelo como el comportamiento que esperas.

## Nube, local o ambos

- **Ambos** (el valor por defecto) construye en la nube cuando se pone `ready`, y aun así puedes construir a mano.
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
