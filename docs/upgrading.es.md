# Actualizar

[English](upgrading.md) · Español

Un proyecto que se quedó en una versión vieja de Relevo puede subir sin romperse. Tres cosas llevan una versión y cada una se mueve en un sitio distinto, así que el orden importa.

## Qué lleva una versión

| Qué | Dónde vive su versión | Cómo se mueve |
|---|---|---|
| El plugin de cada máquina: los comandos y las skills que escribes | la instalación de Claude Code, por alcance (usuario, proyecto o local) | cada persona, con `claude plugin update` |
| Los workflows del repositorio | `RELEVO_VERSION` (los scripts que ejecutan) y `# relevo-template:` en la primera línea (la versión de su texto) | `/relevo:init`, mediante un pull request |
| El plugin que carga el agente en la nube | el mismo paquete que el workflow desempaca en `RELEVO_VERSION` | se mueve con la versión fijada |

La versión fijada y la marca son cosas distintas. Subir `RELEVO_VERSION` a mano mueve los scripts y deja el texto del workflow como estaba, y así es como un workflow acaba con texto viejo y scripts nuevos. En [Instalación](install.es.md) está qué es cada una.

Un workflow copiado de una versión anterior todavía añade el plugin desde un marketplace, que no tiene versión, así que una ejecución en la nube toma el último plugin. Es una razón más para actualizar los workflows y no solo la versión fijada.

## El orden

1. Actualiza el plugin en cada máquina. Es seguro en cualquier orden: un plugin más nuevo lee un `relevo.yml` más viejo, porque los ajustes que añade son opcionales y tienen valor por defecto.
2. Ejecuta `/relevo:init` y lee su plan. Los workflows que se pueden fusionar con la plantilla nueva sin un conflicto se ofrecen como actualizaciones, con su diferencia. Aplica, haz commit de los archivos en una rama y abre un pull request a la rama por defecto, porque un workflow solo corre desde ahí. Las etiquetas y los demás ajustes del repositorio que `init` cambia se cambian en el acto, y los archivos quedan en tu copia de trabajo para que los commitees.
3. Solo cuando cada máquina y cada workflow corran la versión nueva, añade los ajustes nuevos a `relevo.yml`. Una versión más vieja rechaza un ajuste que no conoce (`unknown setting`), así que una clave nueva rompe la máquina o el workflow que todavía va atrás.
4. Ejecuta `/relevo:doctor` para comprobar el resultado.

## Leer las versiones

`/relevo:doctor` tiene una línea entre sus notas con las versiones que puede leer aquí, sin red: el plugin en uso, cada instalación que Claude Code lista para tu usuario y para este repositorio, y las versiones fijadas en los workflows de la rama por defecto.

```bash
claude plugin list
```

Aparece un aviso cuando los alcances están en versiones distintas, con el comando que actualiza el que se quedó atrás, cuando el texto de un workflow es más viejo que su versión fijada, y cuando un workflow no tiene marca, así que se desconoce la edad de su texto. Para el plugin de una máquina:

```bash
claude plugin marketplace update relevo
```

```bash
claude plugin update relevo@relevo
```

Reinicia Claude Code después. Claude Code no actualiza un marketplace por sí solo salvo que lo actives en `/plugin`.

## Actualizar los workflows

Cuando un workflow existe y difiere de la plantilla, `/relevo:init` no adivina. Busca la plantilla publicada más cercana a tu archivo, la descarga con `npm` y fusiona tres textos: esa plantilla, tu archivo y la plantilla actual. Tus cambios, como tu línea de credencial o tu runner, se conservan; entra el texto nuevo; la versión fijada y la marca quedan en la versión actual.

- Una fusión limpia aparece en el plan como una actualización, con su diferencia, y se escribe solo cuando estás de acuerdo.
- Un conflicto, que significa que cambiaste una línea que la plantilla nueva también cambió, no escribe nada: el plan nombra el archivo y muestra las dos versiones, y lo fusionas a mano.
- Cuando ninguna versión publicada se parece a tu archivo, el plan lo dice. Dile a `/relevo:init` de qué versión se copió el workflow y lo intenta de nuevo con esa.

Solo escribe bajo `.github/workflows/`, y necesita `npm` y una conexión de red para descargar las plantillas viejas.

## Archivos que ningún agente puede leer

Un repositorio que versiona un archivo de la lista restringida detiene todas las ejecuciones al pasar a una versión con [archivos restringidos](security.es.md). `go` termina en `qa-failed` con "restricted file in the diff", aunque el archivo no sea parte del cambio, porque la comprobación también lee lo que la rama base versiona, y `/relevo:doctor` falla por él.

La lista coincide por nombre, así que los casos que sorprenden no son solo secretos: un `.env.production` o `.env.testing` con valores que no son secretos, un `.env.sample`, un `.pem` o `.key` guardado como dato de prueba, y la configuración móvil (`google-services.json`, `GoogleService-Info.plist`, `key.properties`). Solo `.env.example` está exento.

Antes de subir la versión fijada, ejecuta `/relevo:doctor` en la versión nueva y lee los archivos que nombra. Deja de versionar cada uno y manténlo fuera de git, o acepta que las ejecuciones se detengan. Después de cambiar `restricted_paths` en `relevo.yml`, ejecuta `/relevo:init` otra vez: reescribe las denegaciones entre los marcadores `# relevo:restricted` de `relevo-go.yml`, y nada más lo hace. Si tu workflow ya tiene su propia entrada `settings:` en el paso del agente, fusiona las dos a mano.

## Cuando algo sale mal

| Lo que ves | Por qué | Qué hacer |
|---|---|---|
| `unknown setting` al ejecutar un comando | `relevo.yml` tiene una clave que esta versión no conoce | actualiza el plugin o la versión fijada de la máquina o del workflow que lo reporta, o quita la clave |
| `init` muestra un conflicto en un workflow | editaste una línea que la plantilla nueva también cambió | compara el archivo con la plantilla y fusiónalo a mano, y ejecuta `/relevo:init` otra vez |
| `doctor` dice que el texto de un workflow es más viejo que su versión fijada | la versión fijada se subió a mano | ejecuta `/relevo:init` para actualizar el texto |
| una ejecución en la nube se comporta como una versión anterior | el workflow todavía carga el plugin desde el marketplace | actualiza el workflow con `/relevo:init` |
