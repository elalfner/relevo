# Cómo regenerar la marca

Todo lo que hay en `svg/`, `animation/`, `png/`, `favicon.ico` y `guia-de-uso.html` sale de estos scripts. Si cambias una medida, regenera y todo queda coherente.

## Requisitos

- Python 3 con `pip install -r requirements.txt` (fonttools, uharfbuzz, numpy, pillow).
- Node.js con `npm install playwright` y `npx playwright install chromium` (para los PNG, el GIF y la comprobación de la animación).
- ImageMagick (el comando `convert`), solo para el GIF.

## Uso

Los scripts de Node son `.cjs` a propósito: el repositorio de Relevo declara `"type": "module"` en su `package.json`, y con `.js` fallarían.

```bash
./make.sh                      # regenera todo en la carpeta superior
RELEVO_OUT=/ruta ./make.sh     # o en otra carpeta
```

Si Playwright no encuentra el navegador, indícalo con `CHROMIUM_PATH=/ruta/a/chrome`.

## Qué hace cada archivo

| Archivo | Qué genera |
|---|---|
| `build.py` | Los SVG: marcas A y G, iconos, avatares, favicon y lockups con el nombre (los trazos se convierten en formas y el texto en curvas), y las siete ilustraciones de estados en `states/`. |
| `short.cjs` | El SVG animado corto (negro y blanco), muestreado a 30 fps con las mismas fórmulas que la animación larga. |
| `render_png.cjs` + `matte_png.py` | Los PNG, con transparencia real, y `favicon.ico`. |
| `make_gif.cjs` | El GIF del logo animado. |
| `gen_guide.py` | La hoja de uso (`guia-de-uso.html`). |
| `fonts/` | Nunito SemiBold, para el nombre, con su licencia (`OFL.txt`). |

## Dónde están las medidas

En `build.py`, al principio:

```python
A_ = ship(8, 50, 12, 12, 6)    # maestro: trazo, radio, brazo, rayita, separación
G_ = ship(12, 48, 12, 12, 5)   # corte para tamaños pequeños
```

`ship(trazo, radio del círculo, largo de cada brazo de la punta, largo de la rayita, separación)`. Los lockups usan `FS_H` y `GAP_H` (horizontal) y `FS_V` y `GAP_V` (vertical).

Los tiempos de la animación corta están en `short.cjs`, dentro de `state(t)`.

## Licencia de esto

Los scripts son MIT. Los archivos que generan son de la marca Relevo (ver `TRADEMARKS.md`). La fuente Nunito mantiene su propia licencia (SIL OFL 1.1).
