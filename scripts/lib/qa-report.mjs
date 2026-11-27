// `relevo qa-report`: the QA records of a repository added up. Read-only: every call is a GET.

import { parseRecord, summarizeRecords } from './qa-record.mjs';

/**
 * The records of every comment of the repository, oldest first, closed issues included. `since` (YYYY-MM-DD) keeps the
 * comments created from that day, in UTC. One page at a time, so that a repository with many comments does not overflow.
 */
export function gatherRecords({ gh, repo, since = null }) {
  const from = since ? `${since}T00:00:00Z` : null;
  const records = [];
  for (let page = 1; ; page += 1) {
    const comments = JSON.parse(gh(['api', `repos/${repo}/issues/comments?per_page=100&page=${page}${from ? `&since=${encodeURIComponent(from)}` : ''}`]));
    comments.forEach((c) => {
      // `since` of the API filters by the time of the last update, so the date of creation is checked too.
      if (from && !(Date.parse(c.created_at) >= Date.parse(from))) return;
      const record = parseRecord(c);
      if (record) records.push(record);
    });
    if (comments.length < 100) return records;
  }
}

function listRun(run) {
  const when = run.created_at ? ` ${run.created_at.slice(0, 10)}` : '';
  const kind = run.command === 'fix' ? `, kind ${run.kind ?? 'not said'}` : '';
  const lines = [`${run.issue ? `#${run.issue}` : '(unknown issue)'}${when} ${run.command}, ${run.passed ? 'passed' : 'not passed'}${kind}`];
  run.rounds.forEach((round, i) => {
    if (round.gate === 'red') lines.push(`  attempt ${i + 1}: the gate was red`);
    round.blocking.forEach((f) => lines.push(`  attempt ${i + 1}: ${f.lens} ${f.class}: ${f.text ?? '(no text kept)'}`));
  });
  return lines;
}

/** The lines of the report. With no records there are no figures at all: a zero would read as "QA found nothing". */
export function renderQaReport({ records, repo, since = null, list = false }) {
  const scope = `${repo}${since ? ` since ${since}` : ''}`;
  if (!records.length) return [`Nothing recorded: no comment of ${scope} carries a QA record.`];
  const s = summarizeRecords(records);
  const kinds = Object.entries(s.kinds).map(([k, n]) => `${k} ${n}`).join(', ');
  const lines = [
    `Relevo QA report of ${scope}`,
    '',
    `Blocking findings of the first attempt: ${s.total}, of which ${s.totalPassed} in runs that ended passed`,
    ...s.findings.map((f) => `  ${f.lens} ${f.class}: ${f.count} (${f.passed} in runs that ended passed)`),
    '',
    `Runs recorded: ${s.runs} (${s.builds} of go, ${s.fixes} of fix)`,
    `Runs in which QA stopped something: ${s.stopped}`,
    `Corrections of fix by kind: ${s.fixes ? kinds : 'none recorded'}`,
    '',
    'A finding that blocked is not proof of a defect: list the texts with --list and judge a sample.',
  ];
  if (list) lines.push('', 'Runs:', ...records.flatMap(listRun));
  return lines;
}

/** { code, lines } of the command. `gh` is injected. */
export function runQaReport({ gh, repo, since = null, list = false }) {
  if (!repo) return { code: 2, lines: ['qa-report: no repository found: pass --repo owner/name'] };
  try {
    return { code: 0, lines: renderQaReport({ records: gatherRecords({ gh, repo, since }), repo, since, list }) };
  } catch (err) {
    return { code: 1, lines: [`qa-report: could not read the comments of ${repo}: ${String(err.stderr || err.message).trim().split('\n')[0]}`] };
  }
}
