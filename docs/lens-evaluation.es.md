# Evaluación de las lentes de QA sobre defectos sembrados

Esta página registra una evaluación de las cuatro lentes de QA (`spec`, `security`, `code`, `interface`) sobre defectos que se pusieron a propósito en cambios pequeños. Se hizo el 2026-11-02 con `scripts/eval-lenses.mjs`, y una segunda ejecución el 2026-11-04 cubrió todos los casos y midió el tiempo de cada lente. Lee los límites de abajo antes de fiarte de los números: la muestra es pequeña y la mayoría de las ejecuciones se gastaron en encontrar fallos de la propia evaluación.

## Qué se midió

Cada caso de `tests/fixtures/lens-defects/<lente>/<stack>/<caso>/` tiene una variante **mala**, con un defecto, y una variante **buena**, que solo difiere por el arreglo. Una lente **encuentra** un defecto cuando rechaza la variante mala con un hallazgo que coincide con el texto esperado del caso. Una variante buena que una lente rechaza cuenta como **falso positivo** de esa lente. La coincidencia es una prueba de palabras clave sobre el informe, así que es posible un acierto casual.

Cada variante se coloca en un repositorio git temporal con la rama base `main` vacía, y cada lente corre allí con el modelo de su archivo de agente. El recibo de la puerta de validación es **simulado**: se escribe en verde con un hash válido y dice que no se ejecutaron el análisis ni los tests. La lente de interfaz recibe las reglas que `interface-rules.mjs` selecciona para el stack. El costo es la cifra nocional de una ejecución con suscripción, no una factura.

## Resultado

Última ejecución válida de cada lente:

| Lente | Casos | Defectos encontrados | Variantes buenas marcadas |
| --- | --- | --- | --- |
| `code` | 1 | 1 | 0 |
| `security` | 2 | 2 | 0 |
| `spec` | 4 | 4 | 0 de 3 en la primera ejecución; la cuarta se marcó y pasó cuando su fixture tuvo un test (ver abajo) |
| `interface` | 3 | 3 | 0 |

Los casos: actualizar el estado tras un `await` sin comprobarlo (Flutter), una salida sin escapar (Laravel), una tabla sin política (Supabase), un escenario sin implementar, una tarea marcada sin código, una decisión del issue rota, un texto de documentación alterado y tres reglas de interfaz (nombre accesible, etiqueta de formulario, doble envío). El caso del secreto escrito en el código (`security/vue/hard-coded-secret`) fue el único de los 11 casos que **no se ejecutó** en las primeras ejecuciones; la segunda lo cubrió.

## Segunda ejecución, 2026-11-04: los 11 casos, con el tiempo de cada lente

`scripts/eval-lenses.mjs` ahora también mide el tiempo de reloj de cada llamada a una lente (incluye el arranque del proceso `claude -p`). Se volvieron a ejecutar los 11 casos, 22 ejecuciones, con la misma configuración de arriba (recibo simulado, el modelo de cada archivo de agente, sin quitar ninguna regla ni añadir ninguna skill):

| Lente | Casos | Defectos encontrados | Variantes buenas marcadas | Costo (USD) | Tiempo (s) | Tiempo por ejecución (s) |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | 1 | 1 | 0 | 0.11 | 20.6 | 10.3 |
| `interface` | 3 | 3 | 0 | 0.37 | 62.2 | 10.4 |
| `security` | 3 | 3 | 0 | 0.63 | 82.5 | 13.8 |
| `spec` | 4 | 4 | 0 | 1.01 | 130.1 | 16.3 |

El total fue de 2.11 USD y 295.4 s. Esta ejecución incluye `security/vue/hard-coded-secret`, que las primeras no cubrieron: encontró el defecto y no marcó la variante buena. Todas las lentes cumplieron el umbral en los 11 casos.

Las lentes corren una a una, así que una pasada de las cuatro sobre un cambio pequeño tarda más o menos la suma de una ejecución de cada una, unos 50 s aquí, frente a 10 a 16 s de una sola lente. Son cambios pequeños con defectos sembrados; un cambio real tardará más. No hay medición del agente de QA único que precedió a las lentes, así que la tabla no dice cuánto más lentas son las cuatro lentes que él.

## Cómo se llegó al resultado

Las primeras ejecuciones midieron la evaluación y no las lentes, y cada una se corrigió:

| Ejecución | Qué mostró | Costo |
| --- | --- | --- |
| `code`, `security`, archivos pegados en el prompt | La lente rechazó un cambio sin recibo antes de leer el código, así que el "encontrado" de esa ejecución no es fiable | 0.39 |
| `code`, otra vez | Lo mismo: las dos variantes rechazadas por falta de recibo | 0.07 |
| `code`, `security`, carpeta real y recibo simulado | Válida. `code` 1/1 y 0/1, `security` 2/2 y 0/2 | 0.44 |
| `spec`, `interface` | `interface` aprobó todo porque no recibió reglas. `spec` marcó una variante buena porque el fixture no tenía test | 1.09 |
| `interface`, `spec` (un caso) | `interface` encontró 3/3 y marcó 3/3: las variantes buenas solo arreglaban el defecto sembrado y la lente hizo bien en rechazarlas por otras reglas. `spec` aprobó la variante buena una vez que tuvo un test | 0.52 |
| `interface`, variantes buenas que cumplen las otras reglas | Válida. 3/3 y 0/3 | 0.33 |

El total es de unos 2.84 USD en uso de modelo. Tres de las seis ejecuciones son válidas para su lente.

## Lo que esto no demuestra

- Es una muestra pequeña de 11 casos; cada caso se ejecutó una vez en cada ejecución, así que se sabe poco de cuánto varía una lente entre ejecuciones.
- Los defectos son los más claros. La evaluación no dice cuánto se le escapa a una lente en un cambio real y ruidoso.
- Las lentes se ejecutaron solo con el modelo de su archivo de agente. No hay comparación entre modelos, así que **no se cambió ningún modelo ni esfuerzo por defecto** con esta evidencia. El mantenedor decidió el 2026-11-02 mantener los valores por defecto tal como están.
- El recibo es simulado y no se ejecutó ningún análisis ni test.
- La variante buena de `scenario-without-code` recibió un test después de la ejecución y no se volvió a ejecutar.
- El umbral, fijado por el mantenedor el 2026-11-02 para esta muestra: una lente debe encontrar **todos** los defectos sembrados de sus casos y no marcar **ninguna** variante buena (100 % y 0 falsos positivos). Se revisará cuando haya más casos. Las cuatro lentes lo cumplen en los 11 casos, a fecha de la ejecución del 2026-11-04.

## Volver a ejecutarla

`node scripts/eval-lenses.mjs --lens code,security --cases "state-update|unescaped" --max-budget-usd 0.25` imprime una estimación y pregunta antes de gastar uso de modelo. `--dry-run` usa un stub y no gasta nada. `--without-rule <texto>` quita las líneas de la lente que contienen el texto, y `--with-skill <archivo>` añade una skill, para ver cuánto vale una regla o una skill. El informe recoge lo que dijo una lente donde el resultado no fue el esperado.
