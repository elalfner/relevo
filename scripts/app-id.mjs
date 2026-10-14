#!/usr/bin/env node
// Prints the Android application id of the project (from android/app/build.gradle.kts or build.gradle).
//   exit 0: printed   exit 2: not found (the log audit then covers the whole log)

import { existsSync, readFileSync } from 'node:fs';
import { applicationId } from './lib/appid.mjs';

const dir = process.argv[2] ?? 'android/app';
for (const name of ['build.gradle.kts', 'build.gradle']) {
  const path = `${dir}/${name}`;
  if (!existsSync(path)) continue;
  const id = applicationId(readFileSync(path, 'utf8'));
  if (id) {
    console.log(id);
    process.exit(0);
  }
}
console.error(`no applicationId found in ${dir}/build.gradle(.kts)`);
process.exit(2);
