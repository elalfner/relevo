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

- Cada perfil se ejecutó en un proyecto creado para eso (`npm create vue@latest` con TypeScript, Vitest, ESLint y Prettier; `composer create-project laravel/laravel`). El `analyze` de Vue falla con un error de tipos, un `v-for` sin `:key`, una variable sin usar, un `any` explícito y un componente de una sola palabra, y no falla con `v-html`, un listener que nunca se quita o props copiadas fuera de la reactividad. El `analyze` y el `test` de Laravel fallan con un problema de estilo y con una prueba que falla, y no fallan con una asignación masiva sin protección, una consulta N+1 o una autorización que falta. El texto de cada perfil le dice a QA cuáles de esas debe buscar leyendo.
- Un proyecto que usa `pnpm` o `yarn`, `oxlint` o PHPStan reemplaza el comando en `relevo.yml`, por ejemplo `checks: { analyze: "vendor/bin/pint --test && vendor/bin/phpstan analyse" }`.
- Solo `supabase` exige skills. El perfil `flutter` le da dos skills recomendadas a `dev` y `qa`, y `laravel` y `vue` usan skills solo cuando están instaladas (ver abajo). Para darle al desarrollo o a QA una skill propia (una de buenas prácticas de Laravel, por ejemplo), lístala en `.relevo/stacks/<stack>.md` bajo `skills`.
- Un perfil puede tener una sección `Questions for the issue writer`. `/relevo:issue` hace las preguntas que la idea deja abiertas (en un backend: quién está autorizado y cómo es un error); el desarrollo y QA nunca la reciben.

### Usar el perfil `flutter` con las skills oficiales

