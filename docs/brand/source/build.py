#!/usr/bin/env python3
"""Genera los SVG finales de Relevo (todo en trazos convertidos a formas, texto en curvas)."""
import json, math, os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
import uharfbuzz as hb

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('RELEVO_OUT', os.path.normpath(os.path.join(HERE, '..')))
FONT = os.path.join(HERE, 'fonts', 'nunito600.ttf')
S2 = math.sqrt(0.5)


def f(x):
    s = ('%.3f' % x).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


# ---------- geometría: cada forma es una lista de comandos absolutos ----------
def ring(r, sw):
    R, q = r + sw / 2, r - sw / 2
    return [('M', R, 0), ('A', R, 1, 1, -R, 0), ('A', R, 1, 1, R, 0), ('Z',),
            ('M', q, 0), ('A', q, 1, 1, -q, 0), ('A', q, 1, 1, q, 0), ('Z',)]


def capsule(x1, x2, sw):
    h = sw / 2
    return [('M', x1, -h), ('L', x2, -h), ('A', h, 0, 1, x2, h), ('L', x1, h), ('A', h, 0, 1, x1, -h), ('Z',)]


def chevron(t, arm, sw):
    h, d = sw / 2, arm * S2
    A, B = (t - d, -d), (t - d, d)
    hs = h * S2
    return [('M', A[0] + hs, A[1] - hs),
            ('L', t + hs, -hs), ('A', h, 0, 1, t + hs, hs),
            ('L', B[0] + hs, B[1] + hs), ('A', h, 0, 1, B[0] - hs, B[1] - hs),
            ('L', t - h * math.sqrt(2), 0),
            ('L', A[0] - hs, A[1] + hs), ('A', h, 0, 1, A[0] + hs, A[1] - hs), ('Z',)]


def rrect(x, y, w, h, r):
    return [('M', x + r, y), ('L', x + w - r, y), ('A', r, 0, 1, x + w, y + r), ('L', x + w, y + h - r),
            ('A', r, 0, 1, x + w - r, y + h), ('L', x + r, y + h), ('A', r, 0, 1, x, y + h - r),
            ('L', x, y + r), ('A', r, 0, 1, x + r, y), ('Z',)]


def d_of(cmds, sc=1.0, ox=0.0, oy=0.0):
    out = []
    for c in cmds:
        k = c[0]
        if k == 'Z':
            out.append('Z')
        elif k in 'ML':
            out.append('%s%s %s' % (k, f(ox + sc * c[1]), f(oy + sc * c[2])))
        elif k == 'A':
            out.append('A%s %s 0 %d %d %s %s' % (f(sc * c[1]), f(sc * c[1]), c[2], c[3], f(ox + sc * c[4]), f(oy + sc * c[5])))
    return ''.join(out)


def ship(sw, ringR, arm, dash, gap, with_dash=True):
    """Devuelve comandos y caja (left, right) del ship con su centro del anillo en el origen."""
    h = sw / 2
    Ro = ringR + h
    d = arm * S2
    t = Ro + gap + d + h
    cmds = ring(ringR, sw)
    left = -Ro
    if with_dash:
        dr = -(Ro + gap) - h
        dl = dr - dash
        cmds += capsule(dl, dr, sw)
        left = dl - h
    cmds += chevron(t, arm, sw)
    return cmds, left, t + h, Ro


A_ = ship(8, 50, 12, 12, 6)       # maestro
G_ = ship(12, 48, 12, 12, 5)      # corte óptico para 24 a 63 px (rayita y brazos con la misma medida)


# ---------- texto en curvas ----------
font = TTFont(FONT)
UPEM = font['head'].unitsPerEm
XH = font['OS/2'].sxHeight
GLYPHS = font.getGlyphSet()
ORDER = font.getGlyphOrder()
hbfont = hb.Font(hb.Face(hb.Blob.from_file_path(FONT)))


def word_path(text, size, x0, base):
    """Path (d) y caja del texto. x0: inicio, base: línea base."""
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {'kern': True, 'liga': False})
    s = size / UPEM
    x = x0
    pen = SVGPathPen(GLYPHS, ntos=f)
    bp = BoundsPen(GLYPHS)
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = ORDER[info.codepoint]
        tr = (s, 0, 0, -s, x + pos.x_offset * s, base - pos.y_offset * s)
        GLYPHS[name].draw(TransformPen(pen, tr))
        GLYPHS[name].draw(TransformPen(bp, tr))
        x += pos.x_advance * s
    return pen.getCommands(), bp.bounds   # (xmin, ymin, xmax, ymax)


