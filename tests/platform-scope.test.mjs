import test from 'node:test';
import assert from 'node:assert/strict';
import { checkScope } from '../scripts/lib/platform-scope.mjs';
import { formatViolations } from '../scripts/lib/protected-paths.mjs';

const WEB = { within: 'apps/web', change: '12-header' };
const bad = (paths, opts = WEB) => checkScope(paths, opts).violations.map((v) => v.path);

test('Scenario: Front issue touches the back - a file in another platform is outside', () => {
  assert.deepEqual(bad(['apps/api/app/User.php', 'apps/web/src/Header.vue']), ['apps/api/app/User.php']);
  assert.equal(checkScope(['apps/api/a.php'], WEB).violations[0].tier, 'scope');
});

test('the folder of the platform, the change specification, GLOSSARY.md and docs/adr are always allowed', () => {
  assert.deepEqual(bad(['apps/web/a.vue', 'apps/web/deep/b.vue', 'openspec/changes/12-header/tasks.md', 'openspec/changes/12-header', 'GLOSSARY.md', 'docs/adr/0003-x.md']), []);
});

test('the specification of another change is not allowed', () => {
  assert.deepEqual(bad(['openspec/changes/99-other/tasks.md']), ['openspec/changes/99-other/tasks.md']);
  assert.deepEqual(bad(['openspec/changes/12-header/tasks.md'], { within: 'apps/web' }), ['openspec/changes/12-header/tasks.md'], 'without the change id nothing under openspec is shared');
});

test('a folder that only starts with the same letters is outside (apps/web2 is not apps/web)', () => {
  assert.deepEqual(bad(['apps/web2/a.vue']), ['apps/web2/a.vue']);
});

test('Scenario: Shared package authorized - a path matching Allow-paths is accepted', () => {
  assert.deepEqual(bad(['packages/shared/a.ts'], { ...WEB, allow: ['packages/shared/**'] }), []);
  assert.deepEqual(bad(['packages/other/a.ts'], { ...WEB, allow: ['packages/shared/**'] }), ['packages/other/a.ts']);
});

test('Scenario: Whole repository platform - a folder of . or nothing is not restricted', () => {
  assert.deepEqual(bad(['anything/at/all.dart'], { within: '.' }), []);
  assert.deepEqual(bad(['anything/at/all.dart'], { within: '' }), []);
  assert.deepEqual(bad(['anything/at/all.dart'], {}), []);
});

test('paths are cleaned the way git prints them, and the report tells what to do', () => {
  assert.deepEqual(bad(['./apps/web/a.vue', 'apps\\web\\b.vue']), []);
  const text = formatViolations(checkScope(['apps/api/a.php'], WEB).violations);
  assert.match(text, /apps\/api\/a\.php {2}outside the platform \(apps\/web\)/);
  assert.match(text, /Allow-paths:/);
});
