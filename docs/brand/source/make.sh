#!/usr/bin/env bash
# Regenera todo (SVG, animación, PNG, favicon, GIF y la hoja de uso) en la carpeta superior,
# o en la que indiques con RELEVO_OUT. Ver README.md de esta carpeta para los requisitos.
set -euo pipefail
cd "$(dirname "$0")"
python3 build.py                       # SVG: marcas, iconos y lockups
node short.cjs                          # SVG animado corto
TMP=$(node render_png.cjs | tail -n 1)  # PNG (dos pasadas para la transparencia)
python3 matte_png.py "$TMP"            # alfa + favicon.ico
node make_gif.cjs                       # GIF
python3 gen_guide.py                   # hoja de uso
python3 gen_guide_md.py               # hoja de uso en Markdown (se ve en GitHub)
