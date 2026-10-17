# Cómo funciona

[English](how-it-works.md) · Español

## La idea

Escribir código ya no es lo lento. Verificarlo sí. Relevo pone al agente donde es rápido (construir y revisarse a sí mismo) y a las personas donde son insustituibles (probar en un dispositivo real, revisar el trabajo de un par, decidir si se mergea).

```
 quien escribe      agente (nube)           responsable           par
 las specs          construye + QA          revisa en dispositivo aprueba + mergea
 issues listos  ──► sin esperar a nadie ──► corrige, abre PR  ──► y cierra el ciclo
 en un milestone
```

- **Primero las specs.** La entrada son issues detallados, listos para construir. El agente construye contra ellos y QA compara el diff contra ellos.
- **Se jala, no se empuja.** Un límite de trabajo en curso por persona evita que el agente entierre al equipo en ramas sin revisar.
- **Deciden las personas.** Aprobar y mergear son actos humanos explícitos, impuestos por la protección de ramas y nunca solo por un prompt.
- **Cada traspaso es un solo mensaje** que dice qué pasó, qué se espera de ti y qué comando ejecutar después.

## Velo funcionar

Una corrida real en el [sandbox](https://github.com/elalfner/relevo-sandbox), una app Flutter pequeña, para el [issue #5](https://github.com/elalfner/relevo-sandbox/issues/5), "Show the build number". Una sola persona hizo todos los roles.

| Paso | La persona | Relevo | Tiempo |
|---|---|---|---|
| 1 | piensa la idea (la exploración y la entrevista que ejecuta `/relevo:think`) y aprueba el texto del issue | explora el código, pregunta hasta que cada decisión está tomada y redacta el issue: escenarios, casos borde y el vocabulario nuevo en una sección `Documentation` | una conversación |
| 2 | etiqueta el issue `relevo:ready` | el trabajo ligero `decide` aplica los gates y reclama el issue | 17 s |
| 3 | nada | el trabajo `build` escribe la especificación, el código y las pruebas, y QA los revisa | 3 min 35 s |
| 4 | lee el traspaso y ejecuta `/relevo:review 5` en un teléfono | captura pantallas, audita el log y abre el [pull request](https://github.com/elalfner/relevo-sandbox/pull/16) | unos minutos |
| 5 | ejecuta `/relevo:ship 5` y confirma | mergea, archiva la especificación y cierra el issue | segundos |

El traspaso que el agente dejó en el issue, abreviado (los mensajes los escribe Relevo en el idioma que configures; este está en inglés):

```
@elalfner #5 "Show the build number" is built ✅

What happened: 11 of 11 tasks done, QA passed.
Branch: feature/5-show-the-build-number
What to test: 8 scenarios (checklist below)
Riskiest area, check it first: The real build number from an APK through the
Android package_info_plus plugin (tests only use the mock), and how the two
texts look on a small physical device.
Your next step: /relevo:review 5
```

Las entradas del glosario que salieron de la conversación viajaron dentro del issue y llegaron en el mismo pull request que la funcionalidad, así que nadie subió documentación a mano. La revisión entre pares, los recordatorios y la selección de revisor necesitan una segunda persona y no formaron parte de esta corrida.
