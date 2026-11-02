#!/usr/bin/env node
// Checks an interface preview (a self-contained HTML file) before a person sees it. Usage:
//   node scripts/preview-check.mjs <file> --kind <web|mobile> [--ios] [--root dir] [--json]
// Static checks of the file, then a headless browser from the project (or the machine) opens it with scripts and network
// disabled, at the widths of the kind of interface, light and dark, and reports each item as pass, fail, not checked or
// approximate. A mobile sketch gets a second pass with the text at 130% and 200%. It writes nothing to the repository,
// runs no code of the project (only the browser library is loaded) and sends nothing out of the machine.
//   exit 0: no item failed   exit 1: an item failed   exit 2: bad usage   exit 3: no browser automation, nothing was checked
// RELEVO_PREVIEW_BROWSER=none behaves as if no library exists (used by the tests).

import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { approximateProperties, evaluate, headerChecks, overall, renderItems, staticChecks, thresholds } from './lib/preview-check.mjs';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => { const i = argv.indexOf(`--${n}`); return i === -1 ? undefined : argv[i + 1]; };
const fail = (m, code = 2) => { console.error(m); process.exit(code); };

const file = argv.find((a, i) => !a.startsWith('--') && !['--kind', '--root'].includes(argv[i - 1]));
const kind = opt('kind');
if (!file || !['web', 'mobile'].includes(kind)) fail('usage: preview-check.mjs <file> --kind <web|mobile> [--ios] [--root dir] [--json]');
if (!existsSync(file)) fail(`no such file: ${file}`);
const html = readFileSync(file, 'utf8');
const t = thresholds(kind, { ios: flag('ios') });

const items = [...staticChecks(html), ...headerChecks(html, kind)];

// The browser library: the project's first, then the machine's. Only the library is loaded, never a file of the project.
function findPlaywright() {
  if (process.env.RELEVO_PREVIEW_BROWSER === 'none') return null;
  const roots = [resolve(opt('root') ?? process.cwd(), 'package.json'), import.meta.url];
  for (const from of roots) {
    try {
      const req = createRequire(from);
      return req(req.resolve('playwright'));
    } catch { /* try the next place */ }
  }
  return null;
}
const playwright = findPlaywright();
if (!playwright) {
  const out = { checked: false, reason: 'no browser automation library was found (playwright), so no automatic check of the page ran', items };
  console.log(flag('json') ? JSON.stringify(out, null, 2) : `NOT CHECKED: ${out.reason}.\nThe file checks that need no browser:\n${renderItems(items)}`);
  process.exit(3);
}

const approx = approximateProperties(html);
// The page is loaded from text with a policy that blocks scripts and every request; the browser is offline as well.
const page_html = html.replace(/<head[^>]*>/i, (m) => `${m}<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:">`)
  .replace(/^(?!.*<head)/i, '');

const measureInPage = ({ scale, approximateNames }) => {
  const q = [...document.querySelectorAll('*')];
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/)[0]}` : ''}${el.textContent && el.textContent.trim() ? ` "${el.textContent.trim().slice(0, 24)}"` : ''}`;
  if (scale !== 1) q.forEach((el) => { if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * scale}px`; });
  const usesApprox = (el, prop) => {
    if (el.style.cssText.includes('var(--')) { if (approximateNames.some((n) => el.style.cssText.includes(`var(${n})`))) return true; }
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        if (rule.style && rule.selectorText) {
          try {
            if (el.matches(rule.selectorText) && approximateNames.some((n) => rule.style.getPropertyValue(prop).includes(`var(${n})`))) return true;
          } catch { /* a selector the browser cannot match */ }
        }
      }
    }
    return false;
  };
  const backgroundOf = (el) => {
    let unknown = false;
    for (let node = el; node; node = node.parentElement) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') unknown = true;
      const bg = cs.backgroundColor;
      const alpha = /rgba?\(([^)]*)\)/.exec(bg)?.[1].split(/[,/]/)[3];
      if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return { color: bg, unknown: unknown || (alpha !== undefined && Number(alpha) < 1) };
    }
    return { color: 'rgb(255, 255, 255)', unknown };
  };
  const targets = q.filter((el) => el.matches('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [tabindex]:not([tabindex="-1"])')).map((el) => {
    const r = el.getBoundingClientRect();
    return { name: name(el), w: r.width, h: r.height };
  });
  const texts = q.filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && el.getBoundingClientRect().width > 0).map((el) => {
    const cs = getComputedStyle(el);
    const bg = backgroundOf(el);
    const hasImage = [...el.querySelectorAll('img')].length > 0 || el.closest('picture, figure');
    return {
      name: name(el), color: cs.color, background: bg.color, size: parseFloat(cs.fontSize), bold: Number(cs.fontWeight) >= 700,
      unknownBackground: bg.unknown || Boolean(hasImage), approximate: usesApprox(el, 'color') || usesApprox(el, 'background-color') || usesApprox(el, 'background'),
    };
  });
  return { scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), targets, texts };
};

let browser;
try {
  browser = await playwright.chromium.launch();
} catch (err) {
  const out = { checked: false, reason: `the browser could not be started (${String(err.message).split('\n')[0]}), so no automatic check of the page ran`, items };
  console.log(flag('json') ? JSON.stringify(out, null, 2) : `NOT CHECKED: ${out.reason}.`);
  process.exit(3);
}
try {
  for (const theme of ['light', 'dark']) {
    for (const width of t.widths) {
      const context = await browser.newContext({ viewport: { width, height: 800 }, offline: true, javaScriptEnabled: true, colorScheme: theme });
      await context.route('**/*', (route) => route.abort());
      const page = await context.newPage();
      await page.setContent(page_html, { waitUntil: 'load' });
      const scales = theme === 'light' ? [1, ...t.textScales] : [1];
      for (const scale of scales) {
        const fresh = scale === 1 ? page : await context.newPage();
        if (scale !== 1) await fresh.setContent(page_html, { waitUntil: 'load' });
        const m = await fresh.evaluate(measureInPage, { scale, approximateNames: approx });
        items.push(...evaluate({ width, ...m }, t, { theme, scale }));
        if (scale !== 1) await fresh.close();
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const result = overall(items);
if (flag('json')) console.log(JSON.stringify({ checked: true, kind, overall: result, items }, null, 2));
else console.log(`${renderItems(items)}\n\nOverall: ${result}${kind === 'mobile' ? '\nThis is an approximate sketch, not a render of the app.' : ''}`);
process.exit(items.some((i) => i.status === 'fail') ? 1 : 0);
