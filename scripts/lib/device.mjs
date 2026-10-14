// Android device detection and screenshot capture. The adb client is injected so this can be tested
// without a device. Screenshots are only written to disk, never opened or sent anywhere.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

/** Parse the output of `adb devices` into [{ serial, state }]. */
export function parseDevices(output) {
  return String(output)
    .split('\n')
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('*'))
    .map((l) => {
      const [serial, state] = l.split(/\s+/);
      return { serial, state };
    });
}

/** Pick the device to use: the only ready one, or the one named in `preferred`. Throws a message a person can act on. */
export function pickDevice(devices, preferred = null) {
  const ready = devices.filter((d) => d.state === 'device');
  if (preferred) {
    if (ready.some((d) => d.serial === preferred)) return preferred;
    throw new Error(`device ${preferred} is not connected and ready`);
  }
  if (ready.length === 1) return ready[0].serial;
  if (ready.length === 0) {
    const stuck = devices.find((d) => d.state === 'unauthorized');
    throw new Error(
      stuck
        ? 'the device is connected but unauthorised: unlock it and accept the USB debugging prompt'
        : 'no device is connected: connect an Android device with USB debugging enabled (run `adb devices` to check)',
    );
  }
  throw new Error(`several devices are connected (${ready.map((d) => d.serial).join(', ')}): set ANDROID_SERIAL to the one to use`);
}

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,60}$/;

/** Capture names come from a person: only plain file names are accepted, never paths. */
export function safeCaptureName(name) {
  const n = String(name ?? '').replace(/\.png$/i, '');
  if (!NAME_RE.test(n) || n.includes('..')) {
    throw new Error('capture names may use letters, digits, "_", "-" and "." only (for example 02_after_tap)');
  }
  return n;
}

export const realAdb = (args, options = {}) => execFileSync('adb', args, { maxBuffer: 64 * 1024 * 1024, ...options });

/** List devices through the injected client. */
export function listDevices(adb = realAdb) {
  return parseDevices(adb(['devices'], { encoding: 'utf8' }));
}

/** Take a screenshot and save it as <dir>/<name>.png. Returns the path. */
export function capture({ adb = realAdb, name, dir = 'evidence', serial, write = writeFileSync, mkdir = mkdirSync }) {
  const safe = safeCaptureName(name);
  const png = adb(['-s', serial, 'exec-out', 'screencap', '-p']);
  if (!png || png.length < 8) throw new Error('the device returned no image; is the screen on and the device unlocked?');
  mkdir(dir, { recursive: true });
  const path = join(dir, `${safe}.png`);
  write(path, png);
  return path;
}
