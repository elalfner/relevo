import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { approximateProperties, contrastRatio, evaluate, headerChecks, isLargeText, overall, parseColour, staticChecks, thresholds } from '../scripts/lib/preview-check.mjs';

const CLI = new URL('../scripts/preview-check.mjs', import.meta.url).pathname;
const FIX = new URL('./fixtures/previews/', import.meta.url).pathname;
const run = (file, kind, extra = [], env = {}) => spawnSync('node', [CLI, join(FIX, file), '--kind', kind, '--json', ...extra], { encoding: 'utf8', env: { ...process.env, ...env } });
const items = (r) => JSON.parse(r.stdout).items;

// The browser tests need a library and a browser on the machine; without them the one test of the missing check runs.
const probe = run('web-pass.html', 'web');
const HAS_BROWSER = probe.status !== 3;
const browser = (name, fn) => test(name, { skip: HAS_BROWSER ? false : 'no browser automation on this machine' }, fn);

// ---- no browser needed
test('Scenario: An external address - the check fails it', () => {
  const r = staticChecks('<!-- Proposal --><img src="https://cdn.example.com/a.png"><link rel="stylesheet" href="//x.example/s.css">');
  assert.equal(r.find((i) => i.id === 'no-external-address').status, 'fail');
  assert.equal(staticChecks('<style>a{background:url("http://x/y.png")}</style>').find((i) => i.id === 'no-external-address').status, 'fail');
  assert.equal(staticChecks('<!-- see https://example.com --><p>hi</p>').find((i) => i.id === 'no-external-address').status, 'pass');
});

test('Scenario: A script - the check fails it, also as an event attribute or a javascript address', () => {
  ['<script>1</script>', '<button onclick="go()">x</button>', '<a href="javascript:void(0)">x</a>'].forEach((h) => assert.equal(staticChecks(h).find((i) => i.id === 'no-script').status, 'fail', h));
  assert.equal(staticChecks('<p>hello</p>').find((i) => i.id === 'no-script').status, 'pass');
});

test('the size is checked against the target of 16 KB', () => {
  assert.equal(staticChecks('x'.repeat(16 * 1024 + 1)).find((i) => i.id === 'size').status, 'fail');
  assert.equal(staticChecks('x'.repeat(100)).find((i) => i.id === 'size').status, 'pass');
});

test('the header says it is a proposal, and a mobile sketch says it is approximate on the page and in the comment', () => {
  assert.equal(headerChecks('<!-- Proposal A --><p>x</p>', 'web')[0].status, 'pass');
  assert.equal(headerChecks('<p>x</p>', 'web')[0].status, 'fail');
  const both = '<!-- Proposal. Approximate sketch, not a render of the app. --><p>Approximate sketch, not a render of the app.</p>';
  assert.equal(headerChecks(both, 'mobile')[1].status, 'pass');
  assert.equal(headerChecks('<!-- Proposal. Approximate sketch. --><p>x</p>', 'mobile')[1].status, 'fail');
});

test('the contrast arithmetic follows WCAG, and large text needs only 3:1', () => {
  assert.equal(contrastRatio(parseColour('#000000'), parseColour('#ffffff')).toFixed(1), '21.0');
  assert.equal(contrastRatio(parseColour('rgb(119, 119, 119)'), parseColour('#fff')).toFixed(2), '4.48');
  assert.deepEqual(parseColour('rgba(0, 0, 0, 0.5)'), [0, 0, 0, 0.5]);
  assert.equal(parseColour('papayawhip'), null);
  assert.equal(isLargeText(24, false), true);
  assert.equal(isLargeText(19, true), true);
  assert.equal(isLargeText(16, true), false);
});

test('Scenario: the thresholds follow the kind of interface', () => {
  assert.deepEqual(thresholds('web'), { kind: 'web', widths: [360, 1024], minTarget: 24, unit: 'CSS px', textScales: [] });
  assert.deepEqual(thresholds('mobile'), { kind: 'mobile', widths: [320, 360], minTarget: 48, unit: 'dp', textScales: [1.3, 2] });
  assert.equal(thresholds('mobile', { ios: true }).minTarget, 44);
});