def svg(vb, body, label='Relevo', extra=''):
    x, y, w, h = vb
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s %s %s %s" width="%s" height="%s" role="img" aria-label="%s">%s'
            '<title>%s</title>%s</svg>\n' % (f(x), f(y), f(w), f(h), f(w), f(h), label, extra, label, body))


def pth(d, fill, rule=True):
    return '<path fill="%s"%s d="%s"/>' % (fill, ' fill-rule="evenodd"' if rule else '', d)


INK, PAPER = '#000000', '#FFFFFF'
files = {}


def mark(name, g, ink):
    cmds, left, right, Ro = g
    vb = (left, -Ro, right - left, 2 * Ro)
    files['svg/%s.svg' % name] = svg(vb, pth(d_of(cmds), ink))


for color, ink in (('black', INK), ('white', PAPER)):
    mark('relevo-mark-%s' % color, A_, ink)
    mark('relevo-mark-small-%s' % color, G_, ink)


# ---------- iconos: ship (corte G) dentro de un cuadrado ----------
def badge(name, bg, fg, radius_frac, frac=0.64, size=100, knockout=False, label='Relevo', extra=''):
    cmds, left, right, Ro = G_
    sc = size * frac / (right - left)
    ox, oy = size / 2 - sc * (left + right) / 2, size / 2
    sq = rrect(0, 0, size, size, size * radius_frac) if radius_frac else [('M', 0, 0), ('L', size, 0), ('L', size, size), ('L', 0, size), ('Z',)]
    if knockout:
        d = d_of(sq) + d_of(cmds, sc, ox, oy)
        body = pth(d, bg)
    else:
        body = pth(d_of(sq), bg, rule=False) + pth(d_of(cmds, sc, ox, oy), fg)
    files['svg/%s.svg' % name] = svg((0, 0, size, size), body, label, extra)


badge('relevo-icon-black', INK, PAPER, 0.224)
badge('relevo-icon-white', PAPER, INK, 0.224)
badge('relevo-avatar-black', INK, PAPER, 0)
badge('relevo-avatar-white', PAPER, INK, 0)
fav_style = '<style>path{fill:#000}@media (prefers-color-scheme:dark){path{fill:#f3f3f0}}</style>'
badge('favicon', INK, PAPER, 0.224, knockout=True, extra=fav_style)
# el path del favicon no debe llevar fill fijo para que el estilo mande
files['svg/favicon.svg'] = files['svg/favicon.svg'].replace('fill="#000000" ', '')

# ---------- lockups con el nombre ----------
cmds, left, right, Ro = A_
FS_H, GAP_H = 120, 40
tx = right + GAP_H
text_d, tb = word_path('relevo', FS_H, tx, XH * FS_H / UPEM / 2)
for color, ink in (('black', INK), ('white', PAPER)):
    minx, miny = min(left, tb[0]), min(-Ro, tb[1])
    maxx, maxy = max(right, tb[2]), max(Ro, tb[3])
    body = pth(d_of(cmds), ink) + pth(text_d, ink, rule=False)
    files['svg/relevo-lockup-horizontal-%s.svg' % color] = svg((minx, miny, maxx - minx, maxy - miny), body)

FS_V, GAP_V = 96, 40
cx = (left + right) / 2
_, tb0 = word_path('relevo', FS_V, 0, 0)
w_text = tb0[2] - tb0[0]
base_v = Ro + GAP_V - tb0[1]
text_v, tbv = word_path('relevo', FS_V, cx - w_text / 2 - tb0[0], base_v)
for color, ink in (('black', INK), ('white', PAPER)):
    minx, maxx = min(left, tbv[0]), max(right, tbv[2])
    miny, maxy = -Ro, tbv[3]
    body = pth(d_of(cmds), ink) + pth(text_v, ink, rule=False)
    files['svg/relevo-lockup-vertical-%s.svg' % color] = svg((minx, miny, maxx - minx, maxy - miny), body)

# ---------- escribir ----------
os.makedirs(OUT + '/svg', exist_ok=True)
os.makedirs(OUT + '/png', exist_ok=True)
for p, s in files.items():
    open(os.path.join(OUT, p), 'w').write(s)
print('\n'.join(sorted(files)))
