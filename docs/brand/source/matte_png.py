#!/usr/bin/env python3
"""Recupera el canal alfa de los PNG renderizados sobre blanco y sobre negro, y arma favicon.ico.
Uso: matte_png.py <carpeta temporal que imprimió render_png.js>"""
import json, os, sys
import numpy as np
from PIL import Image

tmp = sys.argv[1]
root = os.environ.get('RELEVO_OUT') or os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
for base, out in json.load(open(os.path.join(tmp, 'todo.json'))):
    w = np.asarray(Image.open(base + '-w.png').convert('RGB')).astype(np.float64)
    b = np.asarray(Image.open(base + '-b.png').convert('RGB')).astype(np.float64)
    a = np.clip(1 - (w - b).mean(axis=2) / 255.0, 0, 1)        # alfa = 1 - (blanco - negro)
    safe = np.where(a > 1e-4, a, 1)[..., None]
    rgb = np.clip(b / safe, 0, 255)                              # color sin premultiplicar
    rgba = np.dstack([rgb, a * 255]).round().astype(np.uint8)
    rgba[a <= 1e-4] = 0
    Image.fromarray(rgba, 'RGBA').save(out)

imgs = [Image.open(os.path.join(root, 'png', 'favicon-%d.png' % n)).convert('RGBA') for n in (16, 32, 48)]
imgs[2].save(os.path.join(root, 'favicon.ico'), format='ICO', sizes=[(16, 16), (32, 32), (48, 48)], append_images=imgs[:2])
print('png y favicon.ico listos')
