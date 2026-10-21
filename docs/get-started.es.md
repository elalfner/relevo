# Primeros pasos

[English](get-started.md) · Español

Esta página te lleva de cero a tu primer pull request fusionado, trabajando solo en un repositorio. Cuenta con unos veinte minutos de tu tiempo, más la construcción, que tarda unos minutos y varía. Para un equipo, lee después la [Guía](guide.es.md) y la [Configuración](configuration.es.md).

## Antes de empezar

- **Claude Code**, instalado y con la sesión iniciada.
- **Un repositorio de GitHub** que administres, con un proyecto en Flutter, Vue o Laravel.
- **La CLI de GitHub** con la sesión iniciada (`gh auth status`), y `git`.
- **Node.js 20.19 o más reciente**, que necesita la herramienta OpenSpec.
- **Una credencial del modelo** para las construcciones en la nube: una clave de API de la consola de Anthropic, o una suscripción de Claude.
- **Para una app Flutter en Android**, un teléfono o un emulador donde probar.

## 1. Instala el plugin

Relevo es un plugin de Claude Code. En una terminal:

```bash
claude plugin marketplace add elalfner/relevo --sparse .claude-plugin
claude plugin install relevo@relevo
```

Eso lo instala para todos los proyectos de la máquina. Para instalarlo solo en un repositorio, añade `--scope project` al segundo comando (compartido con el equipo en `.claude/settings.json`) o `--scope local` (solo para ti). Solo se instala el plugin (scripts, skills, agents, perfiles de stack y plantillas); la documentación está en línea.

Un atajo, si prefieres un solo comando: `npm install -g @elalfner/relevo` te da `relevo install` (o `relevo install --scope project`), `relevo update` y `relevo doctor`.

```bash
npm install -g @elalfner/relevo
relevo install
```

- **Deberías ver**: los dos comandos terminan sin error y `claude plugin list` muestra `relevo@relevo`. Después de reiniciar Claude Code en tu proyecto, al escribir `/relevo:` aparecen los nueve comandos.
- **Si no**: reinicia Claude Code en la carpeta del proyecto; si el plugin no se instala, actualiza Claude Code e inténtalo de nuevo. Más en [Instalación](install.es.md).

## 2. Comprueba tu entorno

En Claude Code, en tu proyecto:

```text
/relevo:doctor
```

- **Deberías ver**: una lista. Una línea que empieza con `[pass]` es algo que funciona; una que empieza con `[FAIL]` va seguida de `fix:` y el comando que lo resuelve; una línea `[warn]` conviene leerla pero no te detiene. Un repositorio nuevo tiene varios fallos, y es normal.
- **Si no**: ejecuta el arreglo que da cada línea y vuelve a ejecutar `/relevo:doctor`. El paso 3 también ofrece instalar lo que falte.

## 3. Prepara el repositorio

```text
/relevo:init
```

Pregunta quién trabaja en el repositorio (tú), el modo de revisión (`none`, para trabajar solo), el idioma, la plataforma (su stack, su carpeta y sus destinos), dónde construye `go` (en la nube, por defecto) y el límite de costo por ejecución. Después muestra el plan completo y no cambia nada hasta que estés de acuerdo.

- **Deberías ver**: un plan con una línea por cambio. Una línea que empieza con `[will do]` es algo que `init` hace por sí mismo (crear `relevo.yml`, las etiquetas, las reglas, los workflows); una que empieza con `[by hand]` es algo que solo puedes hacer tú, como crear el secreto del paso 4 o subir los archivos nuevos. Cuando aceptas, aplica lo primero, deja los archivos nuevos para que los subas y vuelve a ejecutar el doctor con menos fallos. Lleva los workflows a la rama por defecto del repositorio: GitHub ejecuta un evento de etiqueta con los workflows de esa rama.
- **Si no**: si el plan dice que no hay raíz de OpenSpec, ejecuta `openspec init` en el proyecto y vuelve a ejecutar `/relevo:init` (nunca crea esos archivos por sí mismo). Si no encuentra el repositorio, ejecútalo dentro de un clon con un remoto de GitHub, o inicia sesión con `gh auth login`. Si GitHub rechaza la protección de ramas en un repositorio privado gratuito, lo dice; sigue, y la confirmación escrita de `ship` es tu protección. Mira la [Configuración](configuration.es.md) y [Stacks y plataformas](stacks.es.md).

## 4. Añade la credencial del modelo

La construcción en la nube necesita una credencial para el modelo. La creas tú mismo en los secretos del repositorio: Relevo nunca la lee, y el valor nunca va en un archivo ni en la conversación.

```bash
gh secret set ANTHROPIC_API_KEY
gh secret list
```

`gh` pide el valor sin mostrarlo. Si usas una suscripción de Claude, ejecuta `claude setup-token` y guarda el token del mismo modo, con el nombre `CLAUDE_CODE_OAUTH_TOKEN`.

- **Deberías ver**: `gh secret list` muestra el nombre del secreto, nunca su valor.
- **Si no**: necesitas permisos de administrador en el repositorio para crear un secreto; ejecuta el comando dentro del clon, o añade `--repo owner/name`. La diferencia entre las dos credenciales está en [Dónde corre `go`](execution.es.md).

## 5. Escribe tu primer issue

Elige algo pequeño que puedas ver en una pantalla. Cuéntale la idea a `/relevo:issue`; pregunta solo lo que falta, comprueba el borrador con las mismas reglas que usa quien construye, lo muestra completo y lo crea cuando lo apruebas.

```text
/relevo:issue mostrar la versión de la app bajo el título de la pantalla de inicio
```

Título: Mostrar la versión de la app en la pantalla de inicio

