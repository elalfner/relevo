import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

// `openspec archive` writes a placeholder Purpose for a capability it creates from a delta with no `## Purpose`.
// Nothing later rewrites it (a delta's Purpose is read only at creation), so the placeholder stays unless a person edits the main spec.
const root = new URL('../openspec/specs/', import.meta.url).pathname;
const capabilities = readdirSync(root).filter((c) => existsSync(`${root}${c}/spec.md`));

test('every main specification says what its capability is for', () => {
  assert.ok(capabilities.length > 0);
  for (const c of capabilities) {
    const text = readFileSync(`${root}${c}/spec.md`, 'utf8');
    const purpose = /^## Purpose\n([\s\S]*?)^## /m.exec(text)?.[1].trim() ?? '';
    assert.ok(purpose.length > 0, `${c} has a Purpose section`);
    assert.ok(!/^TBD\b/i.test(purpose), `${c}: write its Purpose in the main spec (the archive left a placeholder)`);
  }
});
