import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureIos, formatLogStart, iosLogArgs, listSimulators, parseSimulators, pickSimulator, readIosLog } from '../scripts/lib/device-ios.mjs';

const RT = 'com.apple.CoreSimulator.SimRuntime.iOS-27-1';
const listing = (...devices) => JSON.stringify({ devices: { [RT]: devices } });
const phone = (udid, name, state = 'Booted') => ({ udid, name, state, isAvailable: true });
const UDID = '4108DF9A-83E1-443C-9E87-982F6AB9439C';

test('Scenario: One simulator is booted - it is parsed and picked', () => {
  const sims = parseSimulators(listing(phone(UDID, 'iPhone 17')));
  assert.deepEqual(sims, [{ udid: UDID, name: 'iPhone 17', runtime: RT, state: 'Booted' }]);
  assert.equal(pickSimulator(sims), UDID);
});

test('Scenario: None is booted - the message says to boot one, and nothing is booted by the script', () => {
  assert.deepEqual(parseSimulators(listing()), []);
  assert.throws(() => pickSimulator([]), /no iOS simulator is booted.*Simulator app.*simctl boot/);
  assert.throws(() => pickSimulator([{ udid: UDID, name: 'iPhone 17', runtime: RT, state: 'Shutdown' }]), /no iOS simulator is booted/);
});

test('Scenario: Several are booted - it names both and asks for IOS_SIMULATOR', () => {
  const sims = parseSimulators(listing(phone(UDID, 'iPhone 17'), phone('AAAA', 'iPhone Air')));
  assert.throws(() => pickSimulator(sims), /several simulators are booted \(iPhone 17 4108.*iPhone Air AAAA\).*IOS_SIMULATOR/);
});

test('Scenario: The named simulator - by UDID or by name, and not when it is not booted', () => {
  const sims = parseSimulators(listing(phone(UDID, 'iPhone 17'), phone('AAAA', 'iPhone Air'), phone('BBBB', 'iPhone 16', 'Shutdown')));
  assert.equal(pickSimulator(sims, 'AAAA'), 'AAAA');
  assert.equal(pickSimulator(sims, 'iPhone 17'), UDID);
  assert.throws(() => pickSimulator(sims, 'BBBB'), /BBBB is not booted/);
  assert.throws(() => pickSimulator(sims, 'iPhone 99'), /not booted/);
  const twins = parseSimulators(listing(phone('A1', 'iPhone 17'), phone('A2', 'iPhone 17')));
  assert.throws(() => pickSimulator(twins, 'iPhone 17'), /several booted simulators are named "iPhone 17".*A1, A2/);
});

test('a list that cannot be read is reported', () => {
  assert.throws(() => parseSimulators('not json'), /could not be read/);
  assert.deepEqual(parseSimulators({}), []);
});

test('the list is read through the injected client with the booted filter', () => {
  const calls = [];
  const xcrun = (args) => {
    calls.push(args);
    return listing(phone(UDID, 'iPhone 17'));
  };
  assert.equal(listSimulators(xcrun)[0].udid, UDID);
  assert.deepEqual(calls[0], ['simctl', 'list', 'devices', 'booted', '--json']);
});

test('Scenario: A capture is requested - simctl writes the file and the agent does not open it', () => {
  const calls = [];
  const xcrun = (args) => calls.push(args);
  const made = [];
  const path = captureIos({ xcrun, name: '02_after_tap', dir: 'evidence', udid: UDID, mkdir: (d) => made.push(d), size: () => 4096 });
  assert.equal(path, join('evidence', '02_after_tap.png'));
  assert.deepEqual(calls[0], ['simctl', 'io', UDID, 'screenshot', join('evidence', '02_after_tap.png')]);
  assert.deepEqual(made, ['evidence']);
});

