// The automatic check of an interface preview. Implements the interface-preview specification: static checks of the
// file, the thresholds by kind of interface, the contrast arithmetic, and the turning of what a browser measured into
// items with a status that never overstates the result: pass, fail, not checked or approximate.

export const STATUSES = ['pass', 'fail', 'not checked', 'approximate'];
export const TARGET_BYTES = 16 * 1024;

/** The widths, target size and text scales for a kind of interface. A 40-dp button is a failure of `mobile`. */
export function thresholds(kind, { ios = false } = {}) {
  if (kind === 'mobile') return { kind, widths: [320, 360], minTarget: ios ? 44 : 48, unit: ios ? 'pt' : 'dp', textScales: [1.3, 2] };
  return { kind: 'web', widths: [360, 1024], minTarget: 24, unit: 'CSS px', textScales: [] };
}

const item = (id, status, detail, extra = {}) => ({ id, status, detail, ...extra });

/** Checks of the file itself, with no browser: an address outside the file, a script and the size. */
export function staticChecks(html, { maxBytes = TARGET_BYTES } = {}) {
  const text = String(html ?? '');
  // The header comment may mention anything; the markup is what counts.
  const markup = text.replace(/<!--[\s\S]*?-->/g, '');
  const items = [];
  const external = [...markup.matchAll(/(?:src|href|action|poster|data)\s*=\s*["']\s*((?:https?:)?\/\/[^"'\s]+)|url\(\s*["']?\s*((?:https?:)?\/\/[^)"'\s]+)|@import\s+(?:url\()?["']?\s*((?:https?:)?\/\/[^)"'\s;]+)/gi)]
    .map((m) => m[1] ?? m[2] ?? m[3]);
  items.push(external.length
    ? item('no-external-address', 'fail', `the file refers to an address outside it: ${[...new Set(external)].slice(0, 3).join(', ')}`)
    : item('no-external-address', 'pass', 'the file makes no request to another address'));
  const scripts = /<script\b/i.test(markup) || /\son[a-z]+\s*=\s*["']/i.test(markup) || /javascript:/i.test(markup);
  items.push(scripts ? item('no-script', 'fail', 'the file has a script (a script tag, an event attribute or a javascript: address)') : item('no-script', 'pass', 'the file has no script'));
  const bytes = Buffer.byteLength(text, 'utf8');
  items.push(bytes > maxBytes ? item('size', 'fail', `${bytes} bytes, over the target of ${maxBytes}`) : item('size', 'pass', `${bytes} bytes`));
  return items;
}

/** The custom properties the header comment lists as approximate: a line `approximate: --a, --b`. */
export function approximateProperties(html) {
  const header = /<!--([\s\S]*?)-->/.exec(String(html ?? ''))?.[1] ?? '';
  const line = /^\s*approximate\s*:\s*(.+)$/im.exec(header)?.[1] ?? '';
  return line.split(',').map((s) => s.trim()).filter((s) => /^--[\w-]+$/.test(s));
}

/** True when the header comment says that this is a proposal (and, for a mobile sketch, an approximate one). */
export function headerChecks(html, kind) {
  const header = /<!--([\s\S]*?)-->/.exec(String(html ?? ''))?.[1] ?? '';
  const items = [item('header-comment', /proposal/i.test(header) ? 'pass' : 'fail', /proposal/i.test(header) ? 'the header says it is a proposal' : 'the file does not start with a comment that says it is a proposal')];
  if (kind === 'mobile') {
    const labelled = /approximate sketch/i.test(header) && /approximate sketch/i.test(String(html).replace(/<!--[\s\S]*?-->/g, ''));
    items.push(item('mobile-label', labelled ? 'pass' : 'fail', labelled ? 'the page and the header say it is an approximate sketch' : 'a mobile sketch must say "approximate sketch, not a render of the app" on the page and in the header comment'));
  }
  return items;
}

// ------------------------------------------------------------------ colour

/** [r, g, b, a] (0 to 255, alpha 0 to 1) from a CSS colour the browser reports (rgb/rgba) or a hex string, or null. */
export function parseColour(value) {
  const v = String(value ?? '').trim().toLowerCase();
  let m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(v);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
    return [Number(m[1]), Number(m[2]), Number(m[3]), a];
  }
  m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  if (h.length !== 6 && h.length !== 8) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1];
}

