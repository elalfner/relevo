// What the agent did, read from the execution log of the runner and redacted. Implements "A run that ends abnormally
// leaves a trimmed transcript" and "The agent output of a run can be shown, redacted" of the go specification.
//
// The format of the log is not documented (see run-usage.mjs), so the reader is tolerant: a JSON array, JSON lines or a
// single object are accepted, and an entry it does not understand is dropped, never printed as it is. Nothing found gives
// an empty transcript, never an error.

import { redact } from './redact.mjs';

export const MAX_ENTRIES = 200;
export const MAX_BYTES = 200 * 1024;
export const RESULT_CHARS = 300;
const LINE_CHARS = 500;

function entriesOf(text) {
  const t = String(text ?? '').trim();
  if (!t) return [];
  try {
    const whole = JSON.parse(t);
    return Array.isArray(whole) ? whole : [whole];
  } catch {
    return t.split('\n').map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  }
}

const blocks = (entry) => {
  const content = entry?.message?.content;
  return Array.isArray(content) ? content.filter((b) => b && typeof b === 'object') : [];
};

const oneLine = (s, max) => {
  const flat = String(s).replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
};

// The command or the path a tool call acts on; any other input is left out, since only these say what was done.
function subject(input) {
  if (!input || typeof input !== 'object') return '';
  const v = input.command ?? input.file_path ?? input.path ?? input.pattern ?? input.description ?? '';
  return typeof v === 'string' ? v : '';
}

function resultText(block) {
  const c = block.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join(' ');
  return '';
}

/**
 * text     the execution log
 * results  true to add the first characters of each result (the full output is on); false keeps commands only
 * secrets  values to redact besides the known shapes
 * Returns { lines, total, kept } where `lines` are redacted, in order, the last MAX_ENTRIES and at most MAX_BYTES.
 */
export function transcript(text, { results = false, secrets = [] } = {}) {
  const out = [];
  entriesOf(text).forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    blocks(entry).forEach((b) => {
      if (b.type === 'tool_use' && typeof b.name === 'string') {
        out.push({ id: b.id, line: `$ ${b.name}: ${oneLine(subject(b.input), LINE_CHARS)}` });
      } else if (b.type === 'tool_result' && results) {
        const t = resultText(b);
        if (t.trim() !== '') out.push({ id: b.tool_use_id, line: `  > ${oneLine(t, RESULT_CHARS)}` });
      }
    });
  });
  const total = out.length;
  let lines = out.slice(-MAX_ENTRIES).map((e) => redact(e.line, { secrets }));
  // Keep the end of the run when it is too long: the last lines say how it stopped.
  let size = 0;
  const kept = [];
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    size += Buffer.byteLength(lines[i]) + 1;
    if (size > MAX_BYTES) break;
    kept.unshift(lines[i]);
  }
  lines = kept;
  return { lines, total, kept: lines.length };
}

/** The text to print or to save. */
export function renderTranscript(text, options = {}) {
  const t = transcript(text, options);
  if (t.kept === 0) return '';
  const head = t.kept < t.total ? `(the last ${t.kept} of ${t.total} entries)\n` : '';
  return `${head}${t.lines.join('\n')}\n`;
}