```markdown
## Summary

Mostrar la versión de la app bajo el título de la pantalla de inicio, para que quien prueba sepa qué compilación tiene.

## Scenarios

- **WHEN** se muestra la pantalla de inicio
- **THEN** el texto "Version 1.2.0" aparece bajo el título

## Edge cases

- no se puede leer la versión: la línea no se muestra y la pantalla se abre igual

## Out of scope

- Cualquier otro cambio en la pantalla de inicio.
```

- **Deberías ver**: el borrador de arriba, una pregunta por el hito y la persona asignada (tú) y, cuando lo apruebas, el issue creado en GitHub con su enlace. Después, una pregunta aparte: ¿pongo `ready`? Di que sí en el paso 6.
- **Si no**: si la comprobación dice que faltan escenarios o casos borde, responde a lo que pregunta; no la rodees editando. Lo que necesita un issue está en [Cómo escribir un issue que Relevo pueda construir](issue-format.es.md).

## 6. Deja que se construya

Poner la etiqueta `relevo:ready` inicia la construcción. Responde que sí a la pregunta del paso 5, o, desde una terminal:

```bash
gh issue edit 1 --add-label relevo:ready
```

- **Deberías ver**: en menos de un minuto el issue recibe `relevo:building`. Después de unos minutos tiene un comentario que dice que el issue está construida ✅ (en el idioma de `language` de tu `relevo.yml`), con lo que pasó, la rama, qué probar y `Tu siguiente paso: /relevo:review 1`, y la etiqueta es `relevo:built`.
- **Si no**: si no empieza nada, comprueba que los workflows están en la rama por defecto, que el secreto existe y que el issue tiene hito y persona asignada. Un comentario que dice que la nube no está configurada significa que falta el secreto. El build instala el toolchain de tu stack (Flutter, Laravel; Vue solo necesita Node) desde `relevo-go.yml`; si cambiaste ese archivo, conserva el paso, y `/relevo:doctor` te avisa cuando falta. Mira [Dónde corre `go`](execution.es.md) y la [Guía](guide.es.md).

## 7. Revísalo

```text
/relevo:review 1
```

Conecta el teléfono o inicia el emulador, e inicia la app (`flutter run`). El agente muestra un resumen corto, las capturas que conviene tomar y una lista con una línea por escenario. Tú pruebas la app y escribes `ok 1`, `fail 2 <qué pasó>`, `capture <nombre>` o `done`. Cuando terminas audita el log y, con tu acuerdo, abre el pull request.

- **Deberías ver**: la lista; tras `done`, un veredicto `REVIEW PASSED`; después tu pregunta de si se abre el pull request, y el issue termina como `relevo:pr-open`.
- **Si no**: si no hay dispositivo, te dice qué conectar. Si una línea falla, escribe `fail <número> <qué pasó>`, ejecuta `/relevo:fix 1 <qué pasó>` y revisa otra vez. Un veredicto no concluyente significa que el log no tenía nada de tu app: iníciala de nuevo y repite los pasos. Mira [Comandos](commands.es.md) y la [Guía](guide.es.md).

## 8. Fusiónalo

```text
/relevo:ship 1
```

- **Deberías ver**: un resumen del pull request y de lo que va a pasar, y luego una pregunta que espera un sí escrito. Con tu sí archiva la especificación, fusiona el pull request en la rama de integración, cierra el issue y quita las etiquetas.
- **Si no**: si dice que las comprobaciones están corriendo o fallando, espera o arréglalas y vuelve a ejecutarlo; si dice que el issue no está listo, ejecuta el comando que nombra. Llevar la rama de integración a la de publicación es un pull request aparte. Mira la [Guía](guide.es.md).

## Qué sigue

- Trabajar con otras personas: pon `review.mode` en `peer` y lista al equipo en la [Configuración](configuration.es.md); la [Guía](guide.es.md) dice quién hace qué en cada estado.
- Añadir una segunda plataforma, o una de Vue o Laravel: [Stacks y plataformas](stacks.es.md).
- Construir en tu propia máquina, o pausar la nube: [Dónde corre `go`](execution.es.md).
- Entender qué está protegido y qué no antes de usarlo en un repositorio público: [Modelo de seguridad](security.es.md).
- Cada comando con sus argumentos: [Comandos](commands.es.md).

## Si algo sale mal

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `/relevo:` no muestra comandos | el plugin no está instalado, o no se reinició Claude Code | repite el paso 1 y reinicia Claude Code en el proyecto |
| `/relevo:init` no encuentra el repositorio | no estás en un clon con un remoto de GitHub, o `gh` no tiene la sesión iniciada | ejecuta `gh auth login` e inicia Claude Code dentro del clon |
| Poner `ready` no inicia nada | los workflows no están en la rama por defecto, o `RELEVO_CLOUD_GO` está en `off` | fusiona los archivos del paso 3 y revisa la variable del repositorio |
| Un comentario dice que la nube no está configurada | no hay secreto del modelo | créalo como en el paso 4 y vuelve a poner `ready` |
| El issue volvió a `relevo:needs-spec` | está incompleto o tiene una pregunta abierta | lee el último comentario y ejecuta `/relevo:issue 1` |
| La construcción terminó como `relevo:qa-failed` | QA lo rechazó incluso después del reintento, o el job de build no instaló ningún toolchain (el comentario dice que el SDK no está instalado) | ejecuta `/relevo:doctor` y activa el paso del toolchain de `relevo-go.yml`, o ejecuta `/relevo:fix 1` y describe lo que encontró QA |
| La revisión dice que el veredicto no es concluyente | el log no tenía ninguna línea de tu app | inicia la app de nuevo, repite los pasos y termina otra vez |
| `ship` se niega | las comprobaciones están corriendo o fallando, o la revisión no ha abierto el pull request | espera a las comprobaciones, o ejecuta antes `/relevo:review 1` |
