// Which QA lenses run for a change. Implements "The `interface` lens is active only when the change has an interface".
// `spec`, `security` and `code` always run. `interface` runs only when the platform's stack has an interface and the
// selection of interface rules for the change returns at least one rule beyond the always-on ones.

export const LENSES = ['spec', 'security', 'code', 'interface'];
export const ALWAYS = ['spec', 'security', 'code'];

/**
 * interfaceKind   'web' | 'mobile' | 'none' | null  (null when the interface knowledge is not installed)
 * extraRules      how many rules the selection returns beyond the always-on ones (core), or null when it could not be asked
 * Returns [{ lens, active, reason? }] in the order of LENSES. A skipped lens carries the reason, written by this script.
 */
export function planLenses({ interfaceKind = null, extraRules = null } = {}) {
  const plan = ALWAYS.map((lens) => ({ lens, active: true }));
  let reason = null;
  if (interfaceKind === null) reason = 'the interface knowledge is not installed';
  else if (interfaceKind === 'none') reason = 'the stack has no interface';
  else if (!(Number.isInteger(extraRules) && extraRules > 0)) reason = 'the change touches nothing the interface rules cover beyond the always-on ones';
  plan.push(reason ? { lens: 'interface', active: false, reason } : { lens: 'interface', active: true });
  return plan;
}

/** The lines `SKIPPED <lens>: <reason>` for the report. */
export const skippedLines = (plan) => plan.filter((p) => !p.active).map((p) => `SKIPPED ${p.lens}: ${p.reason}`);
