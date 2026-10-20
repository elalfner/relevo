#!/usr/bin/env python3
"""Genera la hoja de uso en Markdown (guia-de-uso.md) y sus ilustraciones sueltas (guide/*.svg).
Reutiliza los dibujos de gen_guide.py; cada SVG lleva su propio estilo y fondo blanco para verse igual en tema claro y oscuro."""
import os, re

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('RELEVO_OUT', os.path.normpath(os.path.join(HERE, '..')))
src = open(os.path.join(HERE, 'gen_guide.py')).read()
exec(src.split('import base64')[0])   # define anat, cons, clear, dont, files, ...

STYLE = ('<style>.ink{fill:#0b0b0b}.paper{fill:#fff}'
         'text{font-family:Nunito,system-ui,-apple-system,"Segoe UI",sans-serif}'
         '.note,.guide,.dim{stroke:#6d6d6a}.t1{font-size:8.5px;font-weight:700;fill:#0b0b0b}.t2{font-size:6.4px;fill:#6d6d6a}'
         '.clear{fill:none;stroke:#6d6d6a;stroke-dasharray:3 3}.box{fill:none;stroke:#e6e6e3}'
         '.shadow{filter:drop-shadow(5px 6px 0 rgba(0,0,0,.35))}</style>')


def standalone(svg, name, width=None):
    m = re.search(r'viewBox="([-\d. ]+)"', svg)
    x, y, w, h = [float(v) for v in m.group(1).split()]
    svg = re.sub(r'\sclass="(fig|anat)(?: shadow)?"', lambda k: ' class="%s"' % k.group(0).split('"')[1], svg, count=1)
    head = re.match(r'<svg[^>]*>', svg).group(0)
    wpx = width or 480
    head2 = head.replace('<svg ', '<svg width="%d" height="%d" ' % (wpx, round(wpx * h / w)), 1)
    bg = '<rect x="%s" y="%s" width="%s" height="%s" rx="6" fill="#fff" stroke="#e6e6e3" stroke-width=".8"/>' % (x, y, w, h)
    body = svg[len(head):]
    os.makedirs(OUT + '/guide', exist_ok=True)
    open('%s/guide/%s.svg' % (OUT, name), 'w').write(head2 + STYLE + bg + body + '\n')


standalone(anat, 'anatomia')
standalone(cons, 'construccion')
standalone(clear, 'espacio-libre')
for i, (cap, svgs) in enumerate(dont, 1):
    standalone(svgs, 'no-%d' % i, 240)
open(OUT + '/guide/color.svg', 'w').write(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 120" width="460" height="120" role="img" aria-label="Tinta #000000 y papel #FFFFFF">'
    '<style>text{font-family:Nunito,system-ui,-apple-system,"Segoe UI",sans-serif;font-weight:700;font-size:15px}</style>'
    '<rect x="1" y="1" width="218" height="118" rx="14" fill="#000"/><text x="20" y="66" fill="#fff">Tinta · #000000</text>'
    '<rect x="241" y="1" width="218" height="118" rx="14" fill="#fff" stroke="#c9c9c5" stroke-width="2"/><text x="260" y="66" fill="#000">Papel · #FFFFFF</text></svg>\n')


def pic(name, width, folder='svg', alt='Relevo', dark=True):
    base = name.rsplit('-black', 1)[0]
    white = '%s/%s-white.svg' % (folder, base)
    return ('<picture><source media="(prefers-color-scheme: dark)" srcset="%s"><img alt="%s" src="%s/%s.svg" width="%d"></picture>'
            % (white, alt, folder, name, width))


def img(path, alt, width):
    return '<img alt="%s" src="%s" width="%d">' % (alt, path, width)


def card(name, width, title, text, folder='svg'):
    return '| %s | **%s**<br>%s |' % (pic(name, width, folder), title, text)


