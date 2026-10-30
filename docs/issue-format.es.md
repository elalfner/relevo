# Cómo escribir un issue que Relevo pueda construir

[English](issue-format.md) · Español

Relevo construye un issue sin hacerle preguntas a nadie, así que el issue ya debe decir qué significa "terminado". `/relevo:go` comprueba tres cosas antes de empezar, y devuelve el issue a quien lo escribió si una falla.

## Qué debe contener el issue

### 1. Escenarios, como pares WHEN / THEN

Cada escenario es una línea `WHEN` (la situación) y una línea `THEN` (el resultado observable). `GIVEN` también sirve para la situación. Las negritas y las viñetas son opcionales.

```markdown
## Scenarios

- **WHEN** la persona abre el resumen y hay 3 clientes que cumplen años hoy
- **THEN** la lista muestra los 3 nombres, cada uno con un botón de enviar

- **WHEN** nadie cumple años hoy
- **THEN** la pantalla dice "Nadie cumple años hoy"
```

Un `WHEN` sin `THEN` no cuenta.

### 2. Casos borde, como lista bajo un encabezado "Edge cases"

```markdown
## Edge cases

- un cliente sin número de teléfono: el botón de enviar está desactivado y dice "sin teléfono"
- 29 de febrero en un año que no es bisiesto: se muestra el 28 de febrero
- sin red: se sigue mostrando la última lista guardada
```

El encabezado puede escribirse `Edge cases`, `Edge case`, o `Casos borde` / `Casos límite`. Solo se cuentan los elementos de la lista que están directamente bajo ese encabezado.

### 3. Dependencias (opcional)

```markdown
Depends-on: #12, #13
```

Un issue de otro repositorio se escribe `owner/repo#12`, y el repositorio debe estar en `links` de `relevo.yml` (un repositorio fuera de la lista devuelve el issue a quien escribe la spec). Un repositorio privado se lee con el secreto de solo lectura `RELEVO_LINKS_TOKEN`; uno público no necesita ninguno. El issue espera hasta que el otro se cierre como completado, y lo nota en el horario de la cola, porque los eventos no cruzan repositorios.

```markdown
Depends-on: #3, acme/api#12
```

El issue no empieza hasta que cada issue listado esté cerrado como completado (su pull request fusionado). Hasta entonces tiene la etiqueta de bloqueado y empieza solo después.

### 4. Documentación (opcional)

Cuando quien escribe la spec acordó términos o decisiones que deben quedar registrados, el issue los lleva en una sección `## Documentation`, con el texto exacto. `go` hace que el desarrollo escriba ese texto y los archivos llegan en el mismo pull request que la funcionalidad, así nadie tiene que subir la documentación a mano.

```markdown
## Documentation

- Add these entries to `GLOSSARY.md`, under its existing heading, after the existing ones, exactly as written. They are vocabulary only; nothing else in that file changes.

**Build number**:
The number after the `+` in the `version` of `pubspec.yaml`, shown in the app bar subtitle as "Build N".
_Avoid_: Build label, build, build version
```

Una entrada de glosario es un nombre, una definición de una o dos frases y las palabras que se deben evitar. Un registro de decisión es un título y un texto, sin número: se numera cuando se escribe (el número más alto de `docs/adr/` más uno). La sección nombra solo `GLOSSARY.md` y `docs/adr/`. No es un escenario ni un caso borde, y un issue es válido con ella o sin ella.

### 5. Archivos de dependencias que el cambio puede tocar (opcional)

Una ejecución sin supervisión nunca cambia los workflows (`.github/`), `relevo.yml`, `.relevo/`, las carpetas de skills ni el archivo de reglas del proyecto, y no cambia los manifiestos de dependencias ni los archivos de bloqueo (`pubspec.yaml`, `pubspec.lock`, `package.json`, `composer.json` y sus archivos de bloqueo) salvo que el issue lo diga. Cuando el cambio necesita una dependencia nueva, lista los archivos que puede tocar:

```markdown
Allow-paths: pubspec.yaml, pubspec.lock
```

Cada entrada es una ruta o un patrón (`*` se queda dentro de una carpeta, `**` cruza carpetas; un nombre sin barra coincide a cualquier profundidad). El primer grupo nunca puede permitirse: listar `.github/workflows/ci.yml` o `**` hace que el issue falle su comprobación. Sin la línea, una ejecución que toca un archivo de dependencias termina en `qa-failed` con el motivo "protected path in the diff".

### 6. Plataforma (cuando el repositorio tiene varias)

Cuando `relevo.yml` declara más de una plataforma (un front y un back en un repositorio, por ejemplo), el issue dice para cuál es:

```markdown
Platform: web
```

El nombre es una de las claves de `platforms` en `relevo.yml`. Con una sola plataforma la línea es opcional. Un issue pertenece a una plataforma; una funcionalidad que necesita dos son dos issues, el front dependiendo del back con `Depends-on:`. Sin la línea, o con un nombre que no existe, el issue vuelve a quien escribe la spec con la lista de plataformas. Una ejecución sin supervisión cambia solo archivos dentro de la carpeta de la plataforma (más la especificación del propio cambio, `GLOSSARY.md` y `docs/adr/`); para dejarle tocar una carpeta compartida, lístala en `Allow-paths:`.

