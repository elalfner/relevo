#!/usr/bin/env node
// Finds the Android device to review on. Prints its serial, or explains what is wrong.
//   exit 0: a device was found   exit 2: none, unauthorised or several (ANDROID_SERIAL picks one)

import { listDevices, pickDevice } from './lib/device.mjs';

try {
  console.log(pickDevice(listDevices(), process.env.ANDROID_SERIAL ?? null));
} catch (err) {
  console.error(err.code === 'ENOENT' ? 'adb is not installed: install the Android platform tools' : err.message);
  process.exit(2);
}
