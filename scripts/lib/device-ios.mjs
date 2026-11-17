// iOS Simulator detection, screenshot capture and log reading. The xcrun client is injected so this can be tested
// without a simulator. Screenshots are only written to disk, never opened or sent anywhere.
// Implements "An iOS review chooses its simulator" and "An iOS review takes captures from the simulator" of
// openspec/changes/ios-review-adapter/specs/review/spec.md.

import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { safeCaptureName } from './device.mjs';

export const realXcrun = (args, options = {}) => execFileSync('xcrun', args, { maxBuffer: 64 * 1024 * 1024, ...options });

const firstLine = (text) => String(text ?? '').split('\n').map((l) => l.trim()).find((l) => l) ?? 'no detail';

/** Parse `xcrun simctl list devices booted --json` into [{ udid, name, runtime, state }]. */
export function parseSimulators(json) {
  let data;
  try {
    data = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    throw new Error('simctl returned a list of simulators that could not be read');
  }
  const out = [];
  for (const [runtime, devices] of Object.entries(data?.devices ?? {})) {
    for (const d of Array.isArray(devices) ? devices : []) out.push({ udid: d.udid, name: d.name, runtime, state: d.state });
  }
  return out;
}

/**
 * Pick the simulator to use: the only booted one, or the one named in `preferred` (a UDID or a name).
 * Throws a message a person can act on. Never boots a simulator.
 */
export function pickSimulator(simulators, preferred = null) {
  const booted = simulators.filter((s) => s.state === 'Booted');
  if (preferred) {
    const match = booted.filter((s) => s.udid === preferred || s.name === preferred);
    if (match.length === 1) return match[0].udid;
    if (match.length > 1) {
      throw new Error(`several booted simulators are named "${preferred}" (${match.map((s) => s.udid).join(', ')}): set IOS_SIMULATOR to a UDID`);
    }
    throw new Error(`the simulator ${preferred} is not booted: boot it (open the Simulator app, or run \`xcrun simctl boot <udid>\`) or unset IOS_SIMULATOR`);
  }
  if (booted.length === 1) return booted[0].udid;
  if (booted.length === 0) {
    throw new Error('no iOS simulator is booted: boot one (open the Simulator app, or run `xcrun simctl boot <udid>`; `xcrun simctl list devices available` lists them)');
  }
  throw new Error(`several simulators are booted (${booted.map((s) => `${s.name} ${s.udid}`).join(', ')}): set IOS_SIMULATOR to the one to use`);
}

/** List the booted simulators through the injected client. */
export function listSimulators(xcrun = realXcrun) {
  return parseSimulators(xcrun(['simctl', 'list', 'devices', 'booted', '--json'], { encoding: 'utf8' }));
}

/** Take a screenshot into <dir>/<name>.png with simctl writing the file. Returns the path. */
export function captureIos({ xcrun = realXcrun, name, dir = 'evidence', udid, mkdir = mkdirSync, size = (p) => statSync(p).size }) {
  const safe = safeCaptureName(name);
  mkdir(dir, { recursive: true });
  const path = join(dir, `${safe}.png`);
  try {
    xcrun(['simctl', 'io', udid, 'screenshot', path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    throw new Error(`the simulator produced no image: ${firstLine(err.stderr || err.message)}`);
  }
  let bytes = 0;
  try {
    bytes = size(path);
  } catch {
    bytes = 0;
  }
  if (bytes < 8) throw new Error('the simulator produced no image; is it booted and its screen on?');
  return path;
}

// The process name goes into a log predicate: only plain executable names are accepted.
const PROCESS_RE = /^[A-Za-z0-9][A-Za-z0-9_. -]{0,79}$/;

/** `YYYY-MM-DD HH:MM:SS` in the local time of this machine, the form `log show --start` reads. */
export function formatLogStart(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

/** The xcrun arguments that read the log of one app since a time, as ndjson. */
export function iosLogArgs({ udid, since, processName }) {
  if (!PROCESS_RE.test(String(processName ?? ''))) throw new Error('the process name of the app has characters that a log filter does not accept');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(since ?? ''))) throw new Error('the start time must look like 2026-11-17 09:16:39 (local time)');
  return ['simctl', 'spawn', udid, 'log', 'show', '--style', 'ndjson', '--start', since, '--predicate', `process == "${processName}"`];
}

/** Read the log of the app since a time. Returns the raw text; the audit skips what is not an entry. */
export function readIosLog({ xcrun = realXcrun, udid, since, processName }) {
  try {
    return String(xcrun(iosLogArgs({ udid, since, processName }), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch (err) {
    if (/filter|process name|start time/.test(err.message) && !err.status) throw err;
    throw new Error(`the log of the simulator could not be read: ${firstLine(err.stderr || err.message)}`);
  }
}