const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

/** The WCAG contrast ratio of two opaque colours. */
export function contrastRatio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Large text is 24 CSS px, or 18.66 px when bold. */
export const isLargeText = (sizePx, bold) => sizePx >= 24 || (bold && sizePx >= 18.66);

// ------------------------------------------------------------------ measurements to items

/**
 * measure: what the browser reported for one theme and width:
 *   { width, scrollWidth, targets: [{ name, w, h }], texts: [{ name, color, background, size, bold, unknownBackground, approximate }] }
 * Returns the items for overflow, target size and contrast.
 */
export function evaluate(measure, t, { theme = 'light', scale = 1 } = {}) {
  const items = [];
  const where = `${measure.width}px${theme === 'dark' ? ', dark' : ''}${scale !== 1 ? `, text at ${Math.round(scale * 100)}%` : ''}`;
  const over = measure.scrollWidth - measure.width;
  items.push(over > 1 ? item(`overflow@${measure.width}${scale !== 1 ? `/text${Math.round(scale * 100)}` : ''}${theme === 'dark' ? '/dark' : ''}`, 'fail', `the page is ${over}px wider than the ${measure.width}px viewport (${where})`)
    : item(`overflow@${measure.width}${scale !== 1 ? `/text${Math.round(scale * 100)}` : ''}${theme === 'dark' ? '/dark' : ''}`, 'pass', `no horizontal overflow (${where})`));
  if (scale !== 1) return items;

  // The targets do not depend on the colours: they are measured in the light theme only.
  if (theme === 'dark') return contrastItems(items, measure, t, where, theme);
  const small = measure.targets.filter((x) => x.w < t.minTarget || x.h < t.minTarget);
  const targetId = `target-size@${measure.width}`;
  if (small.length) small.slice(0, 5).forEach((x) => items.push(item(targetId, 'fail', `${x.name} is ${Math.round(x.w)} by ${Math.round(x.h)} ${t.unit}, under ${t.minTarget}`, { element: x.name })));
  else items.push(item(targetId, 'pass', `${measure.targets.length} interactive target(s), none under ${t.minTarget} ${t.unit}`));

  return contrastItems(items, measure, t, where, theme);
}

function contrastItems(items, measure, t, where, theme) {
  const contrastId = `contrast@${measure.width}${theme === 'dark' ? '/dark' : ''}`;
  const failures = [];
  let unchecked = 0;
  let approximate = 0;
  let checked = 0;
  measure.texts.forEach((x) => {
    const fg = parseColour(x.color);
    const bg = parseColour(x.background);
    if (x.unknownBackground || !fg || !bg || bg[3] < 1 || fg[3] < 1) { unchecked += 1; return; }
    const need = isLargeText(x.size, x.bold) ? 3 : 4.5;
    const ratio = contrastRatio(fg, bg);
    checked += 1;
    if (ratio < need) failures.push(item(contrastId, 'fail', `${x.name}: contrast ${ratio.toFixed(2)}:1, needs ${need}:1 (${where})`, { element: x.name }));
    else if (x.approximate) approximate += 1;
  });
  failures.slice(0, 8).forEach((f) => items.push(f));
  if (!failures.length) {
    if (approximate) items.push(item(contrastId, 'approximate', `${approximate} of ${checked} text(s) use a value that came from an approximation, so the ratio is not exact`));
    else if (checked) items.push(item(contrastId, 'pass', `${checked} text(s) against a solid background, all enough`));
  }
  if (unchecked) items.push(item(`${contrastId}/unchecked`, 'not checked', `${unchecked} text(s) sit over an image, a gradient or a partly transparent colour, so their contrast was not checked`));
  return items;
}

/** The worst status of a list: fail, then not checked, then approximate, then pass. */
export function overall(items) {
  for (const s of ['fail', 'not checked', 'approximate']) if (items.some((i) => i.status === s)) return s;
  return 'pass';
}

export function renderItems(items) {
  return items.map((i) => `${i.status.toUpperCase().padEnd(11)} ${i.id}: ${i.detail}`).join('\n');
}
