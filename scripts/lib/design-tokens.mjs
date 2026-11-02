// Reads the colours, text styles, spacing and radii of a design system from its code, with the file and line of each
// value. Implements the design-tokens specification. It is pure text reading: nothing is executed, there is no network,
// and what cannot be determined is listed as unresolved and never guessed. The same files give the same result.
//
// Entry: readTokens(files) with files = [{ path, text }]. Returns
//   { tokens: [{ name, value, kind, theme, set, file, line, derived?, via? }], unresolved: [{ name, file, line, reason }], sets }
// `kind` is colour, text, spacing or radius; `theme` is light or dark; `set` is the group the token belongs to when the
// files define more than one (several brands, for instance), and the sets are never merged.

// The shades of the standard Material palette, from a fixed table. A swatch that is not here is unresolved.
export const MATERIAL_SWATCHES = {
  red: { 50: 'FFEBEE', 100: 'FFCDD2', 200: 'EF9A9A', 300: 'E57373', 400: 'EF5350', 500: 'F44336', 600: 'E53935', 700: 'D32F2F', 800: 'C62828', 900: 'B71C1C' },
  blue: { 50: 'E3F2FD', 100: 'BBDEFB', 200: '90CAF9', 300: '64B5F6', 400: '42A5F5', 500: '2196F3', 600: '1E88E5', 700: '1976D2', 800: '1565C0', 900: '0D47A1' },
  green: { 50: 'E8F5E9', 100: 'C8E6C9', 200: 'A5D6A7', 300: '81C784', 400: '66BB6A', 500: '4CAF50', 600: '43A047', 700: '388E3C', 800: '2E7D32', 900: '1B5E20' },
  grey: { 50: 'FAFAFA', 100: 'F5F5F5', 200: 'EEEEEE', 300: 'E0E0E0', 400: 'BDBDBD', 500: '9E9E9E', 600: '757575', 700: '616161', 800: '424242', 900: '212121' },
  orange: { 50: 'FFF3E0', 100: 'FFE0B2', 200: 'FFCC80', 300: 'FFB74D', 400: 'FFA726', 500: 'FF9800', 600: 'FB8C00', 700: 'F57C00', 800: 'EF6C00', 900: 'E65100' },
};
const MATERIAL_PLAIN = { white: 'FFFFFF', black: '000000' };

const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const isDark = (s) => /dark/i.test(s);

/** '#RRGGBB' or '#RRGGBBAA' (CSS order), from an alpha-first ARGB number written in hex. */
function fromArgb(argb) {
  const h = argb.padStart(8, '0').toUpperCase();
  const a = h.slice(0, 2);
  return a === 'FF' ? `#${h.slice(2)}` : `#${h.slice(2)}${a}`;
}

// ------------------------------------------------------------------ Dart

