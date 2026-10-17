#!/usr/bin/env python3
"""Genera la hoja de uso (guia-de-uso.html) con los mismos trazados que los SVG finales."""
import math, re

import os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('RELEVO_OUT', os.path.normpath(os.path.join(HERE, '..')))

# geometría (la misma de build.py, sin sus efectos)
src = open(os.path.join(HERE, 'build.py')).read()
exec(src.split('# ---------- texto en curvas ----------')[0])


def rd(name):
    return open('%s/svg/%s.svg' % (OUT, name)).read()


def inline(name, cls='', label='Relevo', width=None, flip=False):
    s = rd(name)
    vb = re.search(r'viewBox="([^"]+)"', s).group(1)
    inner = re.search(r'</title>(.*)</svg>', s, re.S).group(1)
    inner = inner.replace('fill="#000000"', 'class="ink"').replace('fill="#FFFFFF"', 'class="paper"')
    w = ' style="width:%spx"' % width if width else ''
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" class="%s" role="img" aria-label="%s"%s>%s</svg>' % (vb, cls, label, w, inner)


def mark_d(cmds, left, right, Ro):
    return d_of(cmds)


A_cmds, A_l, A_r, A_Ro = A_
mark_path = '<path class="ink" fill-rule="evenodd" d="%s"/>' % d_of(A_cmds)


def variant(cmds, extra='', transform='', vb=None, defs=''):
    vb = vb or '-110 -70 220 140'
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" class="fig" role="img" aria-label="ejemplo">%s<g%s>'
            '<path class="ink" fill-rule="evenodd" d="%s"/>%s</g></svg>') % (vb, defs, (' transform="%s"' % transform) if transform else '', d_of(cmds), extra)


# --- ejemplos de lo que no se debe hacer ---
dont = []
dont.append(('Estirarlo o aplastarlo', variant(A_cmds, transform='translate(-2 0) scale(1.35 .8)')))
big = ship(8, 50, 24, 12, 6)
dont.append(('Agrandar la punta o cambiar sus ángulos', variant(big[0])))
dont.append(('Rellenar el círculo: lo vacío son los agentes', variant(A_cmds, extra='<circle r="54" class="ink"/>')))
dont.append(('Añadirle elementos nuevos', variant(A_cmds, extra='<path class="ink" d="%s"/>' % d_of(capsule(-104, -92, 8)))))
dont.append(('Quitarle la rayita', variant(ship(8, 50, 12, 12, 6, with_dash=False)[0], transform='translate(-4 0)')))
dont.append(('Girarlo', variant(A_cmds, transform='rotate(-24)')))
grad = '<defs><linearGradient id="gr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#f97316"/></linearGradient></defs>'
dont.append(('Degradados o colores sueltos', variant(A_cmds).replace('class="ink"', 'fill="url(#gr)"').replace('<g>', '<g>').replace('aria-label="ejemplo">', 'aria-label="ejemplo">' + grad)))
dont.append(('Sombras o contornos extra', variant(A_cmds).replace('class="fig"', 'class="fig shadow"')))

dont_html = ''.join('<figure class="dont"><div class="dbox">%s<span class="x" aria-hidden="true">✕</span></div><figcaption>%s</figcaption></figure>' % (svgs, cap) for cap, svgs in dont)

# --- anatomía ---
anat = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-128 -96 256 196" class="anat" role="img" aria-label="Anatomía del logo">'
        + mark_path +
        '<g class="note" fill="none" stroke-width=".8"><path d="M0 -58V-66"/><path d="M-70 8V30"/><path d="M72.5 12V30"/></g>'
        '<g text-anchor="middle">'
        '<text x="0" y="-81" class="t1">la feature</text><text x="0" y="-72" class="t2">lo que se construye y se entrega</text>'
        '<text x="0" y="-1" class="t1">agentes de IA</text><text x="0" y="9" class="t2">trabajan solos</text>'
        '<text x="-70" y="41" class="t1">la issue</text><text x="-70" y="50" class="t2">de dónde viene</text>'
        '<text x="72.5" y="41" class="t1">ship</text><text x="72.5" y="50" class="t2">ya salió, se entrega</text></g></svg>')

