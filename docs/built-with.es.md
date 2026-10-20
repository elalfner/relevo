# Construido con OpenSpec y mattpocock/skills

[English](built-with.md) · Español

Relevo se especificó y se construyó como pide que trabajes: con [OpenSpec](https://github.com/Fission-AI/OpenSpec) (licencia MIT), primero la spec, luego el código y luego el piloto.

- El diseño vive en `openspec/`. Las especificaciones, tal como están hoy, están en [`specs/`](../openspec/specs). [`changes/archive/2026-10-16-relevo-v1`](../openspec/changes/archive/2026-10-16-relevo-v1) conserva el cambio que las construyó: la propuesta, las decisiones de diseño (D1 a D16, cada una con las alternativas que se descartaron), las once especificaciones tal como se escribieron y la lista de tareas. Los cambios posteriores, como `glossary-travels-with-the-issue`, siguen el mismo camino, y los terminados se archivan en `openspec/changes/archive/`.
- El historial muestra cómo fue creciendo: los commits y los pull requests, y los dos pilotos documentados en [pilot-findings.md](pilot-findings.md), con lo que falló y cómo se arregló (escritos en inglés). El [sandbox](https://github.com/elalfner/relevo-sandbox) es una app Flutter pequeña donde corrió el ciclo completo, y sigue ahí para leerse.
- El pensamiento se hizo con las skills de [mattpocock/skills](https://github.com/mattpocock/skills) (licencia MIT), las mismas que `/relevo:think` ejecuta por ti.

OpenSpec y esas skills son también con lo que trabaja el plugin: `think` las ejecuta, y `go` y `ship` usan la línea de comandos de OpenSpec para escribir y archivar la especificación de cada issue. Las copias que guarda este repositorio son herramientas de desarrollo y no forman parte del plugin (ver [Comandos](commands.es.md#skills-que-usa-think)).
