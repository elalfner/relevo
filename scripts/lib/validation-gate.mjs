// The gate that runs the checks which need no judgement, once, in a script. Implements the validation-gate specification.
// The receipt it writes proves that the checks ran on a given diff; it guards against an omission or a mistake and is not a
// defence against an agent that writes a false file (the guards of the commit remain the enforcement).

import { createHash } from 'node:crypto';

export const RECEIPT_DIR = '.relevo-receipt';
export const RECEIPT_FILE = 'receipt.json';
/** The most characters of a command's output that a receipt keeps (its end, where failures are). */
export const TAIL_CAP = 4000;
export const STATUSES = ['green', 'red', 'could-not-run'];
export const EXIT = { green: 0, red: 1, 'could-not-run': 2, usage: 3 };

/** The hash of a diff, as a lowercase hex string. */
export const diffHash = (diffText) => createHash('sha256').update(String(diffText ?? ''), 'utf8').digest('hex');

/** The last `cap` characters of an output, with a marker that says how much was left out. */
export function tailOf(text, cap = TAIL_CAP) {
  const s = String(text ?? '');
  if (s.length <= cap) return s;
  return `[... output truncated: ${s.length - cap} characters omitted ...]\n${s.slice(s.length - cap)}`;
}

/** The pathspec arguments that leave the generated files of the profile out of the diff. */
export const excludeSpecs = (generated = []) => generated.map((g) => `:(exclude)${g}`);

/** The tool a command starts with, for the message of a command that cannot start. */
export function toolOf(command) {
  const words = String(command).replace(/^\s*(?:\w+=\S+\s+)*/, '').split(/\s+/).filter(Boolean);
  const first = words[0] === 'npx' ? words.find((w, i) => i > 0 && !w.startsWith('-')) ?? 'npx' : words[0];
  return first ?? '';
}

/**
 * Did a command fail to start, as opposed to run and fail? The shell exits 126 or 127 for a command it cannot execute or
 * find, and npx reports a missing package with its own text.
 */
export function couldNotStart(result) {
  if (result.error) return true;
  if (result.status === 126 || result.status === 127) return true;
  return /command not found|not found: |ENOENT|is not recognized as an internal|could not determine executable to run|npm error 404/i.test(String(result.output ?? '').slice(-1500)) && result.status !== 0 && result.status !== 1;
}

/**
 * The status from the results of the commands and of the scans.
 * commands: [{ name, command, status (exit code), output, error? }], scans: [{ name, ok, detail }]
 */
export function overallStatus(commands, scans) {
  if (commands.some((c) => couldNotStart(c))) return 'could-not-run';
  if (commands.some((c) => c.status !== 0) || scans.some((s) => !s.ok)) return 'red';
  return 'green';
}

/** The receipt, from what the gate measured. */
export function buildReceipt({ hash, base, baseRef, generated, platformPath, commands, scans, status, now = new Date() }) {
  return {
    version: 1,
    created_at: now.toISOString(),
    hash,
    base_commit: base,
    base_ref: baseRef,
    generated,
    platform_path: platformPath,
    status,
    commands: commands.map((c) => ({ name: c.name, command: c.command, exit_code: c.status ?? null, duration_ms: c.duration_ms ?? 0, ...(c.reused ? { reused: true, original_duration_ms: c.original_duration_ms ?? 0 } : {}), output_tail: tailOf(c.output), ...(couldNotStart(c) ? { could_not_start: toolOf(c.command) } : {}) })),
    scans: scans.map((s) => ({ name: s.name, ok: s.ok, detail: tailOf(s.detail, 1500) })),
  };
}

/** Is the receipt valid for the current diff? Returns { ok, reason }. */
export function checkReceipt(receipt, currentHash) {
  if (!receipt || typeof receipt !== 'object' || typeof receipt.hash !== 'string') return { ok: false, reason: 'there is no valid receipt' };
  if (receipt.hash !== currentHash) return { ok: false, reason: 'the diff changed after the receipt was written, so the gate has to run again' };
  if (receipt.status !== 'green') return { ok: false, reason: `the receipt is ${receipt.status}, so no lens starts` };
  return { ok: true, reason: 'the receipt matches the current diff and is green' };
}

/** What the developer agent receives from a red gate: the failing commands and scans, with the capped tail of each. */
export function redSummary(receipt) {
  const parts = [];
  receipt.commands.filter((c) => c.exit_code !== 0).forEach((c) => parts.push(`\`${c.command}\` exited ${c.exit_code}:\n${c.output_tail}`));
  receipt.scans.filter((s) => !s.ok).forEach((s) => parts.push(`${s.name} found something:\n${s.detail}`));
  return parts.join('\n\n');
}