### 7. Lo que dejó decidido el acuerdo (secciones opcionales)

Estas secciones llevan lo que `/relevo:think` decidió además de los escenarios. `go` las copia palabra por palabra al `design.md` del cambio bajo "From the issue: <Section>", y QA rechaza una construcción que rompa una decisión o una restricción, citando su id. Los encabezados van siempre en inglés; los contenidos, en el idioma del repositorio.

```markdown
## Outcome
La lista muestra los cumpleaños de hoy y nada más.

## Decisions

### D1. Ordenar por nombre
Decided: la lista se ordena por nombre.
Why: la gente busca a una persona, no una fecha.
Discarded: ordenar por fecha (nadie lo pidió).

## Constraints

- C1: la lista carga en menos de un segundo con 500 clientes.

## Code pointers

- `lib/clients/repository.dart`: donde se leen los clientes.

## Verification

- En un dispositivo con la cuenta de prueba "demo", la lista se desplaza sin saltos.

## Assumptions

- Los cumpleaños se leen de la tabla de clientes.

## Open questions
```

- Una decisión es `### D<número>. <título>`, una restricción es `- C<número>: <límite>`. Los ids no se repiten.
- Un code pointer a un archivo de otro repositorio se escribe `owner/repo:path` entre comillas invertidas, y el repositorio debe estar en `links` de `relevo.yml`. `go` lo obtiene para quien construye, que lo lee como una pista que comprobar, igual que cualquier pointer. Cuenta para las cinco referencias de la sección siguiente. Escribe el proceso que sigue en `Decisions` y `Constraints`; el pointer solo nombra los archivos que quien construye debe ver.
- **`Open questions` bloquea la construcción.** Un issue que tiene una pregunta ahí, o el texto `NEEDS CLARIFICATION` en cualquier parte, falla la comprobación y vuelve a quien lo escribió como ambiguo. Responde la pregunta y borra la sección.
- `Related: #14, #15` lista issues de la misma idea. Solo informa; lo que bloquea es `Depends-on:`.
- Un cuerpo de más de unos 8.000 caracteres pasa con un aviso: los issues más cortos y bien delimitados se construyen mejor.

### 8. Referencia de diseño (opcional)

Cuando la pantalla debe verse como algo, señálalo. Una viñeta por referencia, como máximo cinco junto con los code pointers de otros repositorios, y cada una dice después de los dos puntos qué debe coincidir (estructura, espaciado, tipografía, color, estados):

```markdown
## Design reference

- `design/home.png`: estructura, espaciado y color de la lista
- https://github.com/user-attachments/assets/0a1b2c3d-1111-2222-3333-444455556666: el estado vacío
- `acme/design:components/Card.vue`: la tarjeta que se reutiliza; conserva sus estados
```

- Un archivo de este repositorio se escribe entre comillas invertidas y debe existir; siempre está disponible para quien construye.
- Un archivo de otro repositorio se escribe `owner/repo:path`, y el repositorio debe estar en `links` de `relevo.yml`. Puede ser texto de hasta 200 KB o una imagen PNG, JPEG, GIF o WebP de hasta 5 MB, y no depende de `design.images`: alguien lo subió a propósito. Un repositorio privado se lee en la nube con el secreto `RELEVO_LINKS_TOKEN`, que necesita acceso de lectura a su contenido.
- Una imagen se pega en el issue desde su página web (GitHub no tiene forma de adjuntar una desde una herramienta) y GitHub escribe el enlace. Se descarga y se muestra al modelo solo cuando `design.images` es `true` en `relevo.yml`, porque una captura puede mostrar datos de clientes. Si no, sube la imagen al repositorio y señala el archivo.
- El código de ejemplo va en un bloque de código en la misma sección.
- `go` copia la sección al diseño, añade un escenario "Matches the reference <nombre>" por cada viñeta, y QA comprueba el código contra ella. En la revisión ese escenario es una línea que confirmas mirando tu pantalla. Si una referencia no se puede obtener, el issue vuelve a quien lo escribió diciendo cuál.

## Qué más necesita `go` del issue

- **Un hito.** El hito es el lote al que pertenece el issue.
- **Una persona asignada.** Esa persona recibe el trabajo construido y lo revisa en un dispositivo.
- **La etiqueta ready**, aplicada por alguien con permiso de escritura en el repositorio, cuando la spec está terminada.

Si falta alguno de estos, no se construye nada y un comentario dice cuál.

## Lo que `go` nunca hace

Nunca inventa escenarios ni casos borde. Si faltan, el issue vuelve a quien escribe la spec con la lista de lo que falta.

Todo lo que en el issue sea ambiguo de un modo que cambie el comportamiento visible se trata como un defecto de la spec, no se adivina. Las ambigüedades pequeñas se resuelven con una suposición razonable que queda escrita en el `design.md` del cambio.
