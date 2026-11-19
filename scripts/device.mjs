#!/usr/bin/env node
// Finds the device to review on. Prints its serial (Android) or its UDID (iOS Simulator), or explains what is wrong.
//   node scripts/device.mjs [--target ios]
//   exit 0: a device was found   exit 2: none, unauthorised or several
//   Android: ANDROID_SERIAL picks one. iOS: IOS_SIMULATOR picks one (a UDID or a name); no simulator is ever booted by this script.

import { listDevices, pickDevice } from './lib/device.mjs';
import { listSimulators, pickSimulator } from './lib/device-ios.mjs';

const ti = process.argv.indexOf('--target');
const target = ti === -1 ? 'android' : process.argv[ti + 1];
if (target !== 'android' && target !== 'ios') {
  console.error(`unknown target "${target}": use android or ios`);
  process.exit(2);
}

try {
  console.log(target === 'ios' ? pickSimulator(listSimulators(), process.env.IOS_SIMULATOR ?? null) : pickDevice(listDevices(), process.env.ANDROID_SERIAL ?? null));
} catch (err) {
  const missing = target === 'ios' ? 'xcrun is not installed: the iOS review needs macOS with Xcode and its command line tools' : 'adb is not installed: install the Android platform tools';
  console.error(err.code === 'ENOENT' ? missing : err.message);
  process.exit(2);
}
