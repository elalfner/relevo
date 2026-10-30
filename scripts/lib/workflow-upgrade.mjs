// Updates a workflow of a repository to the current template by a three-way merge. Implements the requirements "Init
// updates a workflow by a three-way merge", "A merged workflow is written only when clean and confirmed" and "The pin and
// the stamp are set, not merged" of openspec/specs/init-doctor/spec.md.
//
//   base    the published template closest to the file (the pin is no guide: a person can raise it by hand)
//   ours    the file as it is
//   theirs  the current template, rendered with the runner and the agent of the repository, so that a person's runner
//           or agent block is the same on both sides and is not reported as a change
//
// The pin and the stamp are not merged: both are set to the base's value in the file before the merge (otherwise the
// person's own pin conflicts with every release) and to the current value after it. Nothing here writes a workflow: the
// caller decides, and a conflict gives back text that must not be written.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agentWorkflow, withRestricted } from './agent-workflow.mjs';
import { BASE_PATTERNS } from './restricted-paths.mjs';
import { runnerLine } from './init.mjs';

const PIN_RE = /^(\s*RELEVO_VERSION:\s*)(['"]?)([\w.+-]+)\2[ \t]*$/m;
const STAMP_RE = /^# relevo-template: (\d+\.\d+\.\d+)[ \t]*$/m;
const MARKERS = ['credential', 'agent-step', 'restricted'];

export const pinOf = (text) => PIN_RE.exec(text)?.[3] ?? null;
export const stampOf = (text) => STAMP_RE.exec(text)?.[1] ?? null;
const setPin = (text, version) => text.replace(PIN_RE, (_, head, quote) => `${head}${quote}${version}${quote}`);
const setStamp = (text, version) => text.replace(STAMP_RE, `# relevo-template: ${version}`);

/** How many lines two workflows do not share (as multisets), with the pin and the stamp set aside. */
export function distance(a, b) {
  const lines = (t) => setStamp(setPin(t, 'X'), 'X').split('\n');
  const count = new Map();
  lines(a).forEach((l) => count.set(l, (count.get(l) ?? 0) + 1));
  lines(b).forEach((l) => count.set(l, (count.get(l) ?? 0) - 1));
  return [...count.values()].reduce((sum, n) => sum + Math.abs(n), 0);
}

/**
 * The candidate whose text is closest to the file; the newest among equals. `from` names the base instead. null when no
 * candidate is close enough: more than half of the lines of the file different is not a version of this template.
 */
export function chooseBase(file, candidates, { from = null } = {}) {
  if (from !== null) {
    const named = candidates.find((c) => c.version === from);
    return named ? { ...named, distance: distance(file, named.rendered) } : null;
  }
  const ranked = candidates.map((c) => ({ ...c, distance: distance(file, c.rendered) }))
    .sort((a, b) => a.distance - b.distance || compareVersions(b.version, a.version));
  const limit = Math.max(20, Math.floor(file.split('\n').length / 2));
  return ranked.length > 0 && ranked[0].distance <= limit ? ranked[0] : null;
}

const compareVersions = (a, b) => a.split('.').map(Number).reduce((r, n, i) => r || n - Number(b.split('.')[i]), 0);

/** `git merge-file -p`: the exit status is the number of conflicts (1 to 127); anything else is an error. */
export function gitMergeFile(ours, base, theirs) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-merge-'));
  try {
    const paths = [['ours', ours], ['base', base], ['theirs', theirs]].map(([name, text]) => {
      const path = join(dir, name);
      writeFileSync(path, text);
      return path;
    });
    try {
      return { status: 0, stdout: execFileSync('git', ['merge-file', '-p', ...paths], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
    } catch (err) {
      return { status: err.status ?? 255, stdout: String(err.stdout ?? '') };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The blocks of conflict of a merged text: [{ yours, theirs }]. */
export function conflictsOf(text) {
  const out = [];
  const re = /^<<<<<<<[^\n]*\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>>[^\n]*\n/gm;
  let m;
  while ((m = re.exec(text)) !== null) out.push({ yours: m[1].trimEnd(), theirs: m[2].trimEnd() });
  return out;
}

/** A merge that lost what other code depends on is not safe to write, whatever git says. */
function structureProblem(merged, current) {
  if ((merged.match(/^\s*RELEVO_VERSION:/gm) ?? []).length !== 1) return 'it does not have exactly one RELEVO_VERSION';
  if (stampOf(current) !== null && (merged.match(/^# relevo-template:/gm) ?? []).length !== 1) return 'it does not have exactly one stamp';
  for (const name of MARKERS) {
    const count = (t, kind) => (t.match(new RegExp(`^\\s*# relevo:${name} ${kind}\\s*$`, 'gm')) ?? []).length;
    for (const kind of ['begin', 'end']) {
      if (count(merged, kind) !== count(current, kind)) return `the block "${name}" (${kind}) is not as in the template`;
    }
  }
  return null;
}

/**
 * The state of one workflow against the current template.
 *   { status: 'current' }                        nothing to update
 *   { status: 'update', from, to, text }         a clean merge; `text` is what to write
 *   { status: 'conflict', from, conflicts }      lines both sides changed, or a merge that is not safe; write nothing
 *   { status: 'nobase' }                         no published template is close to the file
 *   { status: 'error', message }                 git failed
 * `candidates` are [{ version, template, blocks }] (the raw template of a published version and its agent blocks, or
 * null). `render` turns a raw template into what `init` would write for this repository, and `normalize` rewrites in a
 * file the parts that are generated from relevo.yml, before the merge and after it.
 */
export function upgradeWorkflow({ ours, current, candidates, from = null, render, merge = gitMergeFile, normalize = (text) => text }) {
  const theirs = render(current.template, current.blocks);
  const rendered = candidates.map((c) => ({ ...c, rendered: render(c.template, c.blocks) }));
  const base = chooseBase(ours, rendered, { from });
  if (!base) return { status: 'nobase' };

  // `normalize` writes again what is generated from relevo.yml (the restricted block), so it is set, not merged: a new
  // entry of `restricted_paths` reaches the file even though the person's copy still has the old block.
  let prepared = normalize(ours);
  if (pinOf(prepared) !== null && pinOf(base.rendered) !== null) prepared = setPin(prepared, pinOf(base.rendered));
  if (stampOf(prepared) !== null && stampOf(base.rendered) !== null) prepared = setStamp(prepared, stampOf(base.rendered));

  const result = merge(prepared, base.rendered, theirs);
  if (result.status === 0) {
    let text = normalize(result.stdout);
    if (pinOf(theirs) !== null) text = setPin(text, pinOf(theirs));
    if (stampOf(theirs) !== null && stampOf(text) !== null) text = setStamp(text, stampOf(theirs));
    const problem = structureProblem(text, theirs);
    if (problem) return { status: 'conflict', from: base.version, conflicts: [], message: `the merge is not safe: ${problem}` };
    if (text === ours) return { status: 'current' };
    return { status: 'update', from: base.version, to: stampOf(theirs) ?? pinOf(theirs), text };
  }
  if (result.status >= 1 && result.status <= 127) return { status: 'conflict', from: base.version, conflicts: conflictsOf(result.stdout) };
  return { status: 'error', message: 'git merge-file failed' };
}

/** The published versions of the package and their templates, fetched with `npm`; `exec(cmd, args)` returns stdout. */
export function publishedTemplates({ exec, tmp = mkdtempSync(join(tmpdir(), 'relevo-published-')), pkg = '@elalfner/relevo' }) {
  const unpacked = new Map();
  const dirOf = (version) => {
    if (!unpacked.has(version)) {
      const dir = join(tmp, version);
      mkdirSync(dir, { recursive: true });
      try {
        exec('npm', ['pack', `${pkg}@${version}`, '--silent', '--pack-destination', dir]);
        const tarball = join(dir, `${pkg.replace(/^@/, '').replace('/', '-')}-${version}.tgz`);
        exec('tar', ['-xzf', tarball, '-C', dir]);
        unpacked.set(version, join(dir, 'package'));
      } catch {
        unpacked.set(version, null);
      }
    }
    return unpacked.get(version);
  };
  return {
    versions: () => JSON.parse(exec('npm', ['view', pkg, 'versions', '--json'])).filter((v) => /^\d+\.\d+\.\d+$/.test(v) && v !== '0.0.0'),
    read: (version, path) => {
      const dir = dirOf(version);
      if (dir === null) return null;
      try {
        return readFileSync(join(dir, path), 'utf8');
      } catch {
        return null;
      }
    },
    cleanup: () => rmSync(tmp, { recursive: true, force: true }),
  };
}

/**
 * The state of each workflow of the repository that exists and differs from what `init` would write. `ours` and
 * `templates` map a file name to its text; `repo` brings `runnerLabels` and `build`; `restricted` is the list of restricted files (`restrictedList(config)`); `source` is `publishedTemplates`.
 */
export function planUpgrades({ files, ours, templates, agentBlocks, labels, build, from = null, source, merge, restricted = BASE_PATTERNS }) {
  const render = (template, blocks) => runnerLine(withRestricted(agentWorkflow(template, build, blocks), restricted), labels);
  const versions = files.some((f) => ours[f] != null) ? source.versions() : [];
  const out = {};
  files.filter((f) => ours[f] != null).forEach((file) => {
    const candidates = versions.map((version) => {
      const template = source.read(version, `templates/workflows/${file}`);
      return template === null ? null : { version, template, blocks: build === 'claude' ? null : source.read(version, `templates/agents/${build}-step.yml`) };
    }).filter(Boolean);
    out[file] = upgradeWorkflow({ ours: ours[file], current: { template: templates[file], blocks: agentBlocks }, candidates, from, render, merge, normalize: (text) => withRestricted(text, restricted) });
  });
  return out;
}

/** A readable unified difference between the file and its update, for the plan. */
export function unifiedDiff(before, after) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-diff-'));
  try {
    const a = join(dir, 'before');
    const b = join(dir, 'after');
    writeFileSync(a, before);
    writeFileSync(b, after);
    try {
      return execFileSync('git', ['diff', '--no-index', '--no-color', '--unified=2', a, b], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      return String(err.stdout ?? '').split('\n').slice(4).join('\n');
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