# --- construcción ---
cons = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-104 -78 208 156" class="anat" role="img" aria-label="Construcción del logo">'
        '<g class="guide" fill="none" stroke-width=".7">'
        '<path d="M-95 0H95" /><path d="M0 -62V62"/><circle r="50" stroke-dasharray="2 2"/>'
        '<path d="M72.5 0L64 -8.485" /><path d="M72.5 0L64 8.485"/></g>'
        + mark_path +
        '<g class="dim" fill="none" stroke-width=".8">'
        '<path d="M-54 66H54"/><path d="M-54 62V70"/><path d="M54 62V70"/>'
        '<path d="M-60 -14H-54"/><path d="M-60 -17V-11"/><path d="M-54 -17V-11"/>'
        '<path d="M-80 22H-60"/><path d="M-80 19V25"/><path d="M-60 19V25"/>'
        '</g>'
        '<g class="lbl" text-anchor="middle"><text x="0" y="76" class="t1">Ø 100 · trazo 8</text>'
        '<text x="-57" y="-21" class="t2">6</text><text x="-70" y="35" class="t2">8 × 20</text>'
        '<text x="86" y="-18" class="t2" text-anchor="start">45°</text></g>'
        '<path class="guide" fill="none" stroke-width=".7" d="M82 -14L75 -4"/></svg>')

# --- espacio libre ---
x0, x1 = A_l - 54, A_r + 54
clear = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s %s %s %s" class="anat" role="img" aria-label="Espacio libre">'
         '<rect x="%s" y="-108" width="%s" height="216" class="clear"/>'
         '<rect x="%s" y="-54" width="%s" height="108" class="box"/>' % (f(x0 - 6), -114, f(x1 - x0 + 12), 228, f(x0), f(x1 - x0), f(A_l), f(A_r - A_l))
         + mark_path +
         '<g class="dim" fill="none" stroke-width="1"><path d="M%s 0H%s"/><path d="M%s -5V5"/><path d="M%s -5V5"/></g>' % (f(x0), f(A_l), f(x0), f(A_l))
         + '<text x="%s" y="-8" class="t1" text-anchor="middle">x</text></svg>' % f((x0 + A_l) / 2))

# --- tamaños mínimos ---
mins = ''.join('<div class="stack"><div class="tile light" style="padding:18px">%s</div><div class="cap">%s</div></div>' % (inline(n, '', 'Relevo', w), c)
               for n, w, c in [('relevo-mark-black', 80, 'A · desde 80 px de ancho'),
                               ('relevo-mark-small-black', 40, 'G · de 40 a 79 px'),
                               ('relevo-icon-black', 32, 'Icono · desde 16 px')])
mins += '<div class="stack"><div class="tile light" style="padding:18px">%s</div><div class="cap">Icono a 16 px (favicon)</div></div>' % inline('relevo-icon-black', '', 'Relevo', 16)

files = [
    ('svg/relevo-mark-{black,white}.svg', 'Logo maestro (A). Desde 80 px de ancho.'),
    ('svg/relevo-mark-small-{black,white}.svg', 'Corte para tamaños pequeños (G). De 40 a 79 px.'),
    ('svg/relevo-lockup-horizontal-{black,white}.svg', 'Logo con el nombre a la derecha. Encabezados y barras.'),
    ('svg/relevo-lockup-vertical-{black,white}.svg', 'Logo con el nombre debajo. Portadas y carteles.'),
    ('svg/relevo-icon-{black,white}.svg', 'Icono con esquinas redondeadas. Iconos de app y tarjetas.'),
    ('svg/relevo-avatar-{black,white}.svg', 'Cuadrado completo, sin esquinas. Avatares: la plataforma lo recorta.'),
    ('svg/favicon.svg', 'Favicon que se adapta al tema claro y oscuro.'),
    ('favicon.ico', '16, 32 y 48 px, para navegadores antiguos.'),
    ('png/relevo-avatar-1024.png · 512.png', 'Avatar de GitHub y redes.'),
    ('png/apple-touch-icon-180.png', 'Icono de pantalla de inicio en iOS.'),
    ('png/relevo-icon-{black,white}-512.png', 'Icono con transparencia en las esquinas.'),
    ('png/favicon-{16,32,48}.png', 'Favicon en PNG.'),
    ('png/relevo-lockup-…, relevo-mark-…', 'Versiones PNG con transparencia del logo y los lockups.'),
    ('png/relevo-social-preview-1280x640.png', 'Vista previa social del repositorio en GitHub.'),
    ('states/relevo-state-<estado>-{black,white}.svg', 'Una ilustración por comando del flujo: init, feature (que no es un comando, sino el motivo del flujo), think, issue, go, review, fix y ship. Son las del README.'),
    ('animation/relevo-logo-animated-{black,white}.svg', 'Logo animado de 4,6 s, sin texto, que se queda en ship, se desvanece y vuelve a empezar. SMIL: se ve en GitHub y navegadores.'),
    ('animation/relevo-logo-animated.gif', 'La misma animación en GIF, con fondo blanco, para donde no se admite SVG animado.'),
    ('source/', 'Los scripts y la fuente para regenerar todo. Instrucciones en source/README.md.'),
]
files_html = ''.join('<tr><td><code>%s</code></td><td>%s</td></tr>' % (a, b) for a, b in files)

