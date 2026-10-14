// Minimal parser for the YAML subset used by relevo.yml. No dependencies.
//
// Supported: nested maps (2+ space indentation), block lists of scalars,
// inline lists of scalars ([a, b]), empty inline map ({}), comments,
// quoted strings, booleans, null, integers and decimals.
// Not supported (reported as errors): tabs, anchors, multi-line strings,
// lists of maps, non-empty inline maps, duplicate keys.
// Quote any string that contains "#" or quote characters.

export class YamlLiteError extends Error {
  constructor(message, line) {
    super(`line ${line}: ${message}`);
    this.name = 'YamlLiteError';
    this.line = line;
  }
}

function stripComment(raw) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === '#' && !inSingle && !inDouble && (i === 0 || /\s/.test(raw[i - 1]))) {
      return raw.slice(0, i);
    }
  }
  return raw;
}

function splitInline(inner, line) {
  const parts = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  for (const c of inner) {
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    if (c === ',' && !inSingle && !inDouble) {
      parts.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  if (inSingle || inDouble) throw new YamlLiteError('unterminated quote in inline list', line);
  parts.push(current);
  return parts;
}

export function parseScalar(text, line = 0) {
  const t = text.trim();
  if (t === '') return null;
  if (t.startsWith('"')) {
    if (t.length < 2 || !t.endsWith('"')) throw new YamlLiteError('unterminated double-quoted string', line);
    try {
      return JSON.parse(t);
    } catch {
      throw new YamlLiteError('invalid escape in double-quoted string', line);
    }
  }
  if (t.startsWith("'")) {
    if (t.length < 2 || !t.endsWith("'")) throw new YamlLiteError('unterminated single-quoted string', line);
    return t.slice(1, -1).replace(/''/g, "'");
  }
  if (t.startsWith('[')) {
    if (!t.endsWith(']')) throw new YamlLiteError('unterminated inline list', line);
    const inner = t.slice(1, -1).trim();
    if (inner === '') return [];
    return splitInline(inner, line).map((part) => parseScalar(part, line));
  }
  if (t === '{}') return {};
  if (t.startsWith('{')) throw new YamlLiteError('inline maps are not supported', line);
  if (t.startsWith('&') || t.startsWith('*') || t === '|' || t === '>') {
    throw new YamlLiteError('anchors and multi-line strings are not supported', line);
  }
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null' || t === '~') return null;
  if (/^-?\d+$/.test(t)) return Number.parseInt(t, 10);
  if (/^-?\d+\.\d+$/.test(t)) return Number.parseFloat(t);
  return t;
}

const KEY_RE = /^([A-Za-z0-9_.-]+):(?:\s+(.*))?$/;

export function parse(text) {
  const rawLines = String(text).replace(/\r\n/g, '\n').split('\n');
  const items = [];
  rawLines.forEach((raw, idx) => {
    const line = idx + 1;
    const withoutComment = stripComment(raw);
    if (withoutComment.trim() === '') return;
    if (/^\s*\t/.test(withoutComment)) throw new YamlLiteError('tabs are not allowed for indentation', line);
    const m = withoutComment.match(/^( *)(\S.*?)\s*$/);
    items.push({ indent: m[1].length, content: m[2], line });
  });
  if (items.length === 0) return {};
  if (items[0].indent !== 0) throw new YamlLiteError('top level must not be indented', items[0].line);

  let pos = 0;

  function isListItem(item) {
    return item.content === '-' || item.content.startsWith('- ');
  }

  function parseList(indent) {
    const list = [];
    while (pos < items.length && items[pos].indent === indent && isListItem(items[pos])) {
      const item = items[pos];
      const rest = item.content.slice(1).trim();
      const quoted = rest.startsWith('"') || rest.startsWith("'");
      if (!quoted && /^[A-Za-z0-9_.-]+:(\s|$)/.test(rest)) {
        throw new YamlLiteError('lists of maps are not supported', item.line);
      }
      list.push(parseScalar(rest, item.line));
      pos += 1;
    }
    return list;
  }

  function parseMap(indent) {
    const map = {};
    while (pos < items.length && items[pos].indent === indent) {
      const item = items[pos];
      if (isListItem(item)) throw new YamlLiteError('unexpected list item in a map', item.line);
      const m = item.content.match(KEY_RE);
      if (!m) throw new YamlLiteError(`expected "key: value", got "${item.content}"`, item.line);
      const key = m[1];
      if (Object.prototype.hasOwnProperty.call(map, key)) {
        throw new YamlLiteError(`duplicate key "${key}"`, item.line);
      }
      pos += 1;
      if (m[2] !== undefined && m[2].trim() !== '') {
        map[key] = parseScalar(m[2], item.line);
        continue;
      }
      const next = items[pos];
      if (next && next.indent > indent) {
        map[key] = isListItem(next) ? parseList(next.indent) : parseMap(next.indent);
      } else if (next && next.indent === indent && isListItem(next)) {
        map[key] = parseList(indent);
      } else {
        map[key] = null;
      }
    }
    if (pos < items.length && items[pos].indent > indent) {
      throw new YamlLiteError('unexpected indentation', items[pos].line);
    }
    return map;
  }

  const result = parseMap(0);
  if (pos < items.length) throw new YamlLiteError('unexpected content', items[pos].line);
  return result;
}
