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

Relevo trae los perfiles `flutter`, `vue`, `laravel` y `supabase`. `/relevo:go` resuelve el perfil de tu plataforma y se lo entrega a los agentes de desarrollo y de QA.

## Los perfiles que trae Relevo

| Stack | `analyze` | `test` | `format` | Destino |
|---|---|---|---|---|
| `flutter` | `flutter analyze --no-pub` | `flutter test --reporter=compact --no-pub` | `dart format` | `android`, `ios`, `web` |
| `vue` | `vue-tsc --build` y luego `eslint . --cache` | `vitest run` | `prettier --write src/` | `web` |
| `laravel` | `vendor/bin/pint --test` | `php artisan test` | `vendor/bin/pint` | ninguno |
| `supabase` | `supabase db lint` | `supabase test db` | `npx prettier --write supabase/` | ninguno |

- Los comandos que ejecuta QA nunca reescriben tu código. Importa en Vue: el script `lint` que genera `npm create vue` usa `--fix`, así que el perfil llama a las herramientas directamente (con `npx --no-install`, con las versiones que fija tu proyecto) y no usa `npm run lint`.
- El perfil `flutter` sigue la documentación oficial de Flutter (arquitectura, datos y backend, testing, performance y el servidor MCP de Dart), leída el 2026-10-22. El desarrollo evita, y QA busca en el diff, los errores comunes de layout, el trabajo caro en `build()`, las listas largas sin builder, `Opacity` y los recortes dentro de animaciones, el parseo pesado en el isolate de la UI y `dart:html` (impide compilar a Wasm). Con el servidor MCP de Dart los agentes usan solo las herramientas que no escriben nada (`analyze_files`, `lsp`, `read_package_uris`, y `run_tests` cuando está activo). El perfil no impone una arquitectura: los agentes siguen la que declaren tus reglas, y solo si no declaras ninguna el código nuevo usa las capas de la guía de arquitectura de Flutter. QA solo reporta un hallazgo de arquitectura contra una regla que escribiste. Si tu proyecto exige objetos Command y Result, un paquete de manejo de estado o una estructura de carpetas, escríbelo en tus reglas (`qa.rules_from`).
- El perfil `supabase` implementa *Database-as-Code* para proyectos monorepo (por ejemplo `app` en Flutter y `backend` en Supabase):
  - Todas las pruebas corren de forma hermética contra contenedores temporales en Docker local (`supabase test db` con pgTAP); los agentes de Relevo nunca tocan instancias en la nube.
  - El perfil asigna las skills oficiales de `supabase/agent-skills` (`supabase` y `supabase-postgres-best-practices`) a los roles `dev`, `qa` e `issue`.
  - `dev` mantiene datos de prueba en `supabase/seed.sql` de forma idempotente (`INSERT ... ON CONFLICT DO NOTHING`).
  - Para desplegar a la nube tras mergear un PR, usa la plantilla `.github/workflows/deploy-supabase.yml` (despliegue automático a Staging en `dev` y a Producción con aprobación humana en `main`).

- Los comandos que ejecuta QA nunca reescriben tu código. Importa en Vue: el script `lint` que genera `npm create vue` usa `--fix`, así que el perfil llama a las herramientas directamente (con `npx --no-install`, con las versiones que fija tu proyecto) y no usa `npm run lint`.
- Cada perfil se ejecutó en un proyecto creado para eso (`npm create vue@latest` con TypeScript, Vitest, ESLint y Prettier; `composer create-project laravel/laravel`). El `analyze` de Vue falla con un error de tipos, un `v-for` sin `:key`, una variable sin usar, un `any` explícito y un componente de una sola palabra, y no falla con `v-html`, un listener que nunca se quita o props copiadas fuera de la reactividad. El `analyze` y el `test` de Laravel fallan con un problema de estilo y con una prueba que falla, y no fallan con una asignación masiva sin protección, una consulta N+1 o una autorización que falta. El texto de cada perfil le dice a QA cuáles de esas debe buscar leyendo.
- Un proyecto que usa `pnpm` o `yarn`, `oxlint` o PHPStan reemplaza el comando en `relevo.yml`, por ejemplo `checks: { analyze: "vendor/bin/pint --test && vendor/bin/phpstan analyse" }`.
- Los perfiles no exigen ninguna skill extra; las oficiales de Dart y Flutter son una recomendación (ver abajo). Para darle al desarrollo o a QA una skill propia (una de buenas prácticas de Laravel, por ejemplo), lístala en `.relevo/stacks/<stack>.md` bajo `skills`.
- Un perfil puede tener una sección `Questions for the issue writer`. `/relevo:issue` hace las preguntas que la idea deja abiertas (en un backend: quién está autorizado y cómo es un error); el desarrollo y QA nunca la reciben.

