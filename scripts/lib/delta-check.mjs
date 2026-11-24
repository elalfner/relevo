// Tells whether the delta of a change still fits the main specifications it will be archived into.
// Implements "The check follows the rules of the archive", "What counts as a clash is what makes the archive stop" and
// "What the archive accepts is not a clash" of openspec/specs/ship/spec.md.
//
// It applies to the delta the rules `openspec archive` applies, in the order the archive uses (rename, remove, modify,
// add), and collects every clash instead of stopping at the first. It only reads: the caller hands it the text of the
// delta and a function that returns the text of a main specification (or null when the capability has none).

/** `### Requirement: Foo ###` is the name `Foo`: a closing run of `#` is not part of it (as OpenSpec reads it). */
const normalizeName = (name) => name.replace(/[ \t]+#+[ \t]*$/, '').trim();
/** Case- and spacing-insensitive form of a name: two names with the same fold are one requirement written twice. */
const foldName = (name) => normalizeName(name).toLowerCase().replace(/\s+/g, ' ');
const normalizeRaw = (raw) => raw.replace(/\r\n?/g, '\n').trim();

const REQUIREMENT = /^###\s*Requirement:\s*(.+)\s*$/i;
const SCENARIO = /^####\s*Scenario:\s*(.+?)\s*$/i;
const SECTION = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/i;

/** One boolean per line: true inside a fenced code block (the fence lines included). */
function fenceMask(lines) {
  let inside = false;
  return lines.map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inside = !inside;
      return true;
    }
    return inside;
  });
}

/** The requirement blocks of `lines` (a name, its raw text and the names of its scenarios), headers inside fences ignored. */
function blocksOf(lines, mask) {
  const blocks = [];
  let current = null;
  lines.forEach((line, i) => {
    const header = !mask[i] && line.match(REQUIREMENT);
    if (header) {
      current = { name: normalizeName(header[1]), lines: [line], scenarios: [] };
      blocks.push(current);
      return;
    }
    if (!current) return;
    current.lines.push(line);
    const scenario = !mask[i] && line.match(SCENARIO);
    if (scenario) current.scenarios.push(scenario[1]);
  });
  return blocks.map((b) => ({ name: b.name, raw: normalizeRaw(b.lines.join('\n')), scenarios: b.scenarios }));
}

