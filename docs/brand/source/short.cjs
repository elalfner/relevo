// Versión corta del logo animado: ~4.6 s, sin etiquetas, termina en ship y se queda ahí.
// SVG autocontenido con animaciones SMIL muestreadas a 30 fps desde las mismas fórmulas de la animación larga.
const fs = require('fs');
const path = require('path');
const OUT = path.join(process.env.RELEVO_OUT || path.join(__dirname, '..'), 'animation') + '/';
fs.mkdirSync(OUT, { recursive: true });

const RAD = Math.PI / 180, S2 = Math.SQRT1_2, TX = 6 * S2, OFF = -(64 + TX), CHEV_OUT = 64 + TX;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, s, d) => clamp((t - s) / d);
const eIOC = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const eOC = p => 1 - Math.pow(1 - p, 3);
const eIOS = p => -(Math.cos(Math.PI * p) - 1) / 2;
const eOB = (p, c) => { const k = c + 1; return 1 + k * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
function bez(x1, y1, x2, y2) {
  const ax = t => 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t;
  const ay = t => 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t;
  return x => { if (x <= 0) return 0; if (x >= 1) return 1; let lo = 0, hi = 1, t = x; for (let i = 0; i < 28; i++) { t = (lo + hi) / 2; if (ax(t) < x) lo = t; else hi = t; } return ay(t); };
}
const eEnter = bez(0, 0, .2, 1), eExit = bez(.6, 0, .35, 1), eWipe = bez(.76, 0, .24, 1);
const DASH0 = 16 / (2 * Math.PI * 50 / 10) * 10;

const DUR = 4600, FPS = 30;
// Bucle: el logo se queda en ship HOLD s, se desvanece en FADE s, deja GAP s en blanco y vuelve a empezar.
// Así, quien llega al logo al hacer scroll lo ve moverse en pocos segundos (un SVG no sabe cuándo está a la vista).
const HOLD = 7.6, FADE = 0.4, GAP = 0.3;
const RESTART = (HOLD + FADE + GAP).toFixed(1) + 's';
const BEGIN = '0s;a0.end+' + RESTART;
let firstAnim = true;

// ---- estado de todos los elementos en el instante t (ms) ----
function state(t) {
  const s = {};
  const rg = 50 * eOB(prog(t, 80, 480), 1.2);
  s.ringR = rg >= 4 ? rg : 0;
  s.dotR = rg >= 4 ? 0 : rg + 4;
  const jn = eIOC(prog(t, 520, 380));
  const d = DASH0 + (10 - DASH0) * jn;
  s.dash = d.toFixed(3) + ' ' + Math.max(0, 10 - d).toFixed(3);
  s.fillR = 54 * eOC(prog(t, 900, 350)) * (1 - eIOC(prog(t, 1900, 400)));
  s.wipeR = t < 3700 ? 130 * eWipe(prog(t, 3000, 600)) : 0;
  s.slideR = t >= 3600 ? 54 : 0;                           // ya cubre el círculo cuando el frente termina: no hay salto al cambiar
  s.slideX = 112 * eExit(prog(t, 3700, 800));
  const th = 135 * eIOS(prog(t, 1000, 800));
  const out = prog(t, 1800, 450), dr = 10 * eOC(out), gone = eIOC(out);
  s.rays = [];
  for (let i = 0; i < 8; i++) {
    const g = prog(t, 950 + i * 25, 350);
    const len = 12 * eOB(g, 1.2);
    const a = (45 + 45 * i + th) * RAD, c = Math.cos(a), sn = Math.sin(a);
    const r1 = 64 + (i ? dr : 0);
    let op = clamp(g * 4); if (i) op *= 1 - gone;
    s.rays.push({ x1: r1 * c, y1: r1 * sn, x2: (r1 + len) * c, y2: (r1 + len) * sn, op });
  }
  const cx = t < 3700 ? OFF * (1 - eEnter(prog(t, 2250, 350))) : CHEV_OUT * eExit(prog(t, 3700, 800));
  const psi = 45 * eOB(prog(t, 2600, 350), 1.2) * RAD;
  const ux = TX - 12 * Math.cos(psi), uy = 12 * Math.sin(psi);
  s.cop = t >= 2250 ? 1 : 0;
  s.chev = { tx: cx + TX, ux: cx + ux, uy };
  return s;
}

// ---- muestreo ----
const N = Math.ceil(DUR * FPS / 1000);
const frames = []; for (let k = 0; k <= N; k++) frames.push(state(Math.min(DUR, k * 1000 / FPS)));
const final = state(DUR);
const secs = (N / FPS).toFixed(3) + 's';
const f2 = x => { const s = x.toFixed(2); return s === '-0.00' ? '0' : String(parseFloat(s)); };

// atributo animado: valor final como estático y <animate> con los valores por fotograma
function anim(attr, get, fmt = f2) {
  const vals = frames.map(get).map(fmt);
  const uniq = new Set(vals);
  const fin = fmt(get(final));
  const staticAttr = ` ${attr}="${fin}"`;
  if (uniq.size === 1) return { staticAttr, child: '' };
  const id = firstAnim ? ' id="a0"' : '';   // una animación lleva el id; todas se reinician a la vez cuando termina
  firstAnim = false;
  return { staticAttr, child: `<animate${id} attributeName="${attr}" dur="${secs}" begin="${BEGIN}" values="${vals.join(';')}" fill="freeze" calcMode="linear"/>` };
}
function el(tag, fixed, attrs, selfClose = false) {
  // attrs: [[nombre, getter, fmt?]]
  let st = fixed, ch = '';
  for (const [n, g, fmt] of attrs) { const a = anim(n, g, fmt); st += a.staticAttr; ch += a.child; }
  return ch ? `<${tag}${st}>${ch}</${tag}>` : `<${tag}${st}/>`;
}

function build(ink, paper) {
  firstAnim = true;
  const lines = (id, kind) => {
    const g = s => s.chev;
    const u = el('line', '', [['x1', s => g(s).tx], ['y1', () => 0], ['x2', s => g(s).ux], ['y2', s => -g(s).uy]]);
    const l = el('line', '', [['x1', s => g(s).tx], ['y1', () => 0], ['x2', s => g(s).ux], ['y2', s => g(s).uy]]);
    return u + l;
  };
  const rayEls = [0, 1, 2, 3, 4, 5, 6, 7].map(i => el('line', '', [
    ['x1', s => s.rays[i].x1], ['y1', s => s.rays[i].y1], ['x2', s => s.rays[i].x2], ['y2', s => s.rays[i].y2], ['opacity', s => s.rays[i].op]])).join('');
  const gBlack = '<g stroke="' + ink + '" stroke-width="8" stroke-linecap="round" opacity="' + f2(final.cop) + '">' +
    '<animate attributeName="opacity" dur="' + secs + '" begin="' + BEGIN + '" values="' + frames.map(s => f2(s.cop)).join(';') + '" fill="freeze" calcMode="linear"/>' + lines() + '</g>';
  const gWhite = '<g mask="url(#m)"><g stroke="' + paper + '" stroke-width="8" stroke-linecap="round" opacity="' + f2(final.cop) + '">' +
    '<animate attributeName="opacity" dur="' + secs + '" begin="' + BEGIN + '" values="' + frames.map(s => f2(s.cop)).join(';') + '" fill="freeze" calcMode="linear"/>' + lines() + '</g></g>';

  const ringAnim = el('circle', ` pathLength="100" transform="rotate(-99.2)" fill="none" stroke="${ink}" stroke-width="8" stroke-linecap="round"`, [
    ['r', s => s.ringR], ['stroke-dasharray', s => s.dash, x => x]]);
  const dot = el('circle', ` fill="${ink}"`, [['r', s => s.dotR]]);
  const mf = el('circle', ' fill="#fff"', [['r', s => s.fillR]]);
  const mw = el('circle', ' cx="-60" fill="url(#g)"', [['r', s => s.wipeR]]);
  const ms = el('circle', ' fill="#fff"', [['r', s => s.slideR], ['cx', s => s.slideX]]);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-88 -88 176 176" width="480" height="480" role="img" aria-label="relevo"><title>relevo</title>` +
    `<defs><radialGradient id="g"><stop offset=".86" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<clipPath id="c"><circle r="54.5"/></clipPath>` +
    `<mask id="m" maskUnits="userSpaceOnUse" x="-100" y="-100" width="200" height="200"><g clip-path="url(#c)">${mf}${mw}${ms}</g></mask></defs>` +
    `<g><animate attributeName="opacity" values="1;0" dur="${FADE}s" begin="a0.end+${HOLD}s" fill="freeze"/>` +
    `<set attributeName="opacity" to="1" begin="a0.end+${RESTART}"/>` +
    dot + ringAnim +
    `<g mask="url(#m)"><circle r="54" fill="${ink}"/></g>` +
    `<g stroke="${ink}" stroke-width="8" stroke-linecap="round">${rayEls}</g>` +
    gBlack + gWhite + `</g></svg>\n`;
}

fs.writeFileSync(OUT + 'relevo-logo-animated-black.svg', build('#000000', '#FFFFFF'));
fs.writeFileSync(OUT + 'relevo-logo-animated-white.svg', build('#FFFFFF', '#000000'));
console.log('frames', N + 1, 'dur', secs, 'bytes', fs.statSync(OUT + 'relevo-logo-animated-black.svg').size);
