// Reads a QA report: its verdict, its numbered findings and the class of each finding.
// Implements "Each QA finding carries a class" and "Retries are skipped when no finding can be fixed by the developer
// agent" of the go specification.
//
// A class says who can correct a finding: `fixable` is for the developer agent; `input`, `spec` and `policy` need
// something that the issue, the project or a person must supply. A finding without a valid class counts as `fixable`,
// which is what the retries did before the classes existed.

export const FINDING_CLASSES = ['fixable', 'input', 'spec', 'policy'];
export const NON_FIXABLE_CLASSES = ['input', 'spec', 'policy'];

const FINDING_START = /^\s{0,3}(\d+)[.)]\s+(.*)$/;
const CLASS_LINE = /\bclass\b\**\s*[:=]\s*\**\s*`?([A-Za-z-]+)`?/i;
// What follows the findings of a rejected report is not a finding, even when it is a numbered list.
const TRAILER = /^\s*#{0,6}\s*\**\s*(left for on-device review|scenarios left for on-device review)\b/i;

/** The verdict of a report, from its first non-empty line: 'PASSED', 'REJECTED' or null when the line is not valid. */
export function verdictOf(report) {
  const first = String(report ?? '').split('\n').find((line) => line.trim() !== '') ?? '';
  const trimmed = first.trim();
  if (trimmed === 'QA PASSED') return 'PASSED';
  if (trimmed === 'QA REJECTED') return 'REJECTED';
  return null;
}

/**
 * The numbered findings of a report. Only a rejected report has findings. Each one is { number, text, class, valid }:
 * `class` is always one of FINDING_CLASSES (`fixable` when it is missing or unknown) and `valid` says whether the report
 * gave a known class.
 */
export function parseFindings(report) {
  if (verdictOf(report) !== 'REJECTED') return [];
  const findings = [];
  let current = null;
  for (const line of String(report).split('\n').slice(1)) {
    if (TRAILER.test(line)) break;
    const start = FINDING_START.exec(line);
    if (start) {
      current = { number: Number(start[1]), lines: [start[2]] };
      findings.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return findings.map(({ number, lines }) => {
    const text = lines.join('\n').trim();
    const said = CLASS_LINE.exec(text)?.[1]?.toLowerCase();
    const valid = FINDING_CLASSES.includes(said);
    return { number, text, class: valid ? said : 'fixable', valid };
  });
}

/**
 * What `go` needs to decide about the retries:
 *   total, fixable, non_fixable           counts
 *   all_non_fixable                       true only when there is at least one finding and none is `fixable`
 *   first_non_fixable_class               the class of the first finding that the developer agent cannot fix, or null
 */
export function summarize(report) {
  const findings = parseFindings(report);
  const nonFixable = findings.filter((f) => NON_FIXABLE_CLASSES.includes(f.class));
  return {
    verdict: verdictOf(report),
    total: findings.length,
    fixable: findings.length - nonFixable.length,
    non_fixable: nonFixable.length,
    all_non_fixable: findings.length > 0 && nonFixable.length === findings.length,
    first_non_fixable_class: nonFixable[0]?.class ?? null,
    findings: findings.map(({ number, class: cls, valid }) => ({ number, class: cls, valid })),
  };
}