test('Scenario: A bad name - refused before simctl runs', () => {
  let ran = false;
  const xcrun = () => {
    ran = true;
  };
  for (const bad of ['../x', 'a/b', '', '..']) {
    assert.throws(() => captureIos({ xcrun, name: bad, udid: UDID, mkdir: () => {}, size: () => 9 }), /capture names may use letters/);
  }
  assert.equal(ran, false);
});

test('Scenario: The simulator returns nothing - an error and an empty file are both reported', () => {
  const boom = () => {
    const e = new Error('Command failed');
    e.stderr = 'Invalid argument\n';
    throw e;
  };
  assert.throws(() => captureIos({ xcrun: boom, name: 'a', udid: UDID, mkdir: () => {}, size: () => 9 }), /produced no image: Invalid argument/);
  assert.throws(() => captureIos({ xcrun: () => {}, name: 'a', udid: UDID, mkdir: () => {}, size: () => 0 }), /produced no image; is it booted/);
  assert.throws(() => captureIos({ xcrun: () => {}, name: 'a', udid: UDID, mkdir: () => {}, size: () => { throw new Error('ENOENT'); } }), /produced no image/);
});

test('the log arguments filter by process, read ndjson and start at a local time', () => {
  assert.deepEqual(iosLogArgs({ udid: UDID, since: '2026-11-17 09:16:39', processName: 'OMBMaqueta' }), [
    'simctl', 'spawn', UDID, 'log', 'show', '--style', 'ndjson', '--start', '2026-11-17 09:16:39', '--predicate', 'process == "OMBMaqueta"',
  ]);
  assert.throws(() => iosLogArgs({ udid: UDID, since: '2026-11-17 09:16:39', processName: 'a" OR 1==1 OR "b' }), /process name/);
  assert.throws(() => iosLogArgs({ udid: UDID, since: 'yesterday', processName: 'OMB' }), /start time/);
});

test('the start time is written in local time with two digits', () => {
  assert.equal(formatLogStart(new Date(2026, 10, 7, 9, 5, 3)), '2026-11-07 09:05:03');
});

test('the log is read through the injected client, and a failure says it could not be read', () => {
  const calls = [];
  const text = readIosLog({ xcrun: (a) => (calls.push(a), '{"messageType":"Default"}\n'), udid: UDID, since: '2026-11-17 09:16:39', processName: 'OMB' });
  assert.match(text, /Default/);
  assert.equal(calls[0][0], 'simctl');
  const boom = () => {
    const e = new Error('Command failed');
    e.status = 148;
    e.stderr = 'No devices are booted.\n';
    throw e;
  };
  assert.throws(() => readIosLog({ xcrun: boom, udid: UDID, since: '2026-11-17 09:16:39', processName: 'OMB' }), /could not be read: No devices are booted/);
  assert.throws(() => readIosLog({ xcrun: boom, udid: UDID, since: 'x', processName: 'OMB' }), /start time/);
});

// The scripts, run with a fake xcrun first in the PATH.
function fakeXcrun(listJson) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-xcrun-'));
  const script = `#!/bin/sh
if [ "$1" = "simctl" ] && [ "$2" = "list" ]; then cat <<'EOF'
${listJson}
EOF
exit 0; fi
if [ "$1" = "simctl" ] && [ "$2" = "io" ]; then printf 'PNG-DATA-0123456789' > "$5"; exit 0; fi
exit 1
`;
  writeFileSync(join(dir, 'xcrun'), script);
  chmodSync(join(dir, 'xcrun'), 0o755);
  return dir;
}
const SCRIPTS = new URL('../scripts/', import.meta.url).pathname;
const run = (file, args, { bin, env = {}, cwd } = {}) =>
  spawnSync('node', [join(SCRIPTS, file), ...args], { encoding: 'utf8', cwd, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, ...env } });

