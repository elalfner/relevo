#!/usr/bin/env node
// Takes a screenshot of the device and saves it as evidence/<name>.png. Never opens the image.
//   node scripts/capture.mjs <name> [--dir evidence] [--target ios]
// Names are plain file names (letters, digits, "_", "-", "."), never paths.
// --target ios takes the capture from the booted iOS Simulator (IOS_SIMULATOR picks one when several are booted).

import { capture, listDevices, pickDevice, safeCaptureName } from './lib/device.mjs';
import { captureIos, listSimulators, pickSimulator } from './lib/device-ios.mjs';

const name = process.argv[2];
const di = process.argv.indexOf('--dir');
const dir = di === -1 ? 'evidence' : process.argv[di + 1];
const ti = process.argv.indexOf('--target');
const target = ti === -1 ? 'android' : process.argv[ti + 1];
if (!name || name.startsWith('--') || (target !== 'android' && target !== 'ios')) {
  console.error('usage: capture.mjs <name> [--dir evidence] [--target ios]');
  process.exit(2);
}
try {
  safeCaptureName(name); // a bad name is refused before adb or xcrun is run
  if (target === 'ios') {
    const udid = pickSimulator(listSimulators(), process.env.IOS_SIMULATOR ?? null);
    console.log(captureIos({ name, dir, udid }));
  } else {
    const serial = pickDevice(listDevices(), process.env.ANDROID_SERIAL ?? null);
    console.log(capture({ name, dir, serial }));
  }
} catch (err) {
  const missing = target === 'ios' ? 'xcrun is not installed: the iOS review needs macOS with Xcode and its command line tools' : 'adb is not installed: install the Android platform tools';
  console.error(err.code === 'ENOENT' ? missing : err.message);
  process.exit(2);
}