const DART_COLOR_LITERAL = /Color\(\s*0x([0-9A-Fa-f]{1,8})\s*\)/;
const DART_FROM_ARGB = /Color\.fromARGB\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/;
const DART_FROM_RGBO = /Color\.fromRGBO\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/;
const DART_SHADE = /Colors\.(\w+)(?:\.shade(\d+)|\[(\d+)\])?(?![\w.(])/;
const DART_OPACITY = /^(.+?)\.(?:withOpacity\(\s*([\d.]+)\s*\)|withAlpha\(\s*(\d+)\s*\)|withValues\(\s*alpha:\s*([\d.]+)\s*\))\s*$/;
const DART_DEVICE = /(DynamicColorBuilder|ColorScheme\.fromImageProvider|CorePalette|PlatformDispatcher\.instance\.platformBrightness)/;

/** Resolves a Dart colour expression to { value, derived, via } or { reason }. `lookup` resolves a name. */
function dartColor(expr, lookup) {
  const e = expr.trim().replace(/\s+/g, ' ');
  let m = DART_COLOR_LITERAL.exec(e);
  if (m && e === m[0]) return { value: fromArgb(m[1]) };
  m = DART_FROM_ARGB.exec(e);
  if (m && e === m[0]) {
    const [a, r, g, b] = m.slice(1).map(Number);
    return { value: fromArgb(`${hex2(a)}${hex2(r)}${hex2(g)}${hex2(b)}`) };
  }
  m = DART_FROM_RGBO.exec(e);
  if (m && e === m[0]) {
    const [r, g, b] = m.slice(1, 4).map(Number);
    return { value: fromArgb(`${hex2(Number(m[4]) * 255)}${hex2(r)}${hex2(g)}${hex2(b)}`) };
  }
  m = DART_OPACITY.exec(e);
  if (m) {
    const base = dartColor(m[1], lookup);
    if (!base.value) return { reason: `the base colour of the opacity is not known (${base.reason})` };
    const alpha = m[2] !== undefined ? Number(m[2]) * 255 : m[3] !== undefined ? Number(m[3]) : Number(m[4]) * 255;
    return { value: `${base.value.slice(0, 7)}${hex2(alpha)}`, derived: `${base.via ?? e.split('.')[0]} with an opacity of ${m[2] ?? m[4] ?? `${m[3]}/255`}`, via: base.via };
  }
  m = DART_SHADE.exec(e);
  if (m && e === m[0]) {
    const swatch = m[1];
    const shade = m[2] ?? m[3];
    if (MATERIAL_PLAIN[swatch] && !shade) return { value: `#${MATERIAL_PLAIN[swatch]}` };
    if (swatch === 'transparent') return { value: '#00000000' };
    const table = MATERIAL_SWATCHES[swatch];
    if (!table) return { reason: `the swatch Colors.${swatch} is not in the fixed table of palette shades` };
    const key = shade ?? '500';
    return table[key] ? { value: `#${table[key]}` } : { reason: `the shade ${key} of Colors.${swatch} is not in the fixed table` };
  }
  if (/^[A-Za-z_]\w*(\.\w+)*$/.test(e)) {
    const found = lookup(e);
    if (found?.value) return { value: found.value, via: e, derived: found.derived };
    return { reason: found ? `the reference ${e} is itself unresolved (${found.reason})` : `the reference ${e} could not be followed to a definition in the declared files` };
  }
  if (DART_DEVICE.test(e)) return { reason: 'the colour comes from the device' };
  return { reason: 'the expression is not a colour literal, a palette shade or a reference the reader can follow' };
}

function dartTokens(file, text, found, lookup, context) {
  const lines = text.split('\n');
  let klass = null;
  let depth = 0;
  let klassDepth = -1;
  const classRe = /^\s*(?:abstract\s+|final\s+)*class\s+(\w+)(?:\s+extends\s+([\w<>]+))?/;
  const decl = /^\s*(?:static\s+)?(?:const|final)\s+(?:(Color|double|int|TextStyle|[A-Z]\w*)\s+)?(\w+)\s*=\s*(.*)$/;
  const extensions = context.extensions;

  // The whole statement, which may continue over several lines up to the semicolon.
  const statement = (i, first) => {
    let s = first;
    let j = i;
    while (!/;\s*(\/\/.*)?$/.test(s) && j + 1 < lines.length && j - i < 40) { j += 1; s += ` ${lines[j].trim()}`; }
    return s.replace(/;\s*(\/\/.*)?$/, '').trim();
  };

  lines.forEach((raw, i) => {
    const cm = classRe.exec(raw);
    if (cm) { klass = cm[1]; klassDepth = depth; }
    depth += (raw.match(/{/g) ?? []).length - (raw.match(/}/g) ?? []).length;
    if (klass && depth <= klassDepth && !cm) klass = null;

    const d = decl.exec(raw);
    if (d) {
      const [, type, name, rest] = d;
      const full = klass ? `${klass}.${name}` : name;
      const value = statement(i, rest);
      const theme = isDark(full) || isDark(klass ?? '') ? 'dark' : 'light';
      const where = { file, line: i + 1 };
      if (/^TextStyle\(/.test(value)) {
        const size = /fontSize:\s*([\d.]+)/.exec(value)?.[1];
        const weight = /fontWeight:\s*FontWeight\.w(\d+)/.exec(value)?.[1] ?? (/FontWeight\.bold/.test(value) ? '700' : undefined);
        const family = /fontFamily:\s*'([^']+)'/.exec(value)?.[1];
        found.tokens.push({ name: full, value: [size && `${size}px`, weight && `w${weight}`, family].filter(Boolean).join(' ') || 'TextStyle()', kind: 'text', theme, ...where });
        return;
      }
      if (/^(ColorScheme)(\.(light|dark))?\(/.test(value)) { colourScheme(value, full, where, found, lookup, theme); return; }
      if (/^ColorScheme\.fromSeed\(|^ColorScheme\.fromSwatch\(|fromSeed\(/.test(value)) {
        found.unresolved.push({ name: full, ...where, reason: 'the colour scheme is derived from a seed colour; its palette comes from an algorithm that is not implemented, so no colour is invented for it' });
        return;
      }
      const ext = /^([A-Z]\w*)\(/.exec(value);
      if (ext && extensions.has(ext[1])) { extensionInstance(value, full, where, found, lookup, theme); return; }
      if (type === 'double' || type === 'int' || (!type && /^[\d.]+$/.test(value))) {
        const kind = /radius|radii|round|corner/i.test(`${full}`) ? 'radius' : /space|spacing|gap|padding|inset|margin/i.test(`${full}`) ? 'spacing' : null;
        if (kind && /^[\d.]+$/.test(value)) found.tokens.push({ name: full, value: `${value}px`, kind, theme: 'light', ...where });
        return;
      }
      if (type === 'Color' || !type || /Color|Colors\./.test(value)) {
        if (type !== 'Color' && !/Color|Colors\.|^[A-Za-z_]\w*(\.\w+)*(\.with\w+\(.*\))?$/.test(value)) return;
        const r = dartColor(value, lookup);
        if (r.value) found.tokens.push({ name: full, value: r.value, kind: 'colour', theme, ...where, ...(r.derived ? { derived: r.derived } : {}), ...(r.via ? { via: r.via } : {}) });
        else found.unresolved.push({ name: full, ...where, reason: r.reason });
      }
      return;
    }
    // A scheme built with a constructor call that is not assigned to a named constant on the same line.
    if (/ColorScheme\.fromSeed\(|ColorScheme\.fromSwatch\(/.test(raw)) {
      found.unresolved.push({ name: `${klass ? `${klass}.` : ''}colorScheme`, file, line: i + 1, reason: 'the colour scheme is derived from a seed colour; its palette comes from an algorithm that is not implemented, so no colour is invented for it' });
    } else if (DART_DEVICE.test(raw)) {
      found.unresolved.push({ name: `${klass ? `${klass}.` : ''}dynamic colour`, file, line: i + 1, reason: 'the colour comes from the device' });
    } else if (/\bColorScheme(\.light|\.dark)?\(\s*$/.test(raw) || /=\s*ColorScheme(\.light|\.dark)?\(/.test(raw) || /colorScheme:\s*(const\s+)?ColorScheme(\.light|\.dark)?\(/.test(raw)) {
      const value = statement(i, raw.slice(raw.indexOf('ColorScheme')).trim());
      const name = `${klass ? `${klass}.` : ''}colorScheme`;
      colourScheme(value, name, { file, line: i + 1 }, found, lookup, isDark(raw) || isDark(value) ? 'dark' : 'light');
    }
  });
}

function namedArgs(call) {
  const open = call.indexOf('(');
  const body = call.slice(open + 1, call.lastIndexOf(')'));
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => /^\s*(\w+)\s*:\s*([\s\S]+)$/.exec(p)).filter(Boolean).map((m) => [m[1], m[2].trim()]);
}

function colourScheme(call, name, where, found, lookup, theme) {
  const dark = /ColorScheme\.dark\(/.test(call) || /brightness:\s*Brightness\.dark/.test(call) ? 'dark' : /ColorScheme\.light\(/.test(call) || /brightness:\s*Brightness\.light/.test(call) ? 'light' : theme;
  namedArgs(call).filter(([k]) => k !== 'brightness').forEach(([k, v]) => {
    const r = dartColor(v, lookup);
    const token = `${name}.${k}`;
    if (r.value) found.tokens.push({ name: token, value: r.value, kind: 'colour', theme: dark, ...where, ...(r.derived ? { derived: r.derived } : {}), ...(r.via ? { via: r.via } : {}) });
    else found.unresolved.push({ name: token, ...where, reason: r.reason });
  });
}

function extensionInstance(call, name, where, found, lookup, theme) {
  namedArgs(call).forEach(([k, v]) => {
    const r = dartColor(v, lookup);
    if (r.value) found.tokens.push({ name: `${name}.${k}`, value: r.value, kind: 'colour', theme, ...where, ...(r.derived ? { derived: r.derived } : {}), ...(r.via ? { via: r.via } : {}) });
    else if (/Color|Colors\./.test(v)) found.unresolved.push({ name: `${name}.${k}`, ...where, reason: r.reason });
  });
}

// ------------------------------------------------------------------ Web

const CSS_COLOUR = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)|[a-z]+)$/;

function cssBlocks(text) {
  const blocks = [];
  const stack = [];
  let i = 0;
  let start = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '{') {
      stack.push({ selector: text.slice(start, i).trim(), bodyStart: i + 1 });
      start = i + 1;
    } else if (ch === '}') {
      const open = stack.pop();
      if (open) blocks.push({ selector: open.selector, body: text.slice(open.bodyStart, i), bodyStart: open.bodyStart, parents: stack.map((s) => s.selector) });
      start = i + 1;
    } else if (ch === ';' && stack.length === 0) start = i + 1;
    i += 1;
  }
  return blocks;
}

function webTheme(block) {
  const all = [...block.parents, block.selector].join(' ');
  return isDark(all) ? 'dark' : 'light';
}

function webSet(block) {
  const m = /\[data-(?:brand|flavou?r|tenant)=["']?([\w-]+)["']?\]|\.(?:brand|theme)-([\w-]+)/.exec(block.selector);
  const name = m?.[1] ?? m?.[2];
  return name && !/^(dark|light)$/.test(name) ? name : null;
}

function cssTokens(file, text, found) {
  const defs = [];
  cssBlocks(text).forEach((b) => {
    const root = /(^|[\s,])(:root|html|body|\.dark|\.light|\[data-theme[^\]]*\]|\[data-brand[^\]]*\]|\[data-flavou?r[^\]]*\]|\.(brand|theme)-[\w-]+)(?=[\s,:{[]|$)/.test(b.selector);
    if (!root) return;
    const theme = webTheme(b);
    const set = webSet(b);
    for (const m of b.body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)) {
      defs.push({ name: m[1], raw: m[2].trim(), theme, set, line: lineOf(text, b.bodyStart + m.index) });
    }
  });
  const find = (name, theme, set) => defs.find((d) => d.name === name && d.theme === theme && d.set === set) ?? defs.find((d) => d.name === name && d.theme === 'light' && d.set === set) ?? defs.find((d) => d.name === name && d.set === null && d.theme === 'light');
  const resolve = (def, seen = []) => {
    const ref = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/.exec(def.raw);
    if (!ref) return { value: def.raw, via: seen };
    if (seen.includes(ref[1]) || seen.length > 10) return { reason: 'the custom properties refer to each other in a loop' };
    const target = find(ref[1], def.theme, def.set);
    if (!target) return ref[2] ? { value: ref[2].trim(), via: [...seen, ref[1]] } : { reason: `the custom property ${ref[1]} is not defined in the declared files` };
    const inner = resolve(target, [...seen, ref[1]]);
    return inner;
  };
  defs.forEach((d) => {
    const r = resolve(d);
    const where = { file, line: d.line };
    const kind = CSS_COLOUR.test(r.value ?? '') && /^(#|rgb|hsl|oklch)/.test(r.value ?? '') ? 'colour' : /^-?[\d.]+(px|rem|em)$/.test(r.value ?? '') ? (/radius|round/i.test(d.name) ? 'radius' : 'spacing') : null;
    if (r.reason) { found.unresolved.push({ name: d.name, ...where, reason: r.reason }); return; }
    if (!kind) return;
    found.tokens.push({ name: d.name, value: r.value, kind, theme: d.theme, ...(d.set ? { set: d.set } : {}), ...where, ...(r.via.length ? { via: r.via.join(' -> ') } : {}) });
  });
}

// The colour and spacing scales of the configuration of the styling tool: only literal objects are read.
function objectAt(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    if (text[i] === '}') { depth -= 1; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

function tailwindTokens(file, text, found) {
  const sections = [['colors', 'colour'], ['spacing', 'spacing'], ['borderRadius', 'radius']];
  sections.forEach(([key, kind]) => {
    const m = new RegExp(`\\b${key}\\s*:\\s*\\{`).exec(text);
    if (!m) return;
    const startIdx = m.index + m[0].length - 1;
    const body = objectAt(text, startIdx);
    if (!body) return;
    const base = lineOf(text, startIdx);
    const walk = (src, prefix, offsetLines) => {
      for (const e of src.matchAll(/(['"]?[\w-]+['"]?)\s*:\s*(\{|['"][^'"]+['"]|\d+(?:\.\d+)?|[^,\n}]+)/g)) {
        const name = e[1].replace(/['"]/g, '');
        const line = base + (src.slice(0, e.index).split('\n').length - 1) + offsetLines;
        if (e[2] === '{') {
          const inner = objectAt(src, e.index + e[0].length - 1);
          if (inner) walk(inner.slice(1, -1), `${prefix}${name}-`, line - base);
          continue;
        }
        const lit = /^['"]([^'"]+)['"]$/.exec(e[2].trim());
        const full = `${key}.${prefix}${name}`;
        if (lit && (kind !== 'colour' || /^(#|rgb|hsl|oklch)/.test(lit[1])) ) found.tokens.push({ name: full, value: lit[1], kind, theme: 'light', file, line });
        else if (!lit && /^\d/.test(e[2].trim())) found.tokens.push({ name: full, value: e[2].trim(), kind, theme: 'light', file, line });
        else found.unresolved.push({ name: full, file, line, reason: 'the value is not a literal (a reference or an expression the reader cannot follow)' });
      }
    };
    walk(body.slice(1, -1), '', 0);
  });
}

// ------------------------------------------------------------------ Entry

const order = (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.name.localeCompare(b.name);

export function readTokens(files) {
  const found = { tokens: [], unresolved: [] };
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  // A first pass collects named colours so that a reference can be followed across files.
  const names = new Map();
  const extensions = new Set();
  const lookup = (name) => names.get(name);
  sorted.filter((f) => f.path.endsWith('.dart')).forEach((f) => {
    for (const m of f.text.matchAll(/class\s+(\w+)\s+extends\s+ThemeExtension/g)) extensions.add(m[1]);
  });
  // Two passes over the Dart files settle references written before the definition they point to.
  for (let pass = 0; pass < 3; pass += 1) {
    const round = { tokens: [], unresolved: [] };
    sorted.filter((f) => f.path.endsWith('.dart')).forEach((f) => dartTokens(f.path, f.text, round, lookup, { extensions }));
    names.clear();
    const shortSeen = new Map();
    round.tokens.filter((t) => t.kind === 'colour').forEach((t) => {
      names.set(t.name, t);
      // An unqualified name is followed only when one definition has it: two with the same name would be a guess.
      const short = t.name.split('.').pop();
      shortSeen.set(short, [...(shortSeen.get(short) ?? []), t]);
    });
    shortSeen.forEach((list, short) => { if (list.length === 1 && !names.has(short)) names.set(short, list[0]); });
    if (pass === 2) { found.tokens.push(...round.tokens); found.unresolved.push(...round.unresolved); }
  }
  sorted.forEach((f) => {
    if (/\.(css|scss|pcss)$/.test(f.path)) cssTokens(f.path, f.text, found);
    else if (/(^|\/)tailwind\.config\.(js|cjs|mjs|ts)$/.test(f.path)) tailwindTokens(f.path, f.text, found);
  });

  found.tokens.sort(order);
  found.unresolved.sort(order);
  // Several sets (brands, flavours): a token name defined in more than one class of a file with different values.
  const sets = new Map();
  found.tokens.forEach((t) => {
    if (t.set) sets.set(t.set, (sets.get(t.set) ?? 0) + 1);
  });
  const byShort = new Map();
  found.tokens.filter((t) => t.kind === 'colour' && t.name.includes('.') && !t.set && /\.dart$/.test(t.file)).forEach((t) => {
    const [klass, ...rest] = t.name.split('.');
    const key = `${rest.join('.')}|${t.theme}`;
    byShort.set(key, [...(byShort.get(key) ?? []), { klass, value: t.value }]);
  });
  const classes = new Map();
  byShort.forEach((list) => {
    if (new Set(list.map((l) => l.klass)).size > 1 && new Set(list.map((l) => l.value)).size > 1) list.forEach((l) => classes.set(l.klass, (classes.get(l.klass) ?? 0) + 1));
  });
  classes.forEach((count, klass) => found.tokens.filter((t) => t.name.startsWith(`${klass}.`)).forEach((t) => { t.set = klass; sets.set(klass, (sets.get(klass) ?? 0) + 1); }));
  return { ...found, sets: [...sets.keys()].sort() };
}

/** The table as text: one line per token, then what is unresolved. */
export function renderTokens(result) {
  const lines = [];
  const bySet = (set) => result.tokens.filter((t) => (t.set ?? null) === set);
  const block = (title, tokens) => {
    if (!tokens.length) return;
    if (title) lines.push(`## ${title}`);
    ['light', 'dark'].forEach((theme) => {
      const rows = tokens.filter((t) => t.theme === theme);
      if (!rows.length) return;
      lines.push(`${theme}:`);
      rows.forEach((t) => lines.push(`  ${t.name} = ${t.value} (${t.kind}${t.derived ? `, derived: ${t.derived}` : ''}${t.via ? `, via ${t.via}` : ''}) ${t.file}:${t.line}`));
    });
  };
  if (result.sets.length) {
    lines.push(`More than one set of tokens was found (${result.sets.join(', ')}): ask which one to use; they are not merged.`, '');
    result.sets.forEach((s) => { block(s, bySet(s)); lines.push(''); });
    block('Without a set', bySet(null));
  } else block('', result.tokens);
  if (result.unresolved.length) {
    lines.push('', 'Unresolved (not guessed):');
    result.unresolved.forEach((u) => lines.push(`  ${u.name} ${u.file}:${u.line}: ${u.reason}`));
  }
  return lines.join('\n').trim();
}
