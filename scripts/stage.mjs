#!/usr/bin/env node
// Stages the named files, and nothing else. Usage: node scripts/stage.mjs path [path ...]
// Refuses ".", "-A" and similar: every commit must name the files it includes.

import { execFileSync } from 'node:child_process';
import { explicitStageArgs } from './lib/staging.mjs';

try {
  const args = explicitStageArgs(process.argv.slice(2));
  execFileSync('git', args, { stdio: 'inherit' });
} catch (err) {
  console.error(err.message);
  process.exit(2);
}
