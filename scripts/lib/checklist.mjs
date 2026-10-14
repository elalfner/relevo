// Builds the review checklist from the scenarios of a change specification.
// One checklist line per `#### Scenario:` found under `<change>/specs/**/spec.md`.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SCENARIO_RE = /^####\s+Scenario:\s*(.+?)\s*$/;
const STEP_RE = /^\s*[-*]\s+\*\*(AND WHEN|WHEN|THEN|AND THEN|AND)\*\*\s*(.*?)\s*$/;

/** Parse scenarios out of the text of one spec file. */
export function scenariosFromSpec(text, source = '') {
  const scenarios = [];
  let current = null;
  String(text).split('\n').forEach((line) => {
    const heading = line.match(/^#{1,6}\s/);
    const scenario = line.match(SCENARIO_RE);
    if (scenario) {
      current = { title: scenario[1], when: [], then: [], source };
      scenarios.push(current);
      return;
    }
    if (heading) {
      current = null;
      return;
    }
    const step = current && line.match(STEP_RE);
    if (!step) return;
    const [, kind, rest] = step;
    if (kind.endsWith('WHEN') || (kind === 'AND' && current.then.length === 0)) current.when.push(rest);
    else current.then.push(rest);
  });
  return scenarios;
}

function specFiles(dir) {
  const out = [];
  (function walk(d) {
    readdirSync(d).sort().forEach((name) => {
      const path = join(d, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name === 'spec.md') out.push(path);
    });
  }(dir));
  return out;
}

/** All scenarios of a change directory, in file order. Returns [{ id, title, when, then, source }]. */
export function checklistFromChange(changeDir) {
  const specsDir = join(changeDir, 'specs');
  const items = [];
  specFiles(specsDir).forEach((file) => {
    scenariosFromSpec(readFileSync(file, 'utf8'), file.slice(changeDir.length).replace(/^\/+/, '')).forEach((s) => items.push(s));
  });
  return items.map((s, i) => ({ id: i + 1, ...s }));
}

/** Markdown checklist, optionally with the items already confirmed ticked. */
export function checklistMarkdown(items, statuses = {}) {
  return items
    .map((s) => {
      const mark = statuses[s.id] === 'ok' ? 'x' : ' ';
      const detail = [s.when.join(' and '), s.then.join(' and ')].filter(Boolean);
      const text = detail.length === 2 ? `when ${detail[0]}, then ${detail[1]}` : detail.join('');
      return `- [${mark}] ${s.id}. **${s.title}**: ${text}`;
    })
    .join('\n');
}
