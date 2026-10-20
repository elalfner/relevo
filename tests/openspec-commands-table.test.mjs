import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowed, NEVER, OPENSPEC_COMMANDS, openspecSubcommand } from '../scripts/lib/openspec-commands.mjs';

test('commands are normalised to the form used by the table', () => {
  assert.equal(openspecSubcommand(['--version']), '--version');
  assert.equal(openspecSubcommand(['list', '--json']), 'list');
  assert.equal(openspecSubcommand(['new', 'change', '"x"', '--description', 'y']), 'new change');
  assert.equal(openspecSubcommand(['status', '--change', 'x', '--json']), 'status');
  assert.equal(openspecSubcommand(['instructions', 'apply', '--change', 'x']), 'instructions apply');
  assert.equal(openspecSubcommand(['instructions', 'specs', '--change', 'x']), 'instructions <artifact>');
  assert.equal(openspecSubcommand(['instructions', '<artifact>', '--change', 'x']), 'instructions <artifact>');
  assert.equal(openspecSubcommand(['instructions', 'archive']), 'instructions archive');
  assert.equal(openspecSubcommand([]), null);
});

test('Scenario: A skill or agent uses a command outside its list - go may create a change, dev and qa may only read', () => {
  assert.equal(isAllowed('go', ['new', 'change', 'x']), true);
  assert.equal(isAllowed('go', ['validate', 'x']), true);
  assert.equal(isAllowed('dev', ['instructions', 'apply', '--change', 'x']), true);
  assert.equal(isAllowed('dev', ['new', 'change', 'x']), false);
  assert.equal(isAllowed('qa', ['validate', 'x']), false);
  assert.equal(isAllowed('qa', []), false);
  assert.equal(isAllowed('fix', ['list']), false, 'a part with no list may use nothing');
  assert.equal(isAllowed('review', ['list']), true);
  assert.equal(isAllowed('review', ['validate', 'x']), false);
});

test('nothing on any list is a command no unattended run may use', () => {
  Object.entries(OPENSPEC_COMMANDS).forEach(([part, list]) => {
    list.forEach((command) => assert.ok(!NEVER.includes(command.split(' ')[0]), `${part} lists ${command}`));
  });
  ['init', 'archive', 'update', 'sync'].forEach((sub) => assert.equal(isAllowed('go', [sub]), false, sub));
  assert.equal(isAllowed('go', ['instructions', 'archive']), false, 'instructions for archive belong to ship');
});