test('Scenario: Overflow, a small target and a derived value - from what the browser measured', () => {
  const t = thresholds('mobile');
  const m = { width: 360, scrollWidth: 420, targets: [{ name: 'button "Pay"', w: 56, h: 40 }], texts: [{ name: 'p', color: 'rgb(0, 0, 0)', background: 'rgb(255, 255, 255)', size: 16, bold: false, approximate: true }] };
  const r = evaluate(m, t);
  assert.equal(r.find((i) => i.id === 'overflow@360').status, 'fail');
  assert.equal(r.find((i) => i.id === 'target-size@360').element, 'button "Pay"');
  assert.equal(r.find((i) => i.id === 'contrast@360').status, 'approximate');
  const over = evaluate({ ...m, scrollWidth: 380 }, t, { scale: 2 });
  assert.equal(over[0].id, 'overflow@360/text200');
  assert.equal(over[0].status, 'fail');
  assert.equal(overall([{ status: 'pass' }, { status: 'not checked' }, { status: 'approximate' }]), 'not checked');
  assert.equal(overall([{ status: 'pass' }, { status: 'approximate' }]), 'approximate');
});

test('Scenario: Text over an image or a partly transparent colour - not checked, never pass', () => {
  const r = evaluate({ width: 360, scrollWidth: 360, targets: [], texts: [{ name: 'p', color: 'rgb(255, 255, 255)', background: 'rgb(0, 0, 0)', size: 16, bold: false, unknownBackground: true }, { name: 'q', color: 'rgb(0, 0, 0)', background: 'rgba(255, 255, 255, 0.5)', size: 16, bold: false }] }, thresholds('web'));
  assert.equal(r.find((i) => i.id === 'contrast@360/unchecked').status, 'not checked');
  assert.match(r.find((i) => i.id === 'contrast@360/unchecked').detail, /2 text/);
  assert.equal(r.find((i) => i.id === 'contrast@360'), undefined);
});

test('the header lists the approximated custom properties', () => {
  assert.deepEqual(approximateProperties('<!-- approximate: --a, --b-c\nProposal -->'), ['--a', '--b-c']);
  assert.deepEqual(approximateProperties('<p>x</p>'), []);
});

test('Scenario: No browser automation - the script says nothing was checked, exits with its own code, and still reports the file checks', () => {
  const r = run('web-pass.html', 'web', [], { RELEVO_PREVIEW_BROWSER: 'none' });
  assert.equal(r.status, 3);
  const out = JSON.parse(r.stdout);
  assert.equal(out.checked, false);
  assert.match(out.reason, /no automatic check of the page ran/);
  assert.ok(out.items.some((i) => i.id === 'no-script'));
  const text = spawnSync('node', [CLI, join(FIX, 'web-pass.html'), '--kind', 'web'], { encoding: 'utf8', env: { ...process.env, RELEVO_PREVIEW_BROWSER: 'none' } });
  assert.match(text.stdout, /^NOT CHECKED:/);
});

