import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { loadConfig } from '../scripts/lib/config.mjs';
import { renderReport } from '../scripts/lib/doctor.mjs';
import { checkIssueDraft } from '../scripts/lib/issue-check.mjs';
import { LABELS } from '../scripts/lib/labels.mjs';
import { NEXT_STEP_REASONS, NEXT_STEP_STATES, nextStep } from '../scripts/lib/next-step.mjs';

// The documentation must not name what does not exist, and must name everything that does. Prose is not judged here:
// only commands, labels, settings, scripts and files, which a test can check.
const root = new URL('../', import.meta.url).pathname;
const read = (p) => readFileSync(`${root}${p}`, 'utf8');

// Pages with a Spanish twin. The pilot findings and the action parameters are English-only logs and are not checked here.
const PAGES = ['get-started', 'install', 'how-it-works', 'commands', 'configuration', 'stacks', 'execution', 'built-with', 'guide', 'security', 'issue-format'];
const FILES = ['README.md', 'README.es.md', 'docs/README.md', 'docs/README.es.md', ...PAGES.flatMap((n) => [`docs/${n}.md`, `docs/${n}.es.md`])];
const exists = (f) => existsSync(`${root}${f}`);

const COMMANDS = readdirSync(`${root}skills`).filter((d) => exists(`skills/${d}/SKILL.md`));
const NINE = ['init', 'think', 'issue', 'go', 'review', 'fix', 'ship', 'status', 'doctor'];

test('every documentation page exists in English and Spanish', () => {
  FILES.forEach((f) => assert.ok(exists(f), `${f} is missing`));
});

test('the commands of the plugin are the nine the documentation counts', () => {
  assert.deepEqual([...COMMANDS].sort(), [...NINE].sort());
});

test('every /relevo:<name> that a page names is one of the nine commands', () => {
  FILES.filter(exists).forEach((f) => {
    [...read(f).matchAll(/\/relevo:([a-z]+)/g)].forEach((m) => assert.ok(NINE.includes(m[1]), `${f} names /relevo:${m[1]}, which is not a command`));
  });
});

test('every script a page names exists', () => {
  FILES.filter(exists).forEach((f) => {
    [...read(f).matchAll(/`(?:scripts\/)?([a-z][a-z0-9-]*\.mjs)`/g)].forEach((m) => {
      assert.ok(exists(`scripts/${m[1]}`) || exists(`scripts/lib/${m[1]}`), `${f} names ${m[1]}, which does not exist`);
    });
  });
});

test('every relevo:<label> that a page names is a label of the plugin', () => {
  const names = new Set(LABELS.map((l) => l.name));
  FILES.filter(exists).forEach((f) => {
    [...read(f).matchAll(/`(relevo:[a-z-]+)`/g)].filter((m) => !NINE.includes(m[1].slice(7))).forEach((m) => {
      assert.ok(names.has(m[1]), `${f} names the label ${m[1]}, which does not exist`);
    });
  });
});

test('every documentation file a page links or names inside the repository exists', () => {
  FILES.filter(exists).forEach((f) => {
    [...read(f).matchAll(/`((?:docs|templates|stacks|scripts|skills|agents)\/[A-Za-z0-9_./-]+\.(?:md|yml|mjs))`/g)].forEach((m) => {
      assert.ok(exists(m[1]), `${f} names ${m[1]}, which does not exist`);
    });
  });
});

// ---------- configuration

const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
const SETTINGS = flat(loadConfig('limits:\n  run_max_cost: 5\n').config)
  .map((s) => (s.startsWith('platforms.') ? 'platforms' : s))
  .filter((s, i, all) => all.indexOf(s) === i);

test('Scenario: A new setting - the configuration page mentions every setting relevo.yml accepts, in both languages', () => {
  ['docs/configuration.md', 'docs/configuration.es.md'].filter(exists).forEach((f) => {
    const page = read(f);
    SETTINGS.forEach((s) => assert.ok(page.includes(`\`${s}\``), `${f} does not mention the setting ${s}`));
  });
});

test('the configuration page covers the checks of a platform, the layers of a profile, and the limits by credential', () => {
  ['docs/configuration.md', 'docs/configuration.es.md'].filter(exists).forEach((f) => {
    const page = read(f);
    assert.ok(page.includes('platforms.<name>.checks'), `${f}: checks`);
    assert.ok(page.includes('.relevo/stacks/'), `${f}: the profile of the repository`);
    assert.ok(/subscription|suscripci/i.test(page) && /API/i.test(page), `${f}: the limits by credential`);
  });
});

// ---------- commands

