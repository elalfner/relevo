// Reads the sections of an issue body by heading, and copies them word for word.
// Implements "Sections of the issue are copied word for word" of openspec/specs/go/spec.md.
// The format is documented in docs/issue-format.md; headings are always in English.

const FENCE_RE = /^\s*(```|~~~)/;
const H2_RE = /^##\s+(.*?)\s*#*\s*$/;

/** The sections of level 2, in order: [{ name, text }]. Text is the lines under the heading, trimmed of blank lines at both ends. */
export function sections(body) {
  const out = [];
  let current = null;
  let inFence = false;
  String(body ?? '').split('\n').forEach((line) => {
    if (FENCE_RE.test(line)) inFence = !inFence;
    const h = !inFence && !/^###/.test(line) ? line.match(H2_RE) : null;
    if (h) {
      current = { name: h[1].trim(), lines: [] };
      out.push(current);
      return;
    }
    if (current) current.lines.push(line);
  });
  return out.map(({ name, lines }) => ({ name, text: lines.join('\n').replace(/^\s*\n/, '').replace(/\s+$/, '') }));
}

/** One section by name (case-insensitive), or null. */
export function section(body, name) {
  const wanted = String(name).trim().toLowerCase();
  return sections(body).find((s) => s.name.toLowerCase() === wanted) ?? null;
}

/**
 * The markdown that go appends to design.md: for each name that exists and has text, "## From the issue: <Name>" and the
 * text unchanged, in the order of `names`.
 */
export function copyBlock(body, names) {
  const blocks = [];
  names.forEach((name) => {
    const s = section(body, name);
    if (s && s.text !== '') blocks.push(`## From the issue: ${s.name}\n\n${s.text}\n`);
  });
  return blocks.join('\n');
}