test('device.mjs --target ios prints the UDID, and explains when none is booted', () => {
  const ok = run('device.mjs', ['--target', 'ios'], { bin: fakeXcrun(listing(phone(UDID, 'iPhone 17'))) });
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(ok.stdout.trim(), UDID);
  const none = run('device.mjs', ['--target', 'ios'], { bin: fakeXcrun(listing()) });
  assert.equal(none.status, 2);
  assert.match(none.stderr, /no iOS simulator is booted/);
  const bad = run('device.mjs', ['--target', 'watch'], { bin: fakeXcrun(listing()) });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /unknown target/);
});

test('capture.mjs --target ios writes evidence/<name>.png, and IOS_SIMULATOR picks one', () => {
  const bin = fakeXcrun(listing(phone(UDID, 'iPhone 17'), phone('AAAA', 'iPhone Air')));
  const cwd = mkdtempSync(join(tmpdir(), 'relevo-cap-'));
  const several = run('capture.mjs', ['s1', '--target', 'ios'], { bin, cwd });
  assert.equal(several.status, 2);
  assert.match(several.stderr, /several simulators are booted/);
  const ok = run('capture.mjs', ['s1', '--target', 'ios'], { bin, cwd, env: { IOS_SIMULATOR: 'iPhone Air' } });
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(ok.stdout.trim(), join('evidence', 's1.png'));
  assert.ok(existsSync(join(cwd, 'evidence', 's1.png')));
  assert.match(readFileSync(join(cwd, 'evidence', 's1.png'), 'utf8'), /PNG-DATA/);
  const bad = run('capture.mjs', ['../x', '--target', 'ios'], { bin, cwd });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /capture names may use letters/);
});

// review-state.mjs with an iOS review: init, reset-log, sync and audit through the CLI and a fake xcrun.
test('review-state.mjs --target ios: autopilot is forced off, the log source is recorded, audit reads the fake log', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-rs-ios-'));
  mkdirSync(join(dir, 'change', 'specs', 'cap'), { recursive: true });
  writeFileSync(join(dir, 'change', 'specs', 'cap', 'spec.md'), '## ADDED Requirements\n### Requirement: A\n#### Scenario: One\n- **WHEN** a\n- **THEN** b\n');
  const bin = fakeXcrun(listing(phone(UDID, 'iPhone 17')));
  // A fake that also answers the log read with one Fault.
  writeFileSync(join(bin, 'xcrun'), readFileSync(join(bin, 'xcrun'), 'utf8').replace('exit 1\n', `if [ "$1" = "simctl" ] && [ "$2" = "spawn" ]; then echo '{"messageType":"Fault","subsystem":"com.apple.runtime-issues","eventMessage":"bad"}'; exit 0; fi\nexit 1\n`));
  const state = join(dir, 'evidence', 'review-state.json');
  const cli = (...args) => run('review-state.mjs', [...args, '--state', state], { bin });
  assert.equal(cli('init', join(dir, 'change'), '--target', 'ios').status, 2);
  const init = cli('init', join(dir, 'change'), '--autopilot', 'verify', '--target', 'ios', '--process', 'OMB');
  assert.equal(init.status, 0, init.stderr);
  const saved = () => JSON.parse(readFileSync(state, 'utf8'));
  assert.equal(saved().autopilot, 'off');
  assert.deepEqual([saved().source.source, saved().source.udid, saved().source.process], ['simulator', UDID, 'OMB']);
  const edited = saved();
  edited.source.since = '2000-01-01 00:00:00';
  writeFileSync(state, JSON.stringify(edited));
  assert.equal(cli('reset-log').status, 0);
  assert.notEqual(saved().source.since, '2000-01-01 00:00:00');
  writeFileSync(state, JSON.stringify(edited));
  assert.equal(cli('sync', join(dir, 'change')).status, 0);
  assert.notEqual(saved().source.since, '2000-01-01 00:00:00');
  const audit = cli('audit');
  assert.match(audit.stdout, /REVIEW REJECTED/);
  assert.equal(saved().audit.findings[0].class, 'fault');
});
