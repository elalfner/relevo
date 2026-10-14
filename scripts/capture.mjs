#!/usr/bin/env node
// Takes a screenshot of the device and saves it as evidence/<name>.png. Never opens the image.
//   node scripts/capture.mjs <name> [--dir evidence]
// Names are plain file names (letters, digits, "_", "-", "."), never paths.

import { capture, listDevices, pickDevice } from './lib/device.mjs';

const name = process.argv[2];
const di = process.argv.indexOf('--dir');
const dir = di === -1 ? 'evidence' : process.argv[di + 1];
if (!name || name.startsWith('--')) {
  console.error('usage: capture.mjs <name> [--dir evidence]');
  process.exit(2);
}
try {
  const serial = pickDevice(listDevices(), process.env.ANDROID_SERIAL ?? null);
  console.log(capture({ name, dir, serial }));
} catch (err) {
  console.error(err.code === 'ENOENT' ? 'adb is not installed: install the Android platform tools' : err.message);
  process.exit(2);
}