El equipo de Flutter publica skills y un servidor MCP de Dart para agentes de código ([Get started with AI](https://docs.flutter.dev/ai/get-started), leído el 2026-10-28). El perfil le da dos de esas skills a `dev` y `qa`, `flutter-add-widget-test` y `dart-add-unit-test`, porque cubren cómo escribir las pruebas de una funcionalidad, algo que el texto del perfil no trae. Se recomiendan y nunca se exigen: el perfil funciona sin ellas, `/relevo:doctor` informa la que falta como una nota y `/relevo:init` ofrece la instalación como un comando opcional que confirmas.

| Herramienta | Cómo instalar | Dónde queda |
|---|---|---|
| Claude Code, y el runner en la nube | `npx skills add flutter/agent-plugins --skill flutter-add-widget-test --skill dart-add-unit-test --agent claude-code --copy --yes`, desde la carpeta de la plataforma (`cd app && ...` para `path: app`) | `.claude/skills/` y `skills-lock.json` en esa carpeta, la raíz para `path: .`: haz commit de ambos. |
| CLI de Antigravity | El mismo comando con `--agent universal` | `.agents/skills/` y `skills-lock.json` en esa carpeta: haz commit de ambos. El servidor MCP de Dart necesita una entrada en `.agents/mcp_config.json`: `{ "mcpServers": { "dart": { "command": "dart", "args": ["mcp-server"] } } }`. |
| IDE de Antigravity | Settings, Customizations, Build with Google Plugins, Download junto a "Dart and Flutter" | Dentro del IDE. `/relevo:doctor` no lo ve, así que nunca dice que estas skills faltan allí. |

- **El runner en la nube.** Lee solo lo que tiene commit en la rama base. Haz commit de la carpeta de skills y de `skills-lock.json`. Un plugin instalado en una máquina no llega al runner, y `/relevo:doctor` no lo cuenta como skills instaladas.
- **Qué reciben `dev` y `qa`.** Las skills del conjunto que tienen commit: Relevo le da a cada agente la ruta de su `SKILL.md`, buscando primero en la carpeta de la plataforma y luego en la raíz. Una skill del conjunto sin commit queda fuera de la ejecución, y `/relevo:doctor` informa una nota con su comando. Una ejecución en la nube con estas skills todavía no se probó.
- **Apagar una.** Lístala bajo `skills.disable` en `.relevo/stacks/flutter.md`, por ejemplo `skills: { disable: [flutter-add-widget-test] }`. Solo se puede apagar una skill de las listas del plugin, nunca una de `requires_skills`.
- **Están protegidas.** Una ejecución sin supervisión no puede cambiar las carpetas de skills ni `skills-lock.json`, dentro de la carpeta de cada plataforma igual que en la raíz.
- **Más skills.** `flutter/agent-plugins` trae 25 (también las de Dart). Instala otra con el mismo comando y lístala bajo `skills` en `.relevo/stacks/flutter.md` (ver [Skills extra por rol](#skills-extra-por-rol)); cada una que listes se lee en cada ejecución, y `/relevo:doctor` avisa cuando un rol pasa de 20 KB.
- **El plugin, para trabajar en tu máquina.** `claude plugin marketplace add flutter/agent-plugins`, luego `claude plugin install dart-flutter@dart-flutter`, instala todas y el servidor MCP de Dart en tu Claude Code. Es un extra opcional que se queda en tu máquina, y Relevo no lo cuenta.
- **Reglas.** Un plugin no carga reglas por sí mismo. Si quieres las oficiales, cópialas de la carpeta `rules` de `flutter/agent-plugins` al archivo de reglas de tu proyecto (`qa.rules_from`); `/relevo:init` lo lista como un paso tuyo y nunca escribe tu archivo de reglas.

### Usar el perfil `laravel` con Laravel Boost

Laravel publica su guía para agentes de código con [Laravel Boost](https://laravel.com/framework/docs/boost) (leído el 2026-10-29), una dependencia de desarrollo que instala skills para los paquetes que usa tu proyecto. El perfil usa dos de ellas, `laravel-best-practices` y `testing-best-practices`, solo cuando están instaladas y con commit; cuando no están, no se informa nada. Boost se recomienda y nunca se exige: `/relevo:doctor` informa una nota si falta y `/relevo:init` ofrece la instalación como comandos opcionales que confirmas uno por uno.

- **Instalar.** Desde la carpeta de la plataforma: `composer require laravel/boost --dev`, luego `php artisan boost:install --skills --no-interaction`. `--skills` instala las skills y deja quietos las guías (`CLAUDE.md`) y el servidor MCP, y `--no-interaction` instala para los agentes que encuentra en tu máquina sin preguntar. Boost elige las skills según `composer.json`: un proyecto Laravel 13 nuevo recibió `laravel-best-practices`, `testing-best-practices`, `tailwindcss-development`, `infer-conventions` y `deploying-to-cloud`.
- **Haz commit de lo que escribió.** `.claude/skills/`, `boost.json`, `composer.json` y `composer.lock`. Boost también puede escribir las carpetas de los otros agentes que encuentra (`.agents/`, `.kiro/`), de las que haces commit solo si las usas. La documentación de Laravel dice que los archivos generados pueden quedar fuera de git; para las skills eso las escondería del runner en la nube, que lee solo lo que tiene commit, y `/relevo:doctor` avisa cuando una carpeta de skills la ignora git.
- **Otras skills.** Las de Livewire, Inertia, Flux, Tailwind o Pest aplican solo si usas el paquete y pesan hasta 10 KB cada una, así que el perfil no las lista. Lista las que quieras bajo `skills` en `.relevo/stacks/laravel.md` (ver [Skills extra por rol](#skills-extra-por-rol)).
- **Apagar una.** `skills: { disable: [testing-best-practices] }` en `.relevo/stacks/laravel.md`.

### Usar el perfil `vue` con skills de la comunidad

Vue no publica skills para agentes de código. El conjunto más cercano es [vuejs-ai/skills](https://github.com/vuejs-ai/skills), un proyecto de la comunidad (MIT) que se declara un experimento temprano cuyas skills "pueden ser incompletas por alucinaciones". No es oficial. `/relevo:init` ofrece dos de sus skills, `vue-best-practices` y `vue-testing-best-practices`, como instalación opcional, y el perfil se las da a `dev` y `qa` solo cuando están instaladas. `/relevo:doctor` no dice nada cuando faltan.

- **Instalar.** `cd <carpeta de la plataforma> && npx skills add vuejs-ai/skills --skill vue-best-practices --skill vue-testing-best-practices --agent claude-code --copy --yes`. Escribe `.claude/skills/` y `skills-lock.json` en esa carpeta: haz commit de ambos. Los archivos son Markdown sin ningún script (comprobado el 2026-10-29).
- **Lo que cuestan.** `vue-testing-best-practices` es un índice de 2 KB cuyas referencias se leen según el síntoma. `vue-best-practices` pesa 10 KB y le dice al agente que lea cuatro archivos de referencia (34 KB) en cada tarea de Vue, así que suma unos 44 KB de lectura a cada ejecución de `dev` y de `qa`. Apágala si es demasiado.
- **Apagar una.** `skills: { disable: [vue-best-practices] }` en `.relevo/stacks/vue.md`.
- **El checklist está en el perfil, no en una skill.** El texto del perfil trae los puntos de seguridad, rendimiento y pruebas de la documentación de Vue que se pueden leer en un diff: una plantilla armada con texto del usuario, `innerHTML`, una prop compartida que cambia para todos los ítems de una lista, un snapshot como única aserción, y otros.

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
| 3 | `.relevo/stacks/<stack>.md` | Más higiene, herramientas o skills para un stack. Se suma al perfil del plugin y nunca lo reemplaza. Un stack que el plugin no trae se define solo con este archivo ([cómo](#tu-propio-stack)). |

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

## Tu propio stack

Relevo trae perfiles para `flutter`, `vue`, `laravel` y `supabase`. Para cualquier otro stack (Go, Python, Rust...) escribes tú el perfil, y el archivo es el perfil completo:

1. Pon `stack: go` (o el nombre que quieras) en la plataforma de `relevo.yml`. `/relevo:init` propone entonces `.relevo/stacks/go.md` por su cuenta, con los comandos comentados; también puedes crearlo a mano.
2. Escribe los comandos que ejecuta QA, desde la carpeta de la plataforma. `analyze` y `test` no deben reescribir tu código; solo `format` puede:

   ```markdown
   ---
   stack: go
   commands:
     analyze: go vet ./...
     test: go test ./...
     format: gofmt -w .
   generated: ['**/*.pb.go']
   tools: [go]
   ---

   # Go

   ## Hygiene for the developer

   - Return errors; do not discard them with `_`. Wrap them with `%w`.
   - Close what you open (`defer`), and pass a `context.Context` to what can block.

   ## What the auditor looks for in the diff

   - An ignored error, a goroutine with no way to stop, a shared map written without a lock.
   ```

   Es un ejemplo: ajusta los comandos a tu proyecto. Un comando se reemplaza después, sin tocar el archivo, con `platforms.<nombre>.checks` en `relevo.yml` (`analyze`, `test` y `format` se aceptan siempre ahí).
3. Hazle commit al archivo. La ejecución en la nube y tus compañeros lo leen de git; sin él no tienen perfil para el stack.
4. Si la nube construye, agrega un paso para la toolchain al job de build de `.github/workflows/relevo-go.yml`, protegido por el nombre del stack, para que un issue de otra plataforma no lo instale:

   ```yaml
   - if: needs.decide.outputs.stack == 'go'
     uses: actions/setup-go@v5
     with:
       go-version-file: ${{ needs.decide.outputs.path }}/go.mod
   ```

   Instala las dependencias como prefiera tu proyecto, desde `needs.decide.outputs.path`.

`/relevo:doctor` avisa cuando el perfil de un stack así no tiene `analyze` o no tiene `test`, y cuando el workflow de go no tiene un paso protegido por el nombre del stack (no avisa para un stack cuyas herramientas son solo `node` y `npm`, porque el job ya instala Node). También avisa mientras el archivo no está en git.

## Skills extra por rol

- Un perfil puede listar skills para los roles `dev`, `qa`, `issue` y `review`. `fix` usa las de `dev` y `qa`.
- El agente lee el `SKILL.md` de cada una y solo las partes que aplican. Las reglas de Relevo y de tu proyecto mandan sobre cualquier skill.
- Una skill se usa solo si está en la rama base, si la persona no la reservó para sí con `disable-model-invocation` y si no tiene scripts. Una skill con scripts debe nombrarse una por una en `skills.allow_scripts`.
- `/relevo:doctor` lista las skills que se dejaron fuera y por qué, avisa cuando las skills de un rol pesan más de 20 KB y avisa cuando una skill ya no coincide con `skills-lock.json`.
- Una skill que un perfil lista en `requires_skills` es exigida: `/relevo:doctor` falla cuando no está instalada. Una skill en `skills` se le da a ese rol. Un stack puede usar las dos para la misma skill: `supabase` exige `supabase` y `supabase-postgres-best-practices` y se las da a `dev`, `qa` e `issue`. Una skill recomendada es la que el perfil del plugin le da a un rol sin exigirla (las dos de `flutter`): si falta, `/relevo:doctor` informa una nota y la ejecución sigue sin ella.
- Para apagar una skill del plugin, nómbrala en `skills.disable` de `.relevo/stacks/<stack>.md`; una exigida no se puede apagar.
- Un perfil también puede listar skills bajo `skills_when_installed`: se le dan al rol cuando su carpeta está en la rama base, y no se informa nada cuando no está. `laravel` y `vue` lo usan, porque las skills que usan dependen de lo que el proyecto instaló.

## Lo que una ejecución sin supervisión no puede cambiar

- `relevo.yml`, todo lo que está en `.relevo/`, las carpetas de skills y `skills-lock.json` (también dentro de la carpeta de cada plataforma), porque deciden las verificaciones a las que se somete el trabajo. Una ejecución que los toca termina en `qa-failed`.
- Los archivos que listas en `qa.rules_from`.
- Los archivos fuera de la carpeta de la plataforma del issue (salvo la spec del propio cambio, `GLOSSARY.md` y `docs/adr/`), a menos que el issue los liste en `Allow-paths:`.
- El comando de una verificación, desde un perfil: solo `relevo.yml` puede reemplazarlo.
