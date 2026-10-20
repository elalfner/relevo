# Stacks y plataformas

[English](stacks.md) · Español

Relevo construye más de un tipo de proyecto. Lo que cambia de uno a otro (los comandos que revisan el código, los errores típicos, las herramientas) vive en un **perfil de stack**, no en los agentes. Esta página explica cómo declarar tus plataformas, qué contiene un perfil y cómo agregar tus propias reglas.

## Declara las plataformas

Cada plataforma tiene un nombre, un stack, la carpeta donde vive y, en los stacks que los tienen, destinos. `relevo.yml` los guarda:

```yaml
platforms:
  app:
    stack: flutter
    path: .
    targets: [android, ios, web]
```

- Un repositorio con una plataforma usa `path: .`. Un monorepo tiene una entrada por plataforma, cada una con su carpeta.
- La línea anterior `platform: flutter-android` sigue funcionando y significa una plataforma Flutter con el destino Android. No pongas las dos.
- Con varias plataformas, cada issue dice para cuál es con una línea `Platform: web` (el nombre es una clave de `platforms`). Con una sola plataforma la línea es opcional. Un issue sin ella, o con un nombre que no existe, regresa a quien escribe la spec. Una funcionalidad que necesita dos plataformas son dos issues, el del front dependiendo del de back con `Depends-on:`.
- `/relevo:init` pregunta todo esto y lo escribe.

## Qué contiene un perfil de stack

Un perfil es el archivo `stacks/<stack>.md` del plugin. Su encabezado lo leen los scripts y su texto lo leen los agentes.

- Los comandos que verifican el código: `analyze`, `test` y `format`.
- Los archivos generados que se dejan fuera del diff que revisa QA.
- Las herramientas que necesita el stack y la que necesita cada destino (en Flutter: `adb` para Android, `xcrun` para iOS, que solo corre en macOS, y nada para la web).
- Las skills que requiere y las skills extra de cada rol.
- Un texto con la higiene que sigue el desarrollador y lo que QA busca en el diff.

Relevo trae el perfil `flutter`. `/relevo:go` resuelve el perfil de tu plataforma y se lo entrega a los agentes de desarrollo y de QA.

## Agrega tus propias reglas

| Capa | Dónde | Para qué sirve |
|---|---|---|
| 1 | `CLAUDE.md`, o varios archivos en `qa.rules_from` | Las convenciones de tu proyecto. Es la más común. |
| 2 | `platforms.<nombre>.checks` en `relevo.yml` | Otro comando para una verificación, por ejemplo `fvm flutter test`. |
| 3 | `.relevo/stacks/<stack>.md` | Más higiene, herramientas o skills para un stack. Se suma al perfil del plugin y nunca lo reemplaza. Un stack que el plugin no trae se define solo con este archivo. |

`/relevo:init` puede crear un archivo comentado para la tercera capa. `/relevo:doctor` muestra qué capas usa cada plataforma.

## Skills extra por rol

- Un perfil puede listar skills para los roles `dev`, `qa`, `issue` y `review`. `fix` usa las de `dev` y `qa`.
- El agente lee el `SKILL.md` de cada una y solo las partes que aplican. Las reglas de Relevo y de tu proyecto mandan sobre cualquier skill.
- Una skill se usa solo si está en la rama base, si la persona no la reservó para sí con `disable-model-invocation` y si no tiene scripts. Una skill con scripts debe nombrarse una por una en `skills.allow_scripts`.
- `/relevo:doctor` lista las skills que se dejaron fuera y por qué, avisa cuando las skills de un rol pesan más de 20 KB y avisa cuando una skill ya no coincide con `skills-lock.json`.

## Lo que una ejecución sin supervisión no puede cambiar

- `relevo.yml`, todo lo que está en `.relevo/`, las carpetas de skills y `skills-lock.json`, porque deciden las verificaciones a las que se somete el trabajo. Una ejecución que los toca termina en `qa-failed`.
- Los archivos que listas en `qa.rules_from`.
- Los archivos fuera de la carpeta de la plataforma del issue (salvo la spec del propio cambio, `GLOSSARY.md` y `docs/adr/`), a menos que el issue los liste en `Allow-paths:`.
- El comando de una verificación, desde un perfil: solo `relevo.yml` puede reemplazarlo.
