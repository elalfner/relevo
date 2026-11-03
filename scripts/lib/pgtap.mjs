// What a pgTAP run of `supabase test db` says: how many assertions ran, which failed and whether the plan was completed.
// Implements "A pgTAP run is recorded with its assertions" of openspec/specs/review/spec.md.

const ANSI = /\u001b\[[0-9;]*m/g;

/**
 * Parse the output of `supabase test db`. A passing run prints no `ok N` lines, only the summary (`Files=1, Tests=4`); a
 * failing one prints `# Failed test N: "name"`. It also reads the TAP lines (`ok N - name`, `not ok N - name`, `1..N`) when
 * the output has them, and the summary line otherwise.
 * Returns { assertions, failing: [names], planned, planComplete }. `planComplete` is false when the output says the plan was
 * not completed (`Looks like you planned 6 tests but ran 4`) or when a plan was announced and fewer assertions ran.
 */
export function parseTap(output) {
  const lines = String(output ?? '').replace(ANSI, '').split('\n');
  let ok = 0;
  let notOk = 0;
  const failing = [];
  const failedNames = [];
  let planned = null;
  let summaryTests = null;
  let incomplete = false;
  lines.forEach((raw) => {
    const line = raw.trim();
    let m;
    if ((m = /^not ok\s+\d+\s*(?:-\s*)?(.*)$/.exec(line))) { failing.push(m[1] || `assertion ${line.match(/\d+/)[0]}`); notOk += 1; }
    else if (/^ok\s+\d+/.test(line)) ok += 1;
    else if ((m = /^1\.\.(\d+)$/.exec(line))) planned = Number(m[1]);
    else if ((m = /Files=\d+,\s*Tests=(\d+)/.exec(line))) summaryTests = Number(m[1]);
    else if ((m = /^# Failed test \d+:\s*"(.*)"$/.exec(line))) failedNames.push(m[1]);
    else if (/Looks like you planned \d+ tests? but ran \d+|\bBad plan\b/i.test(line)) incomplete = true;
  });
  failedNames.forEach((n) => { if (!failing.includes(n)) failing.push(n); });
  const counted = ok + notOk;
  const assertions = counted > 0 ? counted : (summaryTests ?? 0);
  const planComplete = !incomplete && (planned === null || planned === 0 ? true : assertions >= planned);
  return { assertions, failing, planned, planComplete };
}