test('bad usage exits with 2', () => {
  assert.equal(spawnSync('node', [CLI], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync('node', [CLI, join(FIX, 'web-pass.html'), '--kind', 'tablet'], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync('node', [CLI, join(FIX, 'missing.html'), '--kind', 'web'], { encoding: 'utf8' }).status, 2);
});

// ---- with a browser
const status = (r, id) => items(r).filter((i) => i.id === id || i.id.startsWith(`${id}/`)).map((i) => i.status);

browser('Scenario: A page that passes - no item fails', () => {
  const r = run('web-pass.html', 'web');
  assert.equal(r.status, 0, r.stdout);
  assert.equal(JSON.parse(r.stdout).overall, 'pass');
});

browser('Scenario: Low contrast - the item fails and names the element', () => {
  const r = run('web-low-contrast.html', 'web');
  assert.equal(r.status, 1);
  const fail = items(r).find((i) => i.status === 'fail' && i.id.startsWith('contrast'));
  assert.match(fail.detail, /contrast 1\.92:1, needs/);
  assert.ok(fail.element);
});

browser('Scenario: Overflow at a narrow width - fail at 360 px', () => {
  const r = run('web-overflow.html', 'web');
  assert.ok(status(r, 'overflow@360').includes('fail'));
  assert.ok(!status(r, 'overflow@1024').includes('fail'));
});

browser('A target under the WCAG 2.2 minimum fails for the web', () => {
  assert.ok(status(run('web-small-target.html', 'web'), 'target-size@360').includes('fail'));
});

browser('Scenario: Text over an image - contrast is not checked', () => {
  const r = run('web-text-over-image.html', 'web');
  assert.ok(items(r).some((i) => i.status === 'not checked' && i.id.startsWith('contrast')));
  assert.equal(r.status, 0);
});

browser('a script and an external address in the file fail, and the browser neither runs the script nor loads the address', () => {
  assert.equal(run('web-script.html', 'web').status, 1);
  assert.equal(run('web-external.html', 'web').status, 1);
});

browser('Scenario: A value that came from an approximation is approximate, not pass', () => {
  const r = run('web-approximate.html', 'web');
  assert.equal(r.status, 0, r.stdout);
  assert.ok(items(r).some((i) => i.status === 'approximate' && i.id.startsWith('contrast')));
  assert.equal(JSON.parse(r.stdout).overall, 'approximate');
});

browser('Scenario: A mobile target that is too small - 40 dp fails and names the element', () => {
  const r = run('mobile-small-target.html', 'mobile');
  const fail = items(r).find((i) => i.status === 'fail' && i.id === 'target-size@360');
  assert.match(fail.detail, /40 dp, under 48/);
  assert.match(fail.element, /button/);
  assert.equal(run('mobile-small-target.html', 'mobile', ['--ios']).status, 1);
});

browser('Scenario: Larger text - a layout that breaks only at 200% fails that pass and not the normal one', () => {
  const r = run('mobile-text-overflow.html', 'mobile');
  assert.ok(status(r, 'overflow@360/text200').includes('fail'));
  assert.ok(!items(r).some((i) => i.status === 'fail' && /^overflow@(320|360)$/.test(i.id)));
  assert.equal(run('mobile-pass.html', 'mobile').status, 0);
});

browser('a mobile sketch without its label fails the label item', () => {
  assert.equal(items(run('mobile-unlabelled.html', 'mobile')).find((i) => i.id === 'mobile-label').status, 'fail');
});

browser('Scenario: A run of the check - the repository does not change and no request leaves the machine', async () => {
  // A repository with the preview inside it, to see that the tree is the same afterwards.
  const repo = mkdtempSync(join(tmpdir(), 'relevo-preview-repo-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  cpSync(join(FIX, 'web-pass.html'), join(repo, 'p.html'));
  const before = execFileSync('git', ['status', '--porcelain', '--ignored'], { cwd: repo, encoding: 'utf8' });
  // A local server that records any request; the page points at it.
  const seen = [];
  const server = createServer((req, res) => { seen.push(req.url); res.end('x'); });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const port = server.address().port;
  const page = join(repo, '..', `relevo-net-${port}.html`);
  writeFileSync(page, `<!-- Proposal -->\n<!doctype html><html><head><style>body{background:url(http://127.0.0.1:${port}/bg.png)}</style></head><body><img src="http://127.0.0.1:${port}/a.png" alt=""><p>x</p></body></html>`);
  const child = spawn('node', [CLI, page, '--kind', 'web', '--json', '--root', repo], { cwd: repo });
  await new Promise((done) => child.on('close', done));
  server.close();
  assert.deepEqual(seen, [], 'a request left the page');
  assert.equal(execFileSync('git', ['status', '--porcelain', '--ignored'], { cwd: repo, encoding: 'utf8' }), before);
});
