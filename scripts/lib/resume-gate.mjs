// When may a build that stopped be resumed again? Implements "A resume that finishes no task stops the loop" of the go specification.
//
// A resumed run that stops at a limit with no task finished leaves a marker in its comment with the three limits that were in force
// (see stalled-marker.mjs). While no limit of `relevo.yml` is higher than the recorded one, resuming again would hit the same wall.
// Pure: data in, answer out.

export const LIMIT_KEYS = ['run_max_turns', 'run_max_minutes', 'run_max_cost'];

/**
 * stalled  { turns, minutes, cost } the limits recorded by the stalled comment, or null when there is none
 * limits   config.limits: { run_max_turns, run_max_minutes, run_max_cost }
 * Returns null when a resume is allowed, or { raise: [names of the limits that could be raised] }.
 */
export function stallBlock(stalled, limits = {}) {
  if (!stalled || typeof stalled !== 'object') return null;
  const recorded = { run_max_turns: stalled.turns, run_max_minutes: stalled.minutes, run_max_cost: stalled.cost };
  const higher = LIMIT_KEYS.some((key) => Number.isFinite(recorded[key]) && Number.isFinite(limits?.[key]) && limits[key] > recorded[key]);
  if (higher) return null;
  return { raise: LIMIT_KEYS.filter((key) => Number.isFinite(limits?.[key]) || Number.isFinite(recorded[key])) };
}
