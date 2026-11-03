// Loads the interface rules of the plugin, the translations of a stack and the rules a repository adds. A repository can
// add rules and examples and never remove or lower a rule of the plugin (the interface-knowledge specification).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEIGHT = { blocking: 2, advisory: 1 };
const REQUIRED = ['id', 'category', 'title', 'principle', 'applies', 'weight', 'check', 'core', 'touches', 'ask', 'build', 'review', 'examples', 'source'];
const STACK_TAGS = ['html', 'tailwind', 'vue', 'flutter', 'neutral'];

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** { rules, keywords, overrides } where overrides is { [rule id]: { build, review, ask, examples } } of the stack, or {}. */
export function loadKnowledge(pluginRoot, stack = null) {
  const base = join(pluginRoot, 'knowledge', 'interface');
  const rules = json(join(base, 'rules.json')).rules;
  const keywords = json(join(base, 'keywords.json'));
  const file = stack ? join(base, 'stacks', `${stack}.json`) : null;
  const overrides = file && existsSync(file) ? json(file).rules ?? {} : {};
  return { rules, keywords, overrides };
}

/**
 * Validate a rule a repository wrote. Returns the problems, empty when it is fine.
 */
export function ruleProblems(rule) {
  const problems = REQUIRED.filter((f) => rule?.[f] === undefined || rule[f] === '').map((f) => `lacks "${f}"`);
  if (problems.length) return problems;
  if (!['all', 'web', 'mobile'].includes(rule.applies)) problems.push('"applies" must be all, web or mobile');
  if (!(rule.weight in WEIGHT)) problems.push('"weight" must be blocking or advisory');
  if (!['code', 'render', 'person'].includes(rule.check)) problems.push('"check" must be code, render or person');
  if (typeof rule.core !== 'boolean') problems.push('"core" must be true or false');
  if (!Array.isArray(rule.touches) || rule.touches.length === 0) problems.push('"touches" must be a list of tags');
  if (!Array.isArray(rule.examples)) problems.push('"examples" must be a list');
  else rule.examples.forEach((e) => { if (!STACK_TAGS.includes(e?.stack) || !e.good) problems.push(`an example needs a stack (${STACK_TAGS.join(', ')}) and a "good" variant`); });
  if (rule.weight === 'blocking' && Array.isArray(rule.examples) && rule.examples.length === 0) problems.push('a blocking rule needs an example');
  return problems;
}

/**
 * Merge the rules of `.relevo/interface.json` into those of the plugin.
 * Returns { rules, added, attempts, problems }: `attempts` lists an identifier that tried to lower the weight of a rule
 * of the plugin or to take it over (the plugin's rule is kept, only its examples grow), `problems` the invalid rules.
 */
export function mergeRepositoryRules(pluginRules, text) {
  const out = { rules: pluginRules.map((r) => ({ ...r })), added: [], attempts: [], problems: [] };
  if (text == null) return out;
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    out.problems.push({ id: null, problems: [`the file is not valid JSON: ${err.message}`] });
    return out;
  }
  if (!Array.isArray(data?.rules)) {
    out.problems.push({ id: null, problems: ['the file needs a "rules" list'] });
    return out;
  }
  data.rules.forEach((rule) => {
    const problems = ruleProblems(rule);
    if (problems.length) { out.problems.push({ id: rule?.id ?? null, problems }); return; }
    const existing = out.rules.find((r) => r.id === rule.id);
    if (!existing) { out.rules.push(rule); out.added.push(rule.id); return; }
    if (WEIGHT[rule.weight] < WEIGHT[existing.weight]) out.attempts.push({ id: rule.id, attempt: `lowers the weight from ${existing.weight} to ${rule.weight}` });
    else if (rule.applies !== existing.applies || rule.core === false && existing.core) out.attempts.push({ id: rule.id, attempt: 'changes where or how the rule applies' });
    // A repository may add examples to a rule of the plugin, nothing else.
    existing.examples = [...existing.examples, ...rule.examples.filter((e) => !existing.examples.some((x) => x.good === e.good))];
  });
  return out;
}
