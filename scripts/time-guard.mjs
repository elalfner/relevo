#!/usr/bin/env node
// The PreToolUse hook of the plugin (Claude Code `hooks/hooks.json` and Antigravity root `hooks.json`). It reads the
// call from stdin and refuses two things of a running build: the launch of a Relevo agent after the minutes limit, and
// any call of a subagent (other than `send_message` in Antigravity) after the hard stop. The calls of the orchestrator,
// other than a launch, pass: it has to keep the work and report. Implements "A subagent past the hard stop is made to
// end", "An agent launch after the limit is refused" and "The time guard acts only inside a running build" of the go
// specification, plus native Antigravity PreToolUse enforcement of agent-adapters.
//
// It runs in every session where the plugin is enabled, so without a running build it says nothing. It never allows
// (note: on agy 1.5.18 printing `{}` denies, whereas empty stdout allows) and never changes a call, and any error is
// silence: exit 0 always.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectFormat, formatDenial, isAntigravityLaunch, refusal } from './lib/time-guard.mjs';
import { runClock } from './lib/time-limit.mjs';
import { progressDir } from './lib/worktree-path.mjs';
import { loadConfig } from './lib/config.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const ORCHESTRATOR_FILE = 'orchestrator-id.txt';

try {
  const call = JSON.parse(readFileSync(0, 'utf8'));
  const format = detectFormat(call);
  if (format) {
    const cwd = typeof call?.cwd === 'string' ? call.cwd : process.cwd();
    const dir = progressDir({ cwd });
    if (dir) {
      let fallbackMinutes = null;
      try {
        const loaded = loadConfig(readFileSync(join(cwd, 'relevo.yml'), 'utf8'));
        fallbackMinutes = loaded.ok ? loaded.config.limits?.run_max_minutes ?? null : null;
      } catch {
        fallbackMinutes = null;
      }
      let orchestratorId = null;
      if (format === 'antigravity') {
        const idFile = join(dir, ORCHESTRATOR_FILE);
        if (isAntigravityLaunch(call) && typeof call.conversationId === 'string' && call.conversationId !== '') {
          orchestratorId = call.conversationId;
          try {
            writeFileSync(idFile, `${orchestratorId}\n`);
          } catch {
            // Best effort only.
          }
        } else {
          try {
            orchestratorId = readFileSync(idFile, 'utf8').trim() || null;
          } catch {
            orchestratorId = null;
          }
        }
      }
      const reason = refusal(call, runClock({ dir, fallbackMinutes }), Date.now(), { orchestratorId });
      if (reason) console.log(JSON.stringify(formatDenial(format, reason)));
    }
  }
} catch {
  // The guard stops a call only on what it can read.
}