test('Scenario: Argument of a command - the commands page shows the argument hint of each skill and an example', () => {
  ['docs/commands.md', 'docs/commands.es.md'].filter(exists).forEach((f) => {
    const page = read(f);
    COMMANDS.forEach((name) => {
      const hint = read(`skills/${name}/SKILL.md`).match(/^argument-hint: "(.*)"$/m)?.[1];
      if (hint) assert.ok(page.includes(`/relevo:${name} ${hint}`) || page.includes(hint.replace(/^\[/, '').replace(/\]$/, '')) || page.includes(hint), `${f} does not show the argument of ${name}: ${hint}`);
      assert.match(page, new RegExp(`\`/relevo:${name}[ \`]`), `${f} does not mention /relevo:${name}`);
    });
    assert.ok((page.match(/^```text$/gm) ?? []).length >= NINE.length, `${f} gives an example per command`);
  });
});

// ---------- the guide

const TABLE = /^\| `([a-z-]+)` \| (.+?) \| (.+?) \|$/gm;
const lifeRows = (page) => {
  const section = page.split(/^## /m).find((s) => /^(The life of an issue|La vida de un issue)/.test(s)) ?? '';
  return [...section.matchAll(TABLE)].map((m) => ({ state: m[1], command: m[2], who: m[3] }));
};

test('Scenario: the life of an issue in the guide says what the hand-off messages say', () => {
  ['docs/guide.md', 'docs/guide.es.md'].filter(exists).forEach((f) => {
    const rows = lifeRows(read(f));
    const covered = rows.map((r) => r.state);
    NEXT_STEP_STATES.forEach((state) => assert.ok(covered.includes(state), `${f}: the life of an issue has no row for ${state}`));
    rows.forEach((row) => {
      const variants = NEXT_STEP_REASONS[row.state] ?? [null];
      const commands = variants.map((reason) => nextStep({ state: row.state, reason, issue: 7 }).command).filter(Boolean);
      commands.forEach((c) => assert.ok(row.command.includes(c.replace('7', '<n>')), `${f}: the row ${row.state} does not give ${c.replace('7', '<n>')}`));
    });
  });
});

test('the guide answers the situations the plan listed, with the command of each', () => {
  const need = {
    'docs/guide.md': [/review found/i, /asks for changes|requested changes/i, /QA fail|qa-failed/i, /quota|usage limit/i, /do not know|don't know/i, /fix or a new issue/i, /cloud, local or both/i, /public/i],
    'docs/guide.es.md': [/revisi[oó]n encontr/i, /pidi[oó] cambios|pide cambios/i, /fall[oó] QA|qa-failed/i, /cuota|l[ií]mite de uso/i, /no s[eé]/i, /fix o un issue nuevo/i, /nube, local o ambos/i, /p[uú]blic/i],
  };
  Object.entries(need).filter(([f]) => exists(f)).forEach(([f, patterns]) => {
    const page = read(f);
    patterns.forEach((re) => assert.match(page, re, `${f} does not cover ${re}`));
    ['fix', 'review', 'go', 'ship'].forEach((c) => assert.ok(page.includes(`/relevo:${c}`), `${f} never names /relevo:${c}`));
  });
});

// ---------- security

test('the security page names the measures by files, settings and labels that exist, and the risks that remain', () => {
  ['docs/security.md', 'docs/security.es.md'].filter(exists).forEach((f) => {
    const page = read(f);
    ['trust', 'run_max_cost', 'RELEVO_LINKS_TOKEN', 'Allow-paths', 'allow_scripts', 'review.mode'].forEach((w) => assert.ok(page.includes(w), `${f} does not mention ${w}`));
    assert.match(page, /prompt injection|inyecci[oó]n de prompts/i, `${f}: the risk that has no complete defence`);
  });
});

// ---------- get started

const STEPS = {
  'docs/get-started.md': { before: /^## Before you start$/m, steps: /^## (\d+)\. .+$/gm, next: /^## What next$/m, trouble: /^## If something goes wrong$/m, see: '**You should see**', not: '**If not**' },
  'docs/get-started.es.md': { before: /^## Antes de empezar$/m, steps: /^## (\d+)\. .+$/gm, next: /^## Qué sigue$/m, trouble: /^## Si algo sale mal$/m, see: '**Deberías ver**', not: '**Si no**' },
};
const stepBodies = (page, re) => {
  const heads = [...page.matchAll(re)];
  return heads.map((h, i) => ({ n: Number(h[1]), title: h[0], text: page.slice(h.index, heads[i + 1]?.index ?? page.indexOf('\n## ', h.index + 1)) }));
};

test('Scenario: A step - the page has the sections in order, and eight numbered steps', () => {
  Object.entries(STEPS).filter(([f]) => exists(f)).forEach(([f, m]) => {
    const page = read(f);
    const at = (re) => page.search(re);
    assert.ok(at(m.before) > 0, `${f}: before you start`);
    const steps = stepBodies(page, m.steps);
    assert.deepEqual(steps.map((x) => x.n), [1, 2, 3, 4, 5, 6, 7, 8], `${f}: eight steps in order`);
    assert.ok(at(m.before) < page.indexOf(steps[0].title), `${f}: before you start comes first`);
    assert.ok(page.indexOf(steps[7].title) < at(m.next) && at(m.next) < at(m.trouble), `${f}: what next, then the problems`);
  });
});

test('every step has the command to copy, what you should see and what to do if not, and links the page that explains it', () => {
  Object.entries(STEPS).filter(([f]) => exists(f)).forEach(([f, m]) => {
    stepBodies(read(f), m.steps).forEach((step) => {
      assert.match(step.text, /```(?:bash|text)\n[\s\S]*?```/, `${f} step ${step.n}: a command to copy`);
      assert.ok(step.text.includes(`- ${m.see}`), `${f} step ${step.n}: ${m.see}`);
      assert.ok(step.text.includes(`- ${m.not}`), `${f} step ${step.n}: ${m.not}`);
    });
    const page = read(f);
    [8, 4, 3].forEach((n) => assert.match(stepBodies(page, m.steps)[n - 1].text, /\]\((?:[a-z-]+)(?:\.es)?\.md/, `${f} step ${n} links a page`));
  });
});

test('Scenario: the commands run in the order of the lifecycle', () => {
  ['docs/get-started.md', 'docs/get-started.es.md'].filter(exists).forEach((f) => {
    const page = read(f);
    const order = ['doctor', 'init', 'issue', 'review', 'ship'].map((c) => page.indexOf(`/relevo:${c}`));
    order.forEach((i, k) => assert.ok(i >= 0, `${f}: /relevo:${['doctor', 'init', 'issue', 'review', 'ship'][k]} is never named`));
    assert.deepEqual([...order].sort((a, b) => a - b), order, `${f}: the commands come in the order of the lifecycle`);
  });
});

test('Scenario: The credential - both secrets are named, the person creates them, and the value never goes in a file or the conversation', () => {
  ['docs/get-started.md', 'docs/get-started.es.md'].filter(exists).forEach((f) => {
    const page = read(f);
    ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN', 'gh secret set'].forEach((w) => assert.ok(page.includes(w), `${f}: ${w}`));
    assert.ok(/never|nunca/i.test(page.slice(page.indexOf('ANTHROPIC_API_KEY') - 600, page.indexOf('ANTHROPIC_API_KEY') + 1200)), `${f}: it says the value is never written down`);
  });
});

test('the example issue of the page passes the check Relevo applies', () => {
  ['docs/get-started.md', 'docs/get-started.es.md'].filter(exists).forEach((f) => {
    const m = STEPS[f];
    const step5 = stepBodies(read(f), m.steps)[4].text;
    const title = step5.match(/^(?:Title|Título): (.+)$/m)?.[1];
    const body = step5.match(/```markdown\n([\s\S]*?)```/)?.[1];
    assert.ok(title && body, `${f}: step 5 gives a title and an issue in a markdown block`);
    const r = checkIssueDraft({ title, body });
    assert.deepEqual(r.problems, [], `${f}: the example issue fails its own check`);
    assert.ok(r.scenarios >= 1 && r.edgeCases >= 1, `${f}: scenarios and edge cases`);
  });
});

test('the output the page quotes is output the code produces', () => {
  const messages = read('scripts/lib/messages.mjs');
  const initSource = ['scripts/init.mjs', 'scripts/lib/init.mjs'].map((f) => read(f)).join('\n');
  const sample = [{ status: 'pass', message: 'a' }, { status: 'fail', message: 'b', fix: 'c' }, { status: 'warn', message: 'd', fix: 'e' }, { status: 'note', message: 'f' }];
  // The default report shows what needs action; the passes are listed only with --all, and the page says so.
  const doctor = `${renderReport(sample)}\n${renderReport(sample, { all: true })}`;
  [['docs/get-started.md', ['is built', 'Your next step']], ['docs/get-started.es.md', ['está construida', 'Tu siguiente paso']]].filter(([f]) => exists(f)).forEach(([f, quoted]) => {
    const page = read(f);
    [...quoted.map((q) => [q, messages]), ['[pass]', doctor], ['[FAIL]', doctor], ['[warn]', doctor], ['[note]', doctor], ['fix:', doctor], ['FAILURES', doctor], ['WARNINGS', doctor], ['NOTES', doctor], ['--all', doctor], ['[will do]', initSource], ['[by hand]', initSource]].forEach(([phrase, source]) => {
      assert.ok(page.includes(phrase), `${f} does not quote "${phrase}"`);
      const needle = source === initSource ? phrase.slice(1, -1) : phrase; // init writes the tag between brackets
      assert.ok(source.includes(needle), `the code never produces "${phrase}"`);
    });
  });
});

test('Scenario: A problem - the table names the causes and the fix, and What next links the other pages', () => {
  Object.entries(STEPS).filter(([f]) => exists(f)).forEach(([f, m]) => {
    const page = read(f);
    const trouble = page.slice(page.search(m.trouble));
    assert.ok((trouble.match(/^\|/gm) ?? []).length >= 7, `${f}: a table of at least five problems`);
    const next = page.slice(page.search(m.next), page.search(m.trouble));
    ['guide', 'security', 'stacks', 'execution'].forEach((p) => assert.ok(next.includes(`${p}`), `${f}: What next links ${p}`));
  });
});

test('the execution pages name the two toolchain actions that the go template runs, in both languages', () => {
  const template = read('templates/workflows/relevo-go.yml').split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  ['subosito/flutter-action', 'shivammathur/setup-php'].forEach((action) => {
    assert.ok(template.includes(action), `the template runs ${action}`);
    ['docs/execution.md', 'docs/execution.es.md'].forEach((p) => assert.ok(read(p).includes(action), `${p} names ${action}`));
  });
});

const STARTS = [
  { file: 'docs/get-started.md', terms: ['rulesets (rules that GitHub applies to a branch', 'secret (a value that GitHub keeps hidden', 'milestone (a GitHub group of issues', 'QA is the second agent, which tries to reject the work', 'no `openspec/` folder, where the specifications live'] },
  { file: 'docs/get-started.es.md', terms: ['reglas de la rama (reglas que GitHub aplica a una rama', 'secreto (un valor que GitHub guarda oculto', 'hito (un grupo de issues de GitHub', 'QA es el segundo agente, que intenta rechazar el trabajo', 'carpeta `openspec/`, donde viven las especificaciones'] },
];

test('Get started gives one way to install the plugin, with the project scope written out', () => {
  STARTS.forEach(({ file }) => {
    const text = read(file);
    const blocks = [...text.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]).filter((b) => b.includes('claude plugin install'));
    assert.equal(blocks.length, 1, `${file} shows the install commands once`);
    assert.match(blocks[0], /claude plugin marketplace add elalfner\/relevo --scope project --sparse \.claude-plugin/);
    assert.match(blocks[0], /claude plugin install relevo@relevo --scope project/);
    assert.doesNotMatch(text, /npm install -g @elalfner\/relevo/, `${file} leaves the npm shortcut to the install page`);
  });
});

test('Get started says the build does not install the dependencies of a Vue or Laravel project', () => {
  STARTS.forEach(({ file }) => {
    const text = read(file);
    const step6 = text.slice(text.search(/^## 6\. /m), text.search(/^## 7\. /m));
    assert.ok(step6.includes('npm ci --ignore-scripts'), `${file} step 6 names the Vue command`);
    assert.ok(step6.includes('composer install --no-scripts'), `${file} step 6 names the Laravel command`);
    assert.ok(step6.includes('relevo-go.yml'), file);
    assert.match(text, /\| .*relevo:qa-failed.*(dependencies|dependencias)/, `${file} table row mentions the dependencies`);
  });
});

test('Get started explains the technical terms where it first uses them', () => {
  STARTS.forEach(({ file, terms }) => {
    const text = read(file);
    terms.forEach((t) => assert.ok(text.includes(t), `${file} explains "${t}"`));
  });
});

test('the rare cases of the setup step live in the table of problems, not in the step', () => {
  STARTS.forEach(({ file }) => {
    const text = read(file);
    const step3 = text.slice(text.search(/^## 3\. /m), text.search(/^## 4\. /m));
    assert.doesNotMatch(step3, /openspec init/, `${file} keeps openspec init out of step 3`);
    const table = text.slice(text.search(/^## (If something goes wrong|Si algo sale mal)$/m));
    assert.match(table, /openspec init/, `${file} table says what to do without an OpenSpec root`);
    assert.match(table, /gh auth login/, file);
  });
});
