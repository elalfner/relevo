// Selects the interface rules for an agent. Implements the selection requirements of the interface-knowledge
// specification: by role, stack and the text of a change, the core rules always, the face the role needs, only the
// examples of the stack, and a budget for the agents that build and review.

export const ROLES = ['think', 'issue', 'dev', 'qa', 'review'];
const FACE = { think: 'ask', issue: 'ask', dev: 'build', qa: 'review', review: 'review' };
// The roles that get the examples and a budget: the ones that write or check code.
const CODE_ROLES = new Set(['dev', 'qa']);
export const DEFAULT_BUDGET = 9000;
const BLOCKING_FIRST = (a, b) => (a.weight === b.weight ? 0 : a.weight === 'blocking' ? -1 : 1);

// The tags of an example that each stack is given. `neutral` is for every stack.
export const EXAMPLE_TAGS = {
  flutter: ['flutter', 'neutral'],
  vue: ['vue', 'html', 'tailwind', 'neutral'],
  laravel: ['html', 'tailwind', 'neutral'],
};
const exampleTagsOf = (stack, tags) => tags ?? EXAMPLE_TAGS[stack] ?? ['neutral'];

const normalise = (text) => String(text ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const escapeRe = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The tags whose words (English or Spanish) appear in the text. */
export function tagsOf(text, keywords) {
  const haystack = normalise(text);
  return Object.entries(keywords.tags).filter(([, words]) => [...words.en, ...words.es].some((w) => {
    const word = normalise(w);
    return new RegExp(`(^|[^a-z0-9])${escapeRe(word)}s?([^a-z0-9]|$)`).test(haystack);
  })).map(([tag]) => tag);
}

/** The interface kinds of a platform: those of its stack, and `web` too when a `mobile` stack builds for the web. */
export function kindsOf({ interfaceKind, targets = [] }) {
  if (interfaceKind === 'web') return new Set(['web']);
  if (interfaceKind === 'mobile') return new Set(targets.includes('web') ? ['mobile', 'web'] : ['mobile']);
  return new Set();
}

const applicable = (rule, kinds) => rule.applies === 'all' ? kinds.size > 0 : kinds.has(rule.applies);

function present(rule, { role, stack, override, tags }) {
  const face = FACE[role];
  const own = override?.[rule.id] ?? {};
  const out = { id: rule.id, title: rule.title, weight: rule.weight, check: rule.check, core: rule.core, line: own[face] ?? rule[face] };
  if (CODE_ROLES.has(role)) {
    const examples = own.examples ?? rule.examples;
    out.examples = examples.filter((e) => exampleTagsOf(stack, tags).includes(e.stack));
  }
  return out;
}

const size = (rules) => Buffer.byteLength(JSON.stringify(rules), 'utf8');

/**
 * knowledge   { rules, keywords }
 * overrides   { [rule id]: { build, review, ask, examples } } of the stack
 * Returns { role, stack, kinds, matched, rules, left_out } where `left_out` is how many matching rules the budget removed.
 * The budget drops advisory rules first, then the examples of rules that are not core, then rules that are neither
 * core nor blocking... a blocking core rule is never dropped.
 */
export function selectRules({ knowledge, role, stack, kinds, text = '', overrides = {}, budget = DEFAULT_BUDGET, exampleTags = null }) {
  if (!ROLES.includes(role)) throw new Error(`unknown role "${role}"; allowed: ${ROLES.join(', ')}`);
  const matched = tagsOf(text, knowledge.keywords);
  const pool = knowledge.rules.filter((r) => applicable(r, kinds));
  const chosen = pool.filter((r) => r.core || r.touches.some((t) => matched.includes(t)));
  let rules = chosen.map((r) => present(r, { role, stack, override: overrides, tags: exampleTags }));
  let leftOut = 0;
  if (CODE_ROLES.has(role) && size(rules) > budget) {
    // 1. advisory rules that are not core, last first
    for (let i = rules.length - 1; i >= 0 && size(rules) > budget; i -= 1) {
      if (rules[i].weight === 'advisory' && !rules[i].core) { rules.splice(i, 1); leftOut += 1; }
    }
    // 2. the examples of the rules that are not core
    for (let i = rules.length - 1; i >= 0 && size(rules) > budget; i -= 1) {
      if (!rules[i].core && rules[i].examples?.length) rules[i] = { ...rules[i], examples: [] };
    }
    // 3. blocking rules that are not core, last first
    for (let i = rules.length - 1; i >= 0 && size(rules) > budget; i -= 1) {
      if (!rules[i].core) { rules.splice(i, 1); leftOut += 1; }
    }
  }
  rules.sort(BLOCKING_FIRST);
  return { role, stack, kinds: [...kinds], matched, rules, left_out: leftOut };
}

/** The blocking rules of the applicable ones that have no example for the stack: [{ id, title }]. */
export function coverageGaps({ knowledge, stack, kinds, overrides = {}, exampleTags = null }) {
  return knowledge.rules.filter((r) => r.weight === 'blocking' && applicable(r, kinds)).filter((r) => {
    const examples = overrides[r.id]?.examples ?? r.examples;
    return !examples.some((e) => exampleTagsOf(stack, exampleTags).includes(e.stack));
  }).map((r) => ({ id: r.id, title: r.title }));
}

/** The text an agent reads: one block per rule, with the line of the role and the examples of the stack. */
export function renderRules(selection) {
  const lines = [];
  selection.rules.forEach((r) => {
    lines.push(`- **${r.title}** (${r.weight}${r.core ? ', core' : ''}, ${r.check}; \`${r.id}\`): ${r.line}`);
    (r.examples ?? []).forEach((e) => {
      lines.push(`  - good: ${e.good}`);
      if (e.bad) lines.push(`  - bad: ${e.bad}`);
    });
  });
  if (selection.left_out > 0) lines.push('', `${selection.left_out} more matching rule${selection.left_out === 1 ? ' was' : 's were'} left out to keep within the budget.`);
  return lines.join('\n');
}
