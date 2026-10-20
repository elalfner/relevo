import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { loadConfig } from '../scripts/lib/config.mjs';
import { LABELS } from '../scripts/lib/labels.mjs';
import { NEXT_STEP_REASONS, NEXT_STEP_STATES, nextStep } from '../scripts/lib/next-step.mjs';

// The documentation must not name what does not exist, and must name everything that does. Prose is not judged here:
// only commands, labels, settings, scripts and files, which a test can check.
const root = new URL('../', import.meta.url).pathname;
const read = (p) => readFileSync(`${root}${p}`, 'utf8');

// Pages with a Spanish twin. The pilot findings and the action parameters are English-only logs and are not checked here.
const PAGES = ['install', 'how-it-works', 'commands', 'configuration', 'stacks', 'execution', 'built-with', 'guide', 'security', 'issue-format'];
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
