// Exporta los PNG a partir de los SVG. Los que llevan transparencia se renderizan dos veces
// (sobre blanco y sobre negro) y matte_png.py recupera el canal alfa.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = process.env.RELEVO_OUT || path.join(__dirname, '..');
const TMP = process.env.RELEVO_TMP || fs.mkdtempSync(path.join(os.tmpdir(), 'relevo-'));
fs.mkdirSync(path.join(ROOT, 'png'), { recursive: true });

// [svg, ancho, alto|null, salida, ¿transparente?]
const jobs = [
  ['svg/relevo-avatar-black.svg', 1024, 1024, 'png/relevo-avatar-1024.png', false],
  ['svg/relevo-avatar-black.svg', 512, 512, 'png/relevo-avatar-512.png', false],
  ['svg/relevo-avatar-black.svg', 180, 180, 'png/apple-touch-icon-180.png', false],
  ['svg/relevo-icon-black.svg', 512, 512, 'png/relevo-icon-black-512.png', true],
  ['svg/relevo-icon-white.svg', 512, 512, 'png/relevo-icon-white-512.png', true],
  ['svg/relevo-icon-black.svg', 48, 48, 'png/favicon-48.png', true],
  ['svg/relevo-icon-black.svg', 32, 32, 'png/favicon-32.png', true],
  ['svg/relevo-icon-black.svg', 16, 16, 'png/favicon-16.png', true],
  ['svg/relevo-lockup-horizontal-black.svg', 1600, null, 'png/relevo-lockup-horizontal-black.png', true],
  ['svg/relevo-lockup-horizontal-white.svg', 1600, null, 'png/relevo-lockup-horizontal-white.png', true],
  ['svg/relevo-lockup-vertical-black.svg', 900, null, 'png/relevo-lockup-vertical-black.png', true],
  ['svg/relevo-lockup-vertical-white.svg', 900, null, 'png/relevo-lockup-vertical-white.png', true],
  ['svg/relevo-mark-black.svg', 1200, null, 'png/relevo-mark-black.png', true],
  ['svg/relevo-mark-white.svg', 1200, null, 'png/relevo-mark-white.png', true],
];

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const todo = [];
  for (const [src, w, h, out, transparent] of jobs) {
    const svg = fs.readFileSync(path.join(ROOT, src), 'utf8');
    const m = svg.match(/viewBox="[^ ]+ [^ ]+ ([^ ]+) ([^"]+)"/);
    const hh = h || Math.round(w * parseFloat(m[2]) / parseFloat(m[1]));
    const page = await browser.newPage({ viewport: { width: w, height: hh }, deviceScaleFactor: 1 });
    const shot = async (bg, file) => {
      const html = path.join(TMP, 'page.html');
      fs.writeFileSync(html, `<body style="margin:0;background:${bg}"><img src="file://${path.join(ROOT, src)}" style="width:${w}px;height:${hh}px;display:block"></body>`);
      await page.goto('file://' + html);
      await page.waitForTimeout(80);
      await page.screenshot({ path: file });
    };
    if (transparent) {
      const base = path.join(TMP, out.replace(/[\/.]/g, '_'));
      await shot('#fff', base + '-w.png');
      await shot('#000', base + '-b.png');
      todo.push([base, path.join(ROOT, out)]);
    } else {
      await shot('#fff', path.join(ROOT, out));
    }
    await page.close();
  }
  // vista previa social de GitHub: 1280 × 640 sobre blanco
  const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
  const html = path.join(TMP, 'page.html');
  fs.writeFileSync(html, `<body style="margin:0;background:#fff;display:grid;place-items:center;height:640px"><img src="file://${path.join(ROOT, 'svg/relevo-lockup-horizontal-black.svg')}" style="width:760px"></body>`);
  await page.goto('file://' + html);
  await page.waitForTimeout(80);
  await page.screenshot({ path: path.join(ROOT, 'png/relevo-social-preview-1280x640.png') });
  fs.writeFileSync(path.join(TMP, 'todo.json'), JSON.stringify(todo));
  await browser.close();
  console.log(TMP);
})();