/** The requirements of a main specification: the blocks of its `## Requirements` section. */
export function parseMain(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const mask = fenceMask(lines);
  const start = lines.findIndex((l, i) => !mask[i] && /^##\s+Requirements\s*$/i.test(l));
  if (start === -1) return [];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (!mask[i] && /^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return blocksOf(lines.slice(start + 1, end), mask.slice(start + 1, end));
}

/** The operations of a delta: { added, modified, removed, renamed } with blocks, names and { from, to } pairs. */
export function parseDelta(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const mask = fenceMask(lines);
  const plan = { added: [], modified: [], removed: [], renamed: [] };
  const sections = [];
  lines.forEach((line, i) => {
    const m = !mask[i] && line.match(SECTION);
    if (m) sections.push({ kind: m[1].toUpperCase(), from: i + 1 });
    else if (!mask[i] && /^##\s+/.test(line) && sections.length > 0) sections.push({ kind: null, from: i + 1 });
  });
  sections.forEach((section, k) => {
    if (!section.kind) return;
    const to = k + 1 < sections.length ? sections[k + 1].from - 1 : lines.length;
    const body = lines.slice(section.from, to);
    const bodyMask = mask.slice(section.from, to);
    if (section.kind === 'RENAMED') {
      let from = null;
      body.forEach((line, i) => {
        if (bodyMask[i]) return;
        const f = line.match(/FROM:\s*`?###\s*Requirement:\s*(.+?)`?\s*$/i);
        const t = line.match(/TO:\s*`?###\s*Requirement:\s*(.+?)`?\s*$/i);
        if (f) from = normalizeName(f[1]);
        else if (t && from !== null) {
          plan.renamed.push({ from, to: normalizeName(t[1]) });
          from = null;
        }
      });
      return;
    }
    const blocks = blocksOf(body, bodyMask);
    if (section.kind === 'ADDED') plan.added.push(...blocks);
    if (section.kind === 'MODIFIED') plan.modified.push(...blocks);
    if (section.kind === 'REMOVED') plan.removed.push(...blocks.map((b) => b.name));
  });
  return plan;
}

/** The clashes of one capability's delta with its main specification text (null when there is none). */
function checkOne(capability, deltaText, mainText) {
  const plan = parseDelta(deltaText);
  const clashes = [];
  const clash = (operation, header, reason, detail) => clashes.push({ capability, operation, header, reason, ...(detail ? { detail } : {}) });

  if (mainText === null || mainText === undefined) {
    // A new capability: only ADDED requirements can create it; a removal has nothing to remove.
    plan.modified.forEach((b) => clash('MODIFIED', b.name, 'no-main-spec'));
    plan.renamed.forEach((r) => clash('RENAMED', r.from, 'no-main-spec'));
    return clashes;
  }

  const map = new Map(parseMain(mainText).map((b) => [normalizeName(b.name), b]));
  const variantOf = (key, except) => [...map.keys()].find((k) => k !== except && foldName(k) === foldName(key));

  plan.renamed.forEach(({ from, to }) => {
    if (!map.has(from)) {
      if (map.has(to)) {
        // Already applied, unless a variant of the source is still there: that is a mistyped header.
        if (variantOf(from, to) !== undefined) clash('RENAMED', from, 'variant-exists');
        return;
      }
      clash('RENAMED', from, 'source-not-found');
      return;
    }
    if (map.has(to)) {
      clash('RENAMED', to, 'target-exists');
      return;
    }
    if (variantOf(to, from) !== undefined) {
      clash('RENAMED', to, 'variant-exists');
      return;
    }
    const block = map.get(from);
    map.delete(from);
    map.set(to, { ...block, name: to });
  });

  plan.removed.forEach((name) => {
    const key = normalizeName(name);
    if (!map.has(key)) {
      // Already removed is fine; a variant of the name that is still there is a mistyped header.
      if (variantOf(key) !== undefined) clash('REMOVED', name, 'variant-exists');
      return;
    }
    map.delete(key);
  });

  plan.modified.forEach((block) => {
    const key = normalizeName(block.name);
    const current = map.get(key);
    if (!current) {
      clash('MODIFIED', block.name, 'not-found');
      return;
    }
    const dropped = current.scenarios.filter((s) => !block.scenarios.includes(s));
    if (dropped.length > 0) clash('MODIFIED', block.name, 'scenario-dropped', dropped.join('", "'));
    map.set(key, block);
  });

  plan.added.forEach((block) => {
    const key = normalizeName(block.name);
    const existing = map.get(key);
    if (existing) {
      // The same text means it was already synced: not a clash.
      if (normalizeRaw(existing.raw) !== normalizeRaw(block.raw)) clash('ADDED', block.name, 'already-exists');
      return;
    }
    if (variantOf(key) !== undefined) {
      clash('ADDED', block.name, 'variant-exists');
      return;
    }
    map.set(key, block);
  });

  return clashes;
}

/**
 * capabilities  [{ capability, delta }]   the delta text of each capability the change touches
 * readMain      (capability) => text | null
 * Returns { clashes: [{ capability, operation, header, reason, detail? }] }, every capability's clashes in order.
 */
export function checkDelta({ capabilities, readMain }) {
  return { clashes: capabilities.flatMap(({ capability, delta }) => checkOne(capability, delta, readMain(capability) ?? null)) };
}

const WHY = {
  'already-exists': (c) => `already exists in the main specification with other text: a sibling change added it first, so the delta must modify it (MODIFIED, with its full text) or use another name`,
  'variant-exists': (c) => `differs only in case or spacing from a requirement the main specification already has: use that exact header, or choose a distinct name`,
  'not-found': (c) => `the requirement is not in the main specification any more: use the header it has now, or add it`,
  'scenario-dropped': (c) => `the block would drop the scenario "${c.detail}" that the main specification has: the block must keep it`,
  'target-exists': (c) => `the new name already exists in the main specification: choose a distinct name`,
  'source-not-found': (c) => `the old name is not in the main specification: use the name it has now`,
  'no-main-spec': (c) => `the capability has no main specification yet: only ADDED requirements can create it`,
};

/** One line per clash, with what the delta must become and, when `issue` is given, the command that corrects it. */
export function describeClashes(clashes, { issue } = {}) {
  const lines = clashes.map((c) => `${c.capability}: ${c.operation} "${c.header}" ${WHY[c.reason](c)}`);
  if (lines.length > 0 && issue) lines.push(`Run \`/relevo:fix ${issue}\`: it updates the specification first.`);
  return lines.join('\n');
}
