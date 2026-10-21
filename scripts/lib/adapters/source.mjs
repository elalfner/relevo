// Reads what Relevo is made of, in Claude Code's format, so that a renderer can write it for another tool. Nothing is
// written here and nothing is interpreted beyond the frontmatter: a renderer decides what to change.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '../yaml-lite.mjs';

/** { head, body }: the frontmatter text (no fences) and what follows it; head is null when there is none. */
export function splitFrontmatter(text) {
  const m = String(text).replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  return m ? { head: m[1], body: m[2] } : { head: null, body: String(text) };
}

const walk = (dir, base = dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return walk(full, base);
    return [full.slice(base.length + 1).split('\\').join('/')];
  });

const isDir = (p) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/**
 * { version, manifest, skills, agents } read from a Relevo checkout or an installed package.
 * skill: { name, meta, body, files: [{ path, content }] }  (files are everything beside SKILL.md, text only)
 * agent: { name, meta, body }
 */
export function readSource(root) {
  const manifest = JSON.parse(readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

  const skillsDir = join(root, 'skills');
  const skills = readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .map((name) => {
      const dir = join(skillsDir, name);
      const { head, body } = splitFrontmatter(readFileSync(join(dir, 'SKILL.md'), 'utf8'));
      if (head === null) throw new Error(`skills/${name}/SKILL.md has no frontmatter`);
      const files = walk(dir)
        .filter((f) => f !== 'SKILL.md')
        .map((path) => ({ path, content: readFileSync(join(dir, path), 'utf8') }));
      return { name, meta: parse(head), body, files };
    });

  const agentsDir = join(root, 'agents');
  const agents = !isDir(agentsDir)
    ? []
    : readdirSync(agentsDir)
        .filter((f) => f.endsWith('.md'))
        .sort()
        .map((f) => {
          const { head, body } = splitFrontmatter(readFileSync(join(agentsDir, f), 'utf8'));
          if (head === null) throw new Error(`agents/${f} has no frontmatter`);
          return { name: f.slice(0, -3), meta: parse(head), body };
        });

  return { version, manifest, skills, agents };
}