md = '''<div align="center">

%(hero)s

# La issue entra, la feature sale

**En medio, agentes de IA hacen el trabajo, de forma automática y casi sin intervención humana.**

</div>

Este es el logo final, el último estado de la animación. Una issue entró por la izquierda, agentes de IA hicieron el trabajo dentro del círculo y la feature salió por la derecha. Esta hoja explica cómo usarlo sin que deje de ser el mismo.

[Marca y licencia](LICENSE.md) · [Marca registrada](../../TRADEMARKS.es.md) · [Regenerar todo](source/README.md)

## Qué significa

Tres piezas, una historia.

<div align="center">

%(anat)s

</div>

- **El círculo** es la feature. Lo vacío es el espacio donde trabajan los agentes de IA, de forma automática.
- **La rayita** es la issue: entra por la izquierda, siempre antes.
- **La punta** es `ship`: la feature ya salió, se entrega. Siempre a la derecha, siempre fuera del círculo.
- El negro aparece solo cuando una persona toma el testigo, para pensar y para revisar. Por eso el logo final está vacío: el trabajo lo hicieron los agentes.

## Construcción

Todo sale de una sola medida.

<div align="center">

%(cons)s

</div>

- Círculo de **Ø 100** y trazo de **8**, centrado en el contorno.
- La rayita y cada brazo de la punta miden lo mismo: **8 × 20**, con extremos redondeados.
- La separación entre el círculo y la rayita, y entre el círculo y la punta, es la misma: **6**.
- Los brazos de la punta forman **45°** con el eje y quedan a la misma altura que el centro.
- Esta repetición es lo que mantiene la marca ordenada. Cambiar una medida es cambiar el logo.

## Versiones

Son el mismo logo. Solo cambian el grosor del trazo y el fondo, para que se vea igual de bien a cada tamaño. No hay que mezclar versiones en una misma pantalla al mismo tamaño.

| | |
|:---:|---|
%(cards)s

## Animación

Cuatro segundos y medio, y se queda en ship.

<div align="center">

%(anim)s

</div>

Es la versión corta del logo animado, sin texto: el círculo nace, los agentes de IA trabajan, la issue entra y la feature sale. Se queda unos segundos en el logo final, se desvanece y vuelve a empezar (un ciclo dura unos 13 s). Es un bucle a propósito: un SVG no sabe cuándo está a la vista, así que quien llega con el scroll lo ve moverse en pocos segundos. Para el README y la web.

En un README de GitHub, con versión para tema oscuro:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/animation/relevo-logo-animated-white.svg">
  <img alt="relevo" src="docs/brand/animation/relevo-logo-animated-black.svg" width="240">
</picture>
```

Donde no se admite un SVG animado (algunos chats y correos) está el mismo recorrido en GIF (`animation/relevo-logo-animated.gif`), con fondo blanco, que también se repite. Quien abre el SVG en un visor sin animaciones ve directamente el logo final.

## Tamaños mínimos

Por debajo de 40 px, el icono.

<table><tr align="center" valign="bottom">
<td>%(m80)s<br><sub>A · desde 80 px de ancho</sub></td>
<td>%(m40)s<br><sub>G · de 40 a 79 px</sub></td>
<td>%(i32)s<br><sub>Icono · desde 16 px</sub></td>
<td>%(i16)s<br><sub>Icono a 16 px (favicon)</sub></td>
</tr></table>

Si el logo tendría que mostrarse a menos de 40 px de ancho, no lo reduzcas: usa el icono. A 16 px el icono se ve como un bloque con un círculo claro, que es suficiente para reconocerlo.

## Espacio libre

Medio círculo de aire alrededor.

<div align="center">

%(clear)s

</div>

- Deja como mínimo **x** de espacio libre en todos los lados, donde **x = la mitad del diámetro del círculo** (54 unidades en el maestro).
- Nada de texto, bordes ni imágenes dentro de ese margen.
- Con el nombre, el margen se mide desde el borde del conjunto completo.

## Color y tipografía

Un solo color, una sola letra.

<div align="center">

<img alt="Tinta #000000 y papel #FFFFFF" src="guide/color.svg" width="460">

</div>

El logo es siempre de un solo color: tinta sobre papel, o papel sobre tinta. Sobre fotos o fondos de color, usa el que dé más contraste.

El nombre del logo es **Nunito SemiBold**, en minúsculas (licencia SIL OFL 1.1): con ese peso las letras y el símbolo se sienten dibujados con el mismo trazo. En las animaciones y la documentación, el texto de interfaz va en negrita: los comandos como `/relevo:` en gris y la palabra del comando en negrita, y lo que no es comando (**feature**, **relevo**) solo en negrita, sin prefijo.

## Qué no hacer

Ocho maneras de dejar de ser Relevo.

<table>
%(donts)s
</table>

## Archivos

Qué hay en la carpeta `docs/brand/`. Todos los SVG tienen los trazos convertidos en formas y el texto en curvas, así que se ven igual aunque no esté instalada Nunito.

| Archivo | Para qué |
|---|---|
%(files)s
'''

cards = [
    card('relevo-mark-black', 160, 'Logo principal', 'Desde 80 px de ancho. README, web, presentaciones, portadas. Trazo 8.'),
    card('relevo-mark-small-black', 120, 'Corte óptico', 'De 40 a 79 px de ancho. Trazo 12 y detalles un poco más gruesos para que no se pierdan. Mismas proporciones.'),
    card('relevo-icon-black', 72, 'Avatar, favicon, icono de app', 'Desde 16 px. El mismo logo en blanco sobre un cuadrado negro (o al revés). El cuadrado es solo el contenedor, nunca parte del logo.'),
    card('relevo-lockup-horizontal-black', 240, 'Encabezados y barras', 'El nombre va en Nunito SemiBold, en minúsculas, a la derecha. El centro del círculo queda a la altura del centro de las letras.'),
    card('relevo-lockup-vertical-black', 120, 'Portadas y carteles', 'El nombre debajo, centrado. Úsalo cuando haya más alto que ancho.'),
]
donts = []
for i in range(0, len(dont), 4):
    donts.append('<tr align="center" valign="top">' + ''.join(
        '<td>%s<br><sub>✕ %s</sub></td>' % (img('guide/no-%d.svg' % (i + j + 1), dont[i + j][0], 180), dont[i + j][0]) for j in range(4)) + '</tr>')

rows = '\n'.join('| `%s` | %s |' % (a, b) for a, b in files)
vals = dict(
    hero=pic('relevo-lockup-horizontal-black', 420, alt='relevo'),
    anat=img('guide/anatomia.svg', 'Anatomía del logo', 520),
    cons=img('guide/construccion.svg', 'Construcción del logo', 520),
    clear=img('guide/espacio-libre.svg', 'Espacio libre', 520),
    cards='\n'.join(cards),
    anim=pic('relevo-logo-animated-black', 240, folder='animation', alt='relevo, logo animado'),
    m80=img('svg/relevo-mark-black.svg', 'Logo principal', 80), m40=img('svg/relevo-mark-small-black.svg', 'Corte óptico', 40),
    i32=img('svg/relevo-icon-black.svg', 'Icono', 32), i16=img('svg/relevo-icon-black.svg', 'Icono a 16 px', 16),
    donts='\n'.join(donts), files=rows)
open(OUT + '/guia-de-uso.md', 'w').write(md % vals)
print('guia-de-uso.md', len(md % vals))
