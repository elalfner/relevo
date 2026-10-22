// Puts a rendered plugin where a tool reads it, and keeps a record of what was put there so that an update can tell a
// file that is out of date from one that a person edited. For the project the plugin is written into
// `.agents/plugins/relevo/`; for the machine it is staged and installed with `agy plugin install`, which copies it to
// `~/.gemini/config/plugins/relevo/` (the path the text of the skills already carries, see antigravity.mjs).
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { PLUGIN_NAME, renderAntigravity } from './antigravity.mjs';
import { readSource } from './source.mjs';

export const RECORD = '.relevo-adapter.json';

export const pluginDirFor = ({ scope, root, home }) =>
  scope === 'project' ? join(root, '.agents', 'plugins', PLUGIN_NAME) : join(home, '.gemini', 'config', 'plugins', PLUGIN_NAME);

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

/** { 'relative/path': sha256 } of every file under dir, except the record itself. */
export function hashTree(dir, base = dir) {
  const out = {};
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) Object.assign(out, hashTree(full, base));
    else if (e.name !== RECORD && e.name !== '.DS_Store') out[full.slice(base.length + 1).split('\\').join('/')] = sha(readFileSync(full));
  }
  return out;
}

export function readRecord(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, RECORD), 'utf8'));
  } catch {
    return null;
  }
}

/** The recorded files that are missing or whose content changed since they were written. */
export function editedFiles(dir) {
  const record = readRecord(dir);
  if (!record) return [];
  const now = existsSync(dir) ? hashTree(dir) : {};
  return Object.entries(record.files).filter(([path, hash]) => now[path] !== hash).map(([path]) => path);
}

function writeTree(rendered, { packageRoot, dest }) {
  for (const f of rendered.files) {
    mkdirSync(dirname(join(dest, f.path)), { recursive: true });
    writeFileSync(join(dest, f.path), f.content);
  }
  for (const d of rendered.copy.dirs) cpSync(join(packageRoot, d), join(dest, d), { recursive: true });
  for (const f of rendered.copy.files) if (existsSync(join(packageRoot, f))) cpSync(join(packageRoot, f), join(dest, f));
}

const where = { project: (root) => `.agents/plugins/relevo of ${root}, so commit it to share it`, machine: () => '~/.gemini/config/plugins/relevo, for the IDE, the App and the CLI' };

/**
 * Renders and installs the Antigravity plugin for the scope ('project' | 'machine'). `update` only changes the
 * sentence it prints. A file edited by hand stops it unless `force`. Returns { code, lines }; nothing is changed
 * when it stops before writing.
 */
export function installAntigravity({ packageRoot, scope, root, home, run, has, force = false, update = false }) {
  if (scope === 'machine' && !has('agy')) {
    return { code: 1, lines: ['Antigravity CLI is required for the machine scope and "agy" was not found on the path.', 'Install it from https://antigravity.google/docs/getting-started?tab=cli and run this command again; nothing was changed.'] };
  }
  if (scope === 'project' && !root) return { code: 1, lines: ['The project scope needs a git repository and this folder is not inside one; nothing was changed.', 'Use --scope machine, or run the command inside the repository.'] };
  const dest = pluginDirFor({ scope, root, home });
  const edited = editedFiles(dest);
  if (edited.length && !force) {
    return { code: 1, lines: [`These files of ${dest} were edited by hand and would be overwritten:`, ...edited.map((f) => `  ${f}`), 'Nothing was changed. Run the command again with --force to overwrite them.'] };
  }
  let source;
  try {
    source = readSource(packageRoot);
  } catch (err) {
    return { code: 1, lines: [`Could not read the Relevo package at ${packageRoot}: ${err.message}`] };
  }
  let rendered;
  try {
    rendered = renderAntigravity(source, { pluginDir: dest });
  } catch (err) {
    return { code: 1, lines: [`Could not render the plugin: ${err.message}`, 'Nothing was changed.'] };
  }
  const lines = [];
  const stageRoot = scope === 'machine' ? mkdtempSync(join(tmpdir(), 'relevo-stage-')) : null;
  const target = scope === 'machine' ? join(stageRoot, PLUGIN_NAME) : dest;
  try {
    if (scope === 'project') rmSync(dest, { recursive: true, force: true });
    writeTree(rendered, { packageRoot, dest: target });
    writeFileSync(join(target, RECORD), `${JSON.stringify({ tool: 'antigravity', scope, package: source.version, files: hashTree(target) }, null, 2)}\n`);
    if (scope === 'machine') {
      if (existsSync(dest)) {
        const r = run('agy', ['plugin', 'uninstall', PLUGIN_NAME]);
        if (r.code !== 0) return { code: r.code || 1, lines: [`"agy plugin uninstall ${PLUGIN_NAME}" failed, so the old plugin was kept:`, r.output.trimEnd()] };
      }
      const r = run('agy', ['plugin', 'install', target]);
      if (r.output.trim()) lines.push(r.output.trimEnd());
      if (r.code !== 0) return { code: r.code || 1, lines: [...lines, `"agy plugin install" failed. Fix the cause and run the command again: it is safe to repeat.`] };
      if (!existsSync(join(dest, 'plugin.json'))) {
        return { code: 1, lines: [...lines, `agy installed the plugin, but not in ${dest}, where the commands of the skills point. Nothing else was done; report this with the version of agy.`] };
      }
    }
  } finally {
    if (stageRoot) rmSync(stageRoot, { recursive: true, force: true });
  }
  lines.push(`Antigravity: ${update ? 'updated' : 'installed'} Relevo ${source.version} in ${where[scope](root)}.`, 'Open Antigravity and type /relevo:doctor.');
  return { code: 0, lines };
}

/** What doctor needs about each rendered plugin: { scope, dir, package, edited, missing }. */
export function adapterFacts({ root, home }) {
  return findRecords({ root, home }).map(({ scope, dir, record }) => {
    const now = hashTree(dir);
    const missing = Object.keys(record.files).filter((p) => !(p in now));
    const edited = Object.entries(record.files).filter(([p, h]) => p in now && now[p] !== h).map(([p]) => p);
    return { scope, dir, package: record.package, edited, missing };
  });
}

/** The rendered plugins that exist for this repository and this machine: [{ scope, dir, record }]. */
export function findRecords({ root, home }) {
  return ['project', 'machine']
    .filter((scope) => scope === 'machine' || root)
    .map((scope) => ({ scope, dir: pluginDirFor({ scope, root, home }) }))
    .map((x) => ({ ...x, record: readRecord(x.dir) }))
    .filter((x) => x.record?.tool === 'antigravity');
}
