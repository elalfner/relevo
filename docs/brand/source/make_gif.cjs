// GIF del logo animado corto (fondo blanco). Necesita ImageMagick (comando `convert`).
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = process.env.RELEVO_OUT || path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'relevo-gif-'));
const N = 138;   // 30 fps durante 4.6 s

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 480, height: 480 } });
  await page.goto('file://' + path.join(ROOT, 'animation/relevo-logo-animated-black.svg'));
  await page.waitForTimeout(300);
  for (let k = 0; k <= N; k++) {
    await page.evaluate((t) => { const s = document.documentElement; s.pauseAnimations(); s.setCurrentTime(t); }, k / 30);
    await page.screenshot({ path: path.join(TMP, 'f' + String(k).padStart(3, '0') + '.png') });
  }
  await browser.close();
  const frames = fs.readdirSync(TMP).filter(f => f.endsWith('.png')).sort().map(f => path.join(TMP, f));
  const last = frames.pop();
  execFileSync('convert', ['-loop', '0', '-delay', '3', ...frames, '-delay', '600', last, '-colors', '24', '-layers', 'Optimize',
    path.join(ROOT, 'animation/relevo-logo-animated.gif')]);
  console.log('gif listo');
})();
