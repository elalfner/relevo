# Marca Relevo

El logo es **ship**: la issue entra (la rayita), agentes de IA hacen el trabajo dentro del círculo (lo vacío) y la feature sale (la punta). Todo es automático, casi sin intervención humana.

- `guia-de-uso.md`: la hoja de uso, que se ve directo en GitHub (hay también una versión interactiva, `guia-de-uso.html`). Qué significa, construcción, versiones, tamaños mínimos, espacio libre, color y qué no hacer.
- `svg/`: logos finales, con trazos convertidos en formas y el texto en curvas (no necesitan la fuente Nunito).
- `states/`: una ilustración por comando del flujo (init, think, issue, go, review, fix, ship) más feature, que no es un comando sino el motivo del flujo, en negro y en blanco. Son las del README.
- `animation/`: el logo animado corto (4,6 s, sin texto, se queda en ship, se desvanece y vuelve a empezar): SVG en negro y en blanco, y un GIF con fondo blanco.
- `source/`: los scripts para regenerar todo (ver `source/README.md`).
- `png/` y `favicon.ico`: exportaciones listas para avatar, favicon, iconos y vista previa social de GitHub.

Qué usar: `relevo-mark-*` desde 80 px de ancho, `relevo-mark-small-*` de 40 a 79 px, y por debajo de 40 px los iconos (`relevo-icon-*`, `relevo-avatar-*`, `favicon.svg`).
Tinta #000000, papel #FFFFFF. Tipografía del nombre: Nunito SemiBold (licencia SIL OFL 1.1), en minúsculas.

## Logo animado en un README de GitHub

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/animation/relevo-logo-animated-white.svg">
  <img alt="relevo" src="docs/brand/animation/relevo-logo-animated-black.svg" width="240">
</picture>
```

La animación corre una sola vez al cargar y se queda en el logo final. Si el visor no admite animaciones SVG, muestra directamente el logo final.