import base64
b = base64.b64encode(open(OUT + '/animation/relevo-logo-animated-black.svg','rb').read()).decode()
w = base64.b64encode(open(OUT + '/animation/relevo-logo-animated-white.svg','rb').read()).decode()
html = '''<title>Marca Relevo</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  /* Concepto: una hoja de uso sobrias. Tinta pura sobre papel, como el logo; el único adorno es el propio símbolo. */
  :root { --bg:#ffffff; --ink:#0b0b0b; --muted:#6d6d6a; --line:#e6e6e3; --soft:#f5f5f3; --font:'Nunito',system-ui,-apple-system,'Segoe UI',sans-serif; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#0d0d0d; --ink:#f3f3f0; --muted:#9b9b96; --line:#262625; --soft:#161615; color-scheme: dark; } }
  :root[data-theme="dark"] { --bg:#0d0d0d; --ink:#f3f3f0; --muted:#9b9b96; --line:#262625; --soft:#161615; color-scheme: dark; }
  * { box-sizing: border-box; }
  html { background: var(--bg); }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:var(--font); font-size:17px; line-height:1.55;
    padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); padding-block:40px 80px; }
  main { max-width:980px; margin:0 auto; display:grid; gap:56px; }
  h1 { margin:0; font-size:clamp(34px,6vw,56px); line-height:1.05; font-weight:700; text-wrap:balance; }
  h2 { margin:0 0 6px; font-size:clamp(22px,3.4vw,28px); line-height:1.2; font-weight:700; text-wrap:balance; }
  .eyebrow { margin:0 0 10px; font-size:13px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); font-weight:700; }
  p { margin:0; } .lead { color:var(--muted); max-width:62ch; } code { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:.86em; }
  section { display:grid; gap:20px; }
  svg { overflow:visible; }
  .ink { fill:var(--c, var(--ink)); } .paper { fill:var(--p, var(--bg)); }
  .hero { display:grid; gap:28px; }
  .hero svg { width:min(100%, 520px); height:auto; }
  .split { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr)); gap:24px; align-items:center; }
  .anat { width:100%; height:auto; max-width:560px; }
  .anat .note { stroke:var(--muted); } .anat .guide { stroke:var(--muted); } .anat .dim { stroke:var(--muted); }
  .anat .t1 { font-size:8.5px; font-weight:700; fill:var(--ink); font-family:var(--font); }
  .anat .t2 { font-size:6.4px; fill:var(--muted); font-family:var(--font); }
  .clear { fill:none; stroke:var(--muted); stroke-dasharray:3 3; } .box { fill:none; stroke:var(--line); }
  ul.plain { margin:0; padding-left:20px; display:grid; gap:6px; } ul.plain li::marker { color:var(--muted); }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr)); gap:16px; }
  .card { border:1px solid var(--line); border-radius:20px; padding:18px; display:grid; gap:14px; align-content:start; min-width:0; }
  .tiles { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .tile { --c:#0b0b0b; --p:#ffffff; background:var(--p); border-radius:14px; display:grid; place-items:center; padding:22px 12px; min-height:112px; border:1px solid var(--line); }
  .tile.dark { --c:#f3f3f0; --p:#0d0d0d; }
  .tile svg { max-width:100%; height:auto; display:block; }
  .card.wide .tiles { grid-template-columns:1fr; }
  .card h3 { margin:0; font-size:17px; font-weight:700; } .card p { color:var(--muted); font-size:15px; }
  .tag { font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); font-weight:700; }
  .row { display:flex; flex-wrap:wrap; gap:20px; align-items:flex-end; } .stack { display:grid; gap:8px; justify-items:center; } .cap { font-size:13px; color:var(--muted); text-align:center; }
  .sw { display:flex; flex-wrap:wrap; gap:14px; }
  .swatch { width:220px; max-width:100%; border-radius:16px; border:1px solid var(--line); overflow:hidden; font-size:14px; }
  .swatch div { padding:24px 16px; font-weight:700; } .swatch p { padding:10px 16px; color:var(--muted); border-top:1px solid var(--line); }
  .type { display:grid; gap:6px; } .type .big { font-size:clamp(44px,9vw,84px); font-weight:600; line-height:1; letter-spacing:-.01em; }
  .donts { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr)); gap:16px; }
  .dont { margin:0; display:grid; gap:8px; } .dont figcaption { font-size:14px; color:var(--muted); }
  .dbox { --c:#0b0b0b; --p:#fff; position:relative; background:var(--p); border:1px solid var(--line); border-radius:14px; padding:10px; }
  .dbox .fig { width:100%; height:auto; display:block; } .dbox .shadow { filter:drop-shadow(5px 6px 0 rgba(0,0,0,.35)); }
  .x { position:absolute; right:8px; top:6px; width:22px; height:22px; border-radius:50%; background:#d92d20; color:#fff; font-size:12px; display:grid; place-items:center; font-weight:700; }
  table { border-collapse:collapse; width:100%; font-size:15px; } td { padding:10px 12px 10px 0; border-top:1px solid var(--line); vertical-align:top; } td:first-child { white-space:nowrap; }
  .scroll { overflow-x:auto; }
  .btn { font:inherit; font-weight:700; min-height:44px; padding:0 20px; border-radius:999px; border:1px solid var(--ink); background:var(--ink); color:var(--bg); cursor:pointer; }
  .btn:focus-visible { outline:2px solid var(--ink); outline-offset:3px; }
  pre.code { margin:0; padding:16px 18px; border:1px solid var(--line); border-radius:14px; background:var(--soft); overflow-x:auto; font-size:14px; line-height:1.5; }
  .anim .tile img { max-width:100%; height:auto; }
  .ok { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr)); gap:16px; }
</style>

<main>
  <header class="hero">
    <div style="display:grid;gap:12px"><p class="eyebrow">Relevo · guía de uso</p><h1>La issue entra, la feature sale</h1><p class="lead" style="font-size:21px">En medio, agentes de IA hacen el trabajo, de forma automática y casi sin intervención humana.</p></div>
    <div class="tile" style="max-width:640px;padding:48px 24px">@@hero@@</div>
    <p class="lead">Este es el logo final, el último estado de la animación. Una issue entró por la izquierda, agentes de IA hicieron el trabajo dentro del círculo y la feature salió por la derecha. Esta hoja explica cómo usarlo sin que deje de ser el mismo.</p>
  </header>

  <section>
    <div><p class="eyebrow">Qué significa</p><h2>Tres piezas, una historia</h2></div>
    <div class="split">
      @@anat@@
      <ul class="plain">
        <li><b>El círculo</b> es la feature. Lo vacío es el espacio donde trabajan los agentes de IA, de forma automática.</li>
        <li><b>La rayita</b> es la issue: entra por la izquierda, siempre antes.</li>
        <li><b>La punta</b> es <code>ship</code>: la feature ya salió, se entrega. Siempre a la derecha, siempre fuera del círculo.</li>
        <li>El negro aparece solo cuando una persona toma el testigo, para pensar y para revisar. Por eso el logo final está vacío: el trabajo lo hicieron los agentes.</li>
      </ul>
    </div>
  </section>

  <section>
    <div><p class="eyebrow">Construcción</p><h2>Todo sale de una sola medida</h2></div>
    <div class="split">
      @@cons@@
      <ul class="plain">
        <li>Círculo de <b>Ø 100</b> y trazo de <b>8</b>, centrado en el contorno.</li>
        <li>La rayita y cada brazo de la punta miden lo mismo: <b>8 × 20</b>, con extremos redondeados.</li>
        <li>La separación entre el círculo y la rayita, y entre el círculo y la punta, es la misma: <b>6</b>.</li>
        <li>Los brazos de la punta forman <b>45°</b> con el eje y quedan a la misma altura que el centro.</li>
        <li>Esta repetición es lo que mantiene la marca ordenada. Cambiar una medida es cambiar el logo.</li>
      </ul>
    </div>
  </section>

  <section>
    <div><p class="eyebrow">Versiones</p><h2>Una marca, tres usos</h2></div>
    <p class="lead">Son el mismo logo. Solo cambian el grosor del trazo y el fondo, para que se vea igual de bien a cada tamaño. No hay que mezclar versiones en una misma pantalla al mismo tamaño.</p>
    <div class="cards">
      <div class="card"><span class="tag">A · Maestro</span><div class="tiles"><div class="tile light">@@a@@</div><div class="tile dark">@@a@@</div></div>
        <h3>Logo principal</h3><p>Desde 80 px de ancho. README, web, presentaciones, portadas. Trazo 8.</p></div>
      <div class="card"><span class="tag">G · Pequeño</span><div class="tiles"><div class="tile light">@@g@@</div><div class="tile dark">@@g@@</div></div>
        <h3>Corte óptico</h3><p>De 40 a 79 px de ancho. Trazo 12 y detalles un poco más gruesos para que no se pierdan. Mismas proporciones.</p></div>
      <div class="card"><span class="tag">Icono</span><div class="tiles"><div class="tile light">@@i@@</div><div class="tile dark">@@i@@</div></div>
        <h3>Avatar, favicon, icono de app</h3><p>Desde 16 px. El mismo logo en blanco sobre un cuadrado negro (o al revés). El cuadrado es solo el contenedor, nunca parte del logo.</p></div>
      <div class="card wide"><span class="tag">Con nombre · horizontal</span><div class="tiles"><div class="tile light">@@lh@@</div><div class="tile dark">@@lh@@</div></div>
        <h3>Encabezados y barras</h3><p>El nombre va en Nunito SemiBold, en minúsculas, a la derecha. El centro del círculo queda a la altura del centro de las letras.</p></div>
      <div class="card wide"><span class="tag">Con nombre · vertical</span><div class="tiles"><div class="tile light">@@lv@@</div><div class="tile dark">@@lv@@</div></div>
        <h3>Portadas y carteles</h3><p>El nombre debajo, centrado. Úsalo cuando haya más alto que ancho.</p></div>
    </div>
  </section>

  <section>
    <div><p class="eyebrow">Animación</p><h2>Cuatro segundos y medio, y se queda en ship</h2></div>
    <p class="lead">Es la versión corta del logo animado, sin texto: el círculo nace, los agentes de IA trabajan, la issue entra y la feature sale. Se queda unos segundos en el logo final, se desvanece y vuelve a empezar (un ciclo dura unos 13 s). Es un bucle a propósito: un SVG no sabe cuándo está a la vista. Para el README y la web.</p>
    <div class="tiles anim" style="max-width:640px">
      <div class="tile light"><img id="an-b" alt="relevo, logo animado" width="260" height="260" src="data:image/svg+xml;base64,@@b64b@@" data-b64="@@b64b@@"></div>
      <div class="tile dark"><img id="an-w" alt="relevo, logo animado" width="260" height="260" src="data:image/svg+xml;base64,@@b64w@@" data-b64="@@b64w@@"></div>
    </div>
    <div><button id="replay" type="button" class="btn">Ver otra vez</button></div>
    <p class="lead">En un README de GitHub, con versión para tema oscuro:</p>
    <pre class="code"><code>&lt;picture&gt;
  &lt;source media="(prefers-color-scheme: dark)" srcset="docs/brand/animation/relevo-logo-animated-white.svg"&gt;
  &lt;img alt="relevo" src="docs/brand/animation/relevo-logo-animated-black.svg" width="240"&gt;
&lt;/picture&gt;</code></pre>
    <p class="lead">Donde no se admite un SVG animado (algunos chats y correos) está el mismo recorrido en GIF, con fondo blanco. Quien abre el SVG en un visor sin animaciones ve directamente el logo final.</p>
  </section>

  <script>
  (function () {
    var n = 0;
    function restart() {
      n++;
      ['an-b', 'an-w'].forEach(function (id) {
        var img = document.getElementById(id);
        var svg = atob(img.getAttribute('data-b64'));
        img.src = 'data:image/svg+xml;base64,' + btoa(svg + '<!--' + n + '-->');   // contenido distinto: la animación vuelve a empezar
      });
    }
    var b = document.getElementById('replay');
    if (b) b.addEventListener('click', restart);
    var box = document.querySelector('.anim');
    if (box && 'IntersectionObserver' in window) {
      var seen = false;
      new IntersectionObserver(function (es) {
        if (!seen && es[0].isIntersecting) { seen = true; restart(); }   // arranca cuando se ve, no antes
      }, { threshold: 0.6 }).observe(box);
    }
  })();
  </script>

  <section>
    <div><p class="eyebrow">Tamaños mínimos</p><h2>Por debajo de 40 px, el icono</h2></div>
    <div class="row">@@mins@@</div>
    <p class="lead">Si el logo tendría que mostrarse a menos de 40 px de ancho, no lo reduzcas: usa el icono. A 16 px el icono se ve como un bloque con un círculo claro, que es suficiente para reconocerlo.</p>
  </section>

  <section>
    <div><p class="eyebrow">Espacio libre</p><h2>Medio círculo de aire alrededor</h2></div>
    <div class="split">
      @@clear@@
      <ul class="plain">
        <li>Deja como mínimo <b>x</b> de espacio libre en todos los lados, donde <b>x = la mitad del diámetro del círculo</b> (54 unidades en el maestro).</li>
        <li>Nada de texto, bordes ni imágenes dentro de ese margen.</li>
        <li>Con el nombre, el margen se mide desde el borde del conjunto completo.</li>
      </ul>
    </div>
  </section>

  <section>
    <div><p class="eyebrow">Color y tipografía</p><h2>Un solo color, una sola letra</h2></div>
    <div class="sw">
      <div class="swatch"><div style="background:#000;color:#fff">Tinta · #000000</div><p>Sobre papel claro.</p></div>
      <div class="swatch"><div style="background:#fff;color:#000">Papel · #FFFFFF</div><p>Sobre fondo oscuro o sobre la tinta.</p></div>
    </div>
    <p class="lead">El logo es siempre de un solo color: tinta sobre papel, o papel sobre tinta. Sobre fotos o fondos de color, usa el que dé más contraste.</p>
    <div class="type"><span class="tag">Nombre</span><span class="big">relevo</span>
      <p class="lead">El nombre del logo es Nunito SemiBold, en minúsculas: con ese peso las letras y el símbolo se sienten dibujados con el mismo trazo. En las animaciones y la documentación, el texto de interfaz va en negrita: los comandos como <code>/relevo:</code> en gris y la palabra del comando en negrita, y lo que no es comando (<b>feature</b>, <b>relevo</b>) solo en negrita, sin prefijo.</p></div>
  </section>

  <section>
    <div><p class="eyebrow">Qué no hacer</p><h2>Ocho maneras de dejar de ser Relevo</h2></div>
    <div class="donts">@@dont@@</div>
  </section>

  <section>
    <div><p class="eyebrow">Archivos</p><h2>Qué hay en la carpeta</h2></div>
    <div class="scroll"><table><tbody>@@files@@</tbody></table></div>
    <p class="lead">Todos los SVG tienen los trazos convertidos en formas y el texto en curvas, así que se ven igual aunque no esté instalada Nunito.</p>
  </section>
</main>
'''
vals = dict(hero=inline('relevo-mark-black', '', 'Relevo', None).replace('<svg ', '<svg style="width:min(100%,460px);height:auto" '),
           anat=anat, cons=cons, clear=clear,
           a=inline('relevo-mark-black', '', 'Relevo', 150), g=inline('relevo-mark-small-black', '', 'Relevo', 120),
           i=inline('relevo-icon-black', '', 'Relevo', 80),
           lh=inline('relevo-lockup-horizontal-black', '', 'Relevo', 230), lv=inline('relevo-lockup-vertical-black', '', 'Relevo', 130),
           mins=mins, dont=dont_html, files=files_html, b64b=b, b64w=w)
for k, v in vals.items():
    html = html.replace('@@%s@@' % k, v)

open(OUT + '/guia-de-uso.html', 'w').write(html)
print('ok', len(html))
