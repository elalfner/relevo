// The model that an issue asks for. Implements "An issue can ask for a model" of the issue specification.
//
// An issue may carry one line `Model: <name>` for the developer and one line `QA-model: <name>` for the QA lenses, like the
// line `Allow-paths:`. The lines are part of the text of the issue, so the hash of the issue covers them. This module only
// reads them; what the plan does with the value (the ceiling, `trust: public`, a name the ladder does not have) is decided in
// model-plan.mjs. A fenced code block is not read, so an example in the text does not count.

import { withoutCode } from './issue-parse.mjs';

const MODEL_RE = /^\s*(?:[-*+]\s+)?Model:\s*(.*?)\s*$/i;
const QA_MODEL_RE = /^\s*(?:[-*+]\s+)?QA-model:\s*(.*?)\s*$/i;
// A model is a name or an alias: one token, without spaces. Relevo does not check it against a list of models.
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

/**
 * Returns { dev, qa, problems }: the value of `Model:` and of `QA-model:` (the first line of each wins), or null when the line
 * is missing or its value is not a single name. `problems` says what was ignored, for the plan to report.
 */
export function parseIssueModels(body) {
  const result = { dev: null, qa: null, problems: [] };
  const seen = { dev: false, qa: false };
  const take = (key, label, value) => {
    if (seen[key]) {
      result.problems.push(`${label} appears more than once; the first line is used`);
      return;
    }
    seen[key] = true;
    if (!NAME_RE.test(value)) result.problems.push(`${label} must be a single model name (got ${JSON.stringify(value)}), so the line is ignored`);
    else result[key] = value;
  };
  withoutCode(body).forEach((line) => {
    let m = line.match(QA_MODEL_RE);
    if (m) {
      take('qa', 'QA-model:', m[1]);
      return;
    }
    m = line.match(MODEL_RE);
    if (m) take('dev', 'Model:', m[1]);
  });
  return result;
}