### Usar el perfil `flutter` con las skills oficiales

El equipo de Flutter publica skills y un servidor MCP de Dart para agentes de código ([Get started with AI](https://docs.flutter.dev/ai/get-started), leído el 2026-10-28). Se recomiendan y nunca se exigen: el perfil funciona sin ellas, `/relevo:doctor` informa su ausencia como una nota y `/relevo:init` ofrece cada instalación como un comando opcional que confirmas uno por uno.

| Herramienta | Cómo instalar | Dónde queda |
|---|---|---|
| Claude Code | `claude plugin marketplace add flutter/agent-plugins`, luego `claude plugin install dart-flutter@dart-flutter` | En tu Claude Code, no en el repositorio. El plugin trae también el servidor MCP de Dart. |
| CLI de Antigravity | `npx skills add flutter/agent-plugins --skill '*' --agent universal --yes` | `.agents/skills/` y `skills-lock.json` en el repositorio: haz commit de ambos. El servidor MCP de Dart necesita una entrada en `.agents/mcp_config.json`: `{ "mcpServers": { "dart": { "command": "dart", "args": ["mcp-server"] } } }`. |
| IDE de Antigravity | Settings, Customizations, Build with Google Plugins, Download junto a "Dart and Flutter" | Dentro del IDE. `/relevo:doctor` no lo ve, así que nunca dice que estas skills faltan allí. |

- Ese comando `npx` instala juntas las skills de Flutter y las de Dart. La documentación de Flutter da además un comando para `dart-lang/skills`, cuyas skills el primero ya trae.
- **El runner en la nube.** Un plugin instalado en una máquina no llega al runner que construye en la nube. Una carpeta de skills con commit en el repositorio, sí.
- **Reglas.** Un plugin no carga reglas por sí mismo. Si quieres las oficiales, cópialas de la carpeta `rules` de `flutter/agent-plugins` al archivo de reglas de tu proyecto (`qa.rules_from`); `/relevo:init` lo lista como un paso tuyo y nunca escribe tu archivo de reglas.
- **Relevo no les pasa estas skills a los agentes `dev` y `qa`.** Claude Code y Antigravity encuentran las skills por su nombre y descripción. En una sesión de Claude Code con el plugin instalado, el agente `dev` listó las 25 skills del plugin (`dart-flutter:flutter-*` y `dart-flutter:dart-*`) y los nombres de las herramientas del servidor MCP de Dart; no se probó el agente `qa`, que un agente invoque una skill, ni una ejecución en la nube. Para que uno de ellos lea una skill de `.agents/skills/`, lístala bajo `skills` en `.relevo/stacks/flutter.md` (ver [Skills extra por rol](#skills-extra-por-rol)); una skill con scripts queda fuera salvo que `skills.allow_scripts` la nombre.

### Usar el perfil `supabase` en un repositorio

- **Estructura.** Los comandos del perfil corren desde la carpeta de la plataforma, y la CLI de Supabase busca `supabase/config.toml` dentro de ella. Una plataforma `backend` con `path: backend` contiene entonces `backend/supabase/` (`config.toml`, `migrations/`, `tests/`, `seed.sql` y `functions/` si usas funciones edge). Deja la app en su propia carpeta (por ejemplo `app/`, una plataforma Flutter con `path: app`): una plataforma cuya carpeta es `.` no tiene restricciones, así que un issue para ella podría cambiar la carpeta de la base de datos, mientras que con dos carpetas Relevo rechaza un cambio fuera de la plataforma del issue.
- **Una sola línea de migraciones.** La CLI aplica `supabase/migrations/` en un único orden. Agrupa por módulo con el nombre del archivo (`<timestamp>_<modulo>_<cambio>.sql`) y por carpeta en `tests/` y en los archivos de semilla (`[db.seed] sql_paths` en `config.toml`), no con un conjunto de migraciones por módulo.
- **Desde un proyecto remoto existente.** Ejecuta `supabase init` en la raíz de la plataforma, `supabase login`, `supabase link --project-ref <id>` y `supabase db pull`. El pull escribe `supabase/migrations/<timestamp>_remote_schema.sql` como migración base y la registra como aplicada en el proyecto enlazado. Lee ese archivo antes de commitearlo: puede traer sentencias inesperadas, como quitar una extensión que el stack local activa por defecto. Escribe `supabase/seed.sql` a mano en vez de volcar datos de producción.
- **Un segundo proyecto (staging y producción).** El pull marca la migración base como aplicada solo en el proyecto que enlazaste. Antes de que `supabase db push` corra contra el otro proyecto, aplica allí la base o márcala como aplicada, o el push intentará crear lo que ya existe. `templates/deploy-supabase.yml` publica en staging desde la rama base y en producción desde la rama de release, y no hace nada hasta que cambia `supabase/migrations/`.
- **El build en la nube.** La plantilla de `relevo-go.yml` instala la CLI de Supabase para una plataforma Supabase, y el runner de GitHub ya trae Docker. `/relevo:doctor` falla si el workflow no tiene un paso de Supabase activo. Copia `relevo-go.yml` otra vez si tu workflow es anterior.

Esta sección sigue la documentación de Supabase (guías de flujo de desarrollo local y de la CLI) leída el 2026-10-27. Describe la CLI de Supabase, no el comportamiento de Relevo; revisa las guías si un comando difiere en tu versión.

## Agrega tus propias reglas

| Capa | Dónde | Para qué sirve |
|---|---|---|
| 1 | `CLAUDE.md`, o varios archivos en `qa.rules_from` | Las convenciones de tu proyecto. Es la más común. |
| 2 | `platforms.<nombre>.checks` en `relevo.yml` | Otro comando para una verificación, por ejemplo `fvm flutter test`. |
| 3 | `.relevo/stacks/<stack>.md` | Más higiene, herramientas o skills para un stack. Se suma al perfil del plugin y nunca lo reemplaza. Un stack que el plugin no trae se define solo con este archivo. |

`/relevo:init` puede crear un archivo comentado para la tercera capa y lo deja para que le hagas commit. Hazle commit: la ejecución en la nube y tus compañeros lo leen de git, así que un archivo que se queda solo en tu máquina solo aplica ahí. `/relevo:doctor` muestra qué capas usa cada plataforma, y avisa mientras git no rastree ese archivo.

## Ajusta cómo se revisa un stack

El encabezado de `.relevo/stacks/<stack>.md` puede llevar un bloque `review`, y su cuerpo una sección `## Review`. El perfil `laravel` del plugin pone los valores por defecto, así que un repositorio Laravel no necesita ninguno de los dos.

```yaml
review:
  log: storage/logs/*.log        # los archivos que lee la auditoría (una ruta o un glob); el valor por defecto de laravel
  test: php artisan test         # el comando base; el agente le añade --filter para probar una línea
  serve:                         # opcional; sin él el agente no arranca ningún servidor
    command: php artisan serve --port={port}
    url: http://localhost:{port}
    env:
      APP_ENV: testing
```

- Una clave que escribes reemplaza el valor por defecto del plugin para esa clave (`/relevo:doctor` lista las que reemplazaste). Es el único lugar donde un repositorio puede reemplazar un valor de un perfil, porque el bloque dice cómo se conduce el review y no es una verificación del código: `analyze`, `test` y `format` se siguen reemplazando solo con `checks`.
- `serve` se arranca solo con `review.autopilot` en `precheck` o `verify`, después de que confirmaste que los datos no son de producción, en un puerto libre de `localhost`, con el script que lo registra y lo detiene. Su `url` debe estar en `localhost`, `127.0.0.1` o `[::1]`, y el comando se lee solo de este archivo en la rama base, nunca de un issue ni de un comentario.
- La sección `## Review` es texto libre para el agente, que solo lo lee en un review. Puede añadir pasos y pedir más evidencia. No puede cambiar que tú confirmas cada línea, que se audita el log, que `decide` controla el pull request, que nunca se leen los archivos de entorno, que no se sugiere un waiver ni que no se parchea código en un review: `/relevo:doctor` avisa de una línea que pida alguna de esas cosas, y el review la ignora.
- Un review de Laravel no tiene dispositivo ni navegador. Con `review.autopilot` en `off` corres los tests del proyecto y se lo dices al review (`ran <código de salida>`); con `precheck` o `verify` el agente corre el test que ya existe para cada línea y nunca escribe uno. Una corrida de tests que pasa no escribe nada en `storage/logs`, así que lo que muestra que el código se ejercitó es la corrida registrada, no el log.

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
