import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scriptHash } from '../scripts/lib/review-state.mjs';

const CLI = new URL('../scripts/web-review.mjs', import.meta.url).pathname;
const TOOLS = '/opt/node-tools/node_modules';
const env = { ...process.env, NODE_PATH: [process.env.NODE_PATH, TOOLS].filter(Boolean).join(':') };
const hasPlaywright = spawnSync('node', ['-e', "require('playwright')"], { env }).status === 0;
const skip = hasPlaywright ? false : 'Playwright cannot be resolved here';

const PAGE = `<!doctype html><title>Home</title><h1 id="total">Total: 3</h1>
<img src="http://blocked.invalid/pixel.png" alt="">
<script>
  const v = new URLSearchParams(location.search).get('v');
  if (v) console.error('login failed for ' + v);
</script>`;

function serve() {
  const server = createServer((req, res) => {
    if (req.url.startsWith('/broken')) {
      res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>Broken</title><script type="module" src="/app.js"></script>');
      return;
    }
    if (req.url.startsWith('/app.js')) {
      res.writeHead(500).end('Install @vitejs/plugin-vue to handle .vue files');
      return;
    }
    if (req.url.startsWith('/missing')) {
      res.writeHead(404).end('nope');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE);
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done({ server, url: `http://127.0.0.1:${server.address().port}` })));
}

// A review state the runner accepts: autopilot on, data confirmed, not agreed, and QA passed `script` as it is now.
function writeState(dir, script, overrides = {}) {
  const file = join(dir, 'review-state.json');
  const qaScript = script ? { path: script, sha256: scriptHash(readFileSync(script, 'utf8')) } : null;
  writeFileSync(file, JSON.stringify({ autopilot: 'precheck', envConfirmed: true, items: [], captures: [], audit: null, waivers: [], agreed: false, qaScript, ...overrides }));
  return file;
}

// The CLI is run asynchronously: a synchronous spawn would block the event loop that serves the page.
// Unless the test passes --state, the state is the one next to --out.
function run(args, extraEnv = {}, options = {}) {
  const o = args.indexOf('--out');
  const withState = o !== -1 && !args.includes('--state') ? [...args, '--state', join(args[o + 1], 'review-state.json')] : args;
  return new Promise((done) => {
    const child = spawn('node', [CLI, ...withState], { env: { ...env, ...extraEnv }, ...options });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (status) => done({ status, stdout, stderr }));
  });
}

// Writes the script and a state in which QA passed it.
function scriptFile(dir, body, state = {}) {
  const file = join(dir, 'review-web.mjs');
  writeFileSync(file, `import assert from 'node:assert/strict';\nexport default async function ({ page, baseUrl, line, credentials, capture }) {\n${body}\n}\n`);
  writeState(dir, file, state);
  return file;
}

test('Scenario: a passing assertion is auto-ok, a failing one is auto-fail, a request to another origin is blocked and recorded', { skip }, async () => {
  const { server, url } = await serve();
  try {
    const dir = mkdtempSync(join(tmpdir(), 'relevo-wr-'));
    const script = scriptFile(dir, `
  await page.goto(baseUrl);
  await line(1, 'the total is shown', async () => assert.equal(await page.textContent('#total'), 'Total: 3'));
  await line(2, 'the title is Dashboard', async () => assert.equal(await page.title(), 'Dashboard'));
`);
    const r = await run(['--script', script, '--url', url, '--out', dir]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /line 1: auto-ok - the total is shown/);
    assert.match(r.stdout, /line 2: auto-fail - the title is Dashboard \(/);
    const result = JSON.parse(readFileSync(join(dir, 'web-result.json'), 'utf8'));
    assert.deepEqual(result.lines.map((l) => [l.n, l.status]), [[1, 'auto-ok'], [2, 'auto-fail']]);
    assert.equal(result.blocked, 1);
    const log = readFileSync(join(dir, 'web-log.txt'), 'utf8');
    assert.match(log, /blocked request GET http:\/\/blocked\.invalid\/pixel\.png/);
    assert.match(log, /Start proc 1:web\/127\.0\.0\.1:\d+ for browser/);
  } finally {
    server.close();
  }
});

test('an allowed origin is not blocked', { skip }, async () => {
  const { server, url } = await serve();
  try {
    const dir = mkdtempSync(join(tmpdir(), 'relevo-wr-'));
    const script = scriptFile(dir, "  await page.goto(baseUrl);\n  await line(1, 'loaded', async () => assert.ok(true));");
    const r = await run(['--script', script, '--url', url, '--allow-origins', 'http://blocked.invalid', '--out', dir]);
    assert.equal(r.status, 0, r.stderr);
    const result = JSON.parse(readFileSync(join(dir, 'web-result.json'), 'utf8'));
    assert.equal(result.blocked, 0);
  } finally {
    server.close();
  }
});

test('the log the runner writes is judged by the audit: an error response and a console error are findings', { skip }, async () => {
  const { server, url } = await serve();
  try {
    const dir = mkdtempSync(join(tmpdir(), 'relevo-wr-'));
    const script = scriptFile(dir, "  await page.goto(`${baseUrl}/missing`);\n  await page.goto(`${baseUrl}/?v=abc`);\n  await line(1, 'loaded', async () => assert.ok(true));");
    assert.equal((await run(['--script', script, '--url', url, '--out', dir])).status, 0);
    const spec = join(dir, 'change', 'specs', 'cap');
    mkdirSync(spec, { recursive: true });
    writeFileSync(join(spec, 'spec.md'), '#### Scenario: One\n- **WHEN** a\n- **THEN** b\n');
    const state = join(dir, 'review-state.json');
    const cli = (...a) => spawnSync('node', [new URL('../scripts/review-state.mjs', import.meta.url).pathname, ...a, '--state', state], { encoding: 'utf8' });
    cli('init', join(dir, 'change'));
    const audit = cli('audit', join(dir, 'web-log.txt'), '--package', 'web');
    assert.match(audit.stdout, /REVIEW REJECTED/);
    assert.match(audit.stdout, /network-data: .*response 404 GET .*\/missing/);
    assert.match(audit.stdout, /console-error: .*login failed for abc/);
  } finally {
    server.close();
  }
});

test('Scenario: Value in the output - a secret the page echoes is redacted in every file and in the console', { skip }, async () => {
  const { server, url } = await serve();
  try {
    const dir = mkdtempSync(join(tmpdir(), 'relevo-wr-'));
    const script = scriptFile(dir, "  await page.goto(`${baseUrl}/?v=${credentials('TEST_PASS')}`);\n  await line(1, `logged in with ${credentials('TEST_PASS')}`, async () => assert.ok(false, `bad password ${credentials('TEST_PASS')}`));");
    const r = await run(['--script', script, '--url', url, '--secret-env', 'TEST_PASS', '--out', dir], { TEST_PASS: 'hunter2-secret' });
    assert.equal(r.status, 0, r.stderr);
    const everything = `${r.stdout}${r.stderr}${readFileSync(join(dir, 'web-log.txt'), 'utf8')}${readFileSync(join(dir, 'web-result.json'), 'utf8')}`;
    assert.ok(!everything.includes('hunter2-secret'), 'the value must not appear anywhere');
    assert.match(everything, /\[redacted:TEST_PASS\]/);
  } finally {
    server.close();
  }
});

test('credentials() refuses a name that was not declared, and an unset variable', { skip }, async () => {
  const { server, url } = await serve();
  try {
    const dir = mkdtempSync(join(tmpdir(), 'relevo-wr-'));
    const script = scriptFile(dir, "  await page.goto(baseUrl);\n  await line(1, 'a', async () => credentials('OTHER'));\n  await line(2, 'b', async () => credentials('TEST_USER'));");
    const r = await run(['--script', script, '--url', url, '--secret-env', 'TEST_USER', '--out', dir]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /line 1: auto-fail.*not in --secret-env/);
    assert.match(r.stdout, /line 2: auto-fail.*not set/);
  } finally {
    server.close();
  }
});

test('Scenario: Script reaches the file system - refused before a browser starts, with no output files', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-wr-'));
  const file = join(dir, 'bad.mjs');
  writeFileSync(file, "import fs from 'node:fs';\nexport default async function () { fs.readFileSync('/etc/passwd'); }\n");
  writeState(dir, file);
  const r = await run(['--script', file, '--url', 'http://localhost:1', '--out', dir]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /refused before any browser started.*imports "node:fs"/s);
  assert.equal(existsSync(join(dir, 'web-log.txt')), false);
});

test('a script that fails outside a line exits 1 but still writes its files; bad arguments exit 2', { skip }, async () => {
  const { server, url } = await serve();
  try {
    const dir = mkdtempSync(join(tmpdir(), 'relevo-wr-'));
    const script = scriptFile(dir, "  await page.goto('http://127.0.0.1:1/never');");
    const r = await run(['--script', script, '--url', url, '--out', dir]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /failed outside a line/);
    assert.equal(existsSync(join(dir, 'web-result.json')), true);
  } finally {
    server.close();
  }
  assert.equal((await run([])).status, 2);
  assert.equal((await run(['--script', 'missing.mjs', '--url', 'http://localhost'])).status, 2);
});

test('without Playwright the runner says how to install it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-wr-'));
  const script = scriptFile(dir, '  await page.goto(baseUrl);');
  const clean = { ...process.env };
  delete clean.NODE_PATH;
  const r = await new Promise((done) => {
    const child = spawn('node', [CLI, '--script', script, '--url', 'http://localhost:1', '--out', dir, '--state', join(dir, 'review-state.json')], { cwd: dir, env: { ...clean, NODE_PATH: join(dir, 'nothing') } });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (status) => done({ status, stderr }));
  });
  if (r.status === 1 && /Playwright cannot be resolved/.test(r.stderr)) {
    assert.match(r.stderr, /run \/relevo:init, or "npm install -D playwright"/);
    assert.match(r.stderr, /npx playwright install chromium/);
  }
  else assert.ok([0, 1].includes(r.status), 'Playwright is available through the plugin itself here');
});

test('Scenario: a browser that never loaded a page leaves an empty log, which the audit calls inconclusive', { skip }, async () => {
  const { server, url } = await serve();
  try {
    const dir = mkdtempSync(join(tmpdir(), 'relevo-wr-'));
    const script = scriptFile(dir, "  await line(1, 'nothing was visited', async () => assert.ok(true));");
    const r = await run(['--script', script, '--url', url, '--out', dir]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readFileSync(join(dir, 'web-log.txt'), 'utf8'), '');
    assert.equal(JSON.parse(readFileSync(join(dir, 'web-result.json'), 'utf8')).pagesLoaded, 0);
    const spec = join(dir, 'change', 'specs', 'cap');
    mkdirSync(spec, { recursive: true });
    writeFileSync(join(spec, 'spec.md'), '#### Scenario: One\n- **WHEN** a\n- **THEN** b\n');
    const state = join(dir, 'review-state.json');
    const cli = (...a) => spawnSync('node', [new URL('../scripts/review-state.mjs', import.meta.url).pathname, ...a, '--state', state], { encoding: 'utf8' });
    cli('init', join(dir, 'change'));
    assert.match(cli('audit', join(dir, 'web-log.txt'), '--package', 'web').stdout, /REVIEW INCONCLUSIVE/);
  } finally {
    server.close();
  }
});

test('Scenario: The runner checks the gates itself - no state, autopilot off, data not confirmed or an agreed review: refused before any browser', async () => {
  const cases = [
    [null, /no review in progress/],
    [{ autopilot: 'off' }, /review\.autopilot is "off"/],
    [{ envConfirmed: false }, /non-production data/],
    [{ agreed: true }, /the review is closed/],
  ];
  for (const [overrides, expected] of cases) {
    const dir = mkdtempSync(join(tmpdir(), 'relevo-wr-'));
    const script = scriptFile(dir, '  await page.goto(baseUrl);', overrides ?? {});
    const args = ['--script', script, '--url', 'http://localhost:1', '--out', dir];
    const r = await run(overrides ? args : [...args, '--state', join(dir, 'none.json')]);
    assert.equal(r.status, 1, String(expected));
    assert.match(r.stderr, expected);
    assert.equal(existsSync(join(dir, 'web-log.txt')), false, 'no browser ran');
  }
});

test('Scenario: Script edited after QA - one changed character is refused, naming qa-pass', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-wr-'));
  const script = scriptFile(dir, "  await page.goto(baseUrl + '/a');");
  writeFileSync(script, readFileSync(script, 'utf8').replace("'/a'", "'/b'"));
  const r = await run(['--script', script, '--url', 'http://localhost:1', '--out', dir]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not the one QA passed.*review-state\.mjs qa-pass/s);
  assert.equal(existsSync(join(dir, 'web-log.txt')), false);
  writeState(dir, null);
  assert.match((await run(['--script', script, '--url', 'http://localhost:1', '--out', dir])).stderr, /not the one QA passed/, 'no QA pass at all');
});

test('Scenario: Script prints - its console reaches a redacted file, never the runner output', { skip }, async () => {
  const { server, url } = await serve();
  try {
    const dir = mkdtempSync(join(tmpdir(), 'relevo-wr-'));
    const script = scriptFile(dir, "  console.log('marker-from-script', credentials('TEST_PASS'));\n  console.error('second-marker');\n  await page.goto(baseUrl);");
    const r = await run(['--script', script, '--url', url, '--secret-env', 'TEST_PASS', '--out', dir], { TEST_PASS: 'hunter2-secret' });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!`${r.stdout}${r.stderr}`.includes('marker'), 'the script console must not reach the runner output');
    const file = readFileSync(join(dir, 'script-console.txt'), 'utf8');
    assert.match(file, /log marker-from-script \[redacted:TEST_PASS\]/);
    assert.match(file, /error second-marker/);
    assert.ok(!file.includes('hunter2-secret'));
  } finally {
    server.close();
  }
});

test('Scenario: Capture saved / Mislabelled capture - a check that holds saves the PNG and records it; one that fails writes nothing', { skip }, async () => {
  const { server, url } = await serve();
  try {
    const dir = mkdtempSync(join(tmpdir(), 'relevo-wr-'));
    const script = scriptFile(dir, `
  await page.goto(baseUrl);
  await capture('01_initial', async () => assert.equal(await page.textContent('#total'), 'Total: 3'), { fullPage: true });
  await capture('02_missing_var', async () => assert.match(await page.textContent('h1'), /VITE_REGION/));
`);
    const r = await run(['--script', script, '--url', url, '--out', dir], {}, { cwd: dir });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(existsSync(join(dir, '01_initial.png')), true);
    assert.equal(existsSync(join(dir, '02_missing_var.png')), false, 'a failed check takes no screenshot');
    assert.match(r.stdout, /captured 01_initial\.png/);
    assert.match(r.stdout, /capture 02_missing_var: failed \(/);
    assert.ok(!/iVBORw0KGgo|\x89PNG/.test(`${r.stdout}${r.stderr}`), 'no image content in the output');
    const state = JSON.parse(readFileSync(join(dir, 'review-state.json'), 'utf8'));
    assert.deepEqual(state.captures, ['01_initial.png']);
    const result = JSON.parse(readFileSync(join(dir, 'web-result.json'), 'utf8'));
    assert.deepEqual(result.captures.map((c) => [c.name, c.ok]), [['01_initial', true], ['02_missing_var', false]]);
  } finally {
    server.close();
  }
});

test('Scenario: Bad capture name - refused with the allowed characters, nothing written', { skip }, async () => {
  const { server, url } = await serve();
  try {
    const dir = mkdtempSync(join(tmpdir(), 'relevo-wr-'));
    const script = scriptFile(dir, "  await page.goto(baseUrl);\n  await capture('../../x', async () => {});");
    const r = await run(['--script', script, '--url', url, '--out', dir]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /capture names may use letters, digits/);
    assert.equal(existsSync(join(dir, '..', '..', 'x.png')), false);
  } finally {
    server.close();
  }
});

test('Scenario: A module answers 500 - the page failure is named before the selector timeout', { skip }, async () => {
  const { server, url } = await serve();
  try {
    const dir = mkdtempSync(join(tmpdir(), 'relevo-wr-'));
    const script = scriptFile(dir, "  await page.goto(baseUrl + '/broken');\n  await page.locator('h1').waitFor({ timeout: 1000 });");
    const r = await run(['--script', script, '--url', url, '--out', dir]);
    assert.equal(r.status, 1);
    const cause = r.stderr.indexOf('the page itself failed: response 500 GET');
    assert.ok(cause !== -1, r.stderr);
    assert.ok(cause < r.stderr.indexOf('the script failed outside a line'), 'the cause comes first');
  } finally {
    server.close();
  }
});

test('Scenario: Run with another configuration / Overwrite of the normal log - separate --out folders, one state, a warning on the default folder', { skip }, async () => {
  const { server, url } = await serve();
  try {
    const dir = mkdtempSync(join(tmpdir(), 'relevo-wr-'));
    const evidence = join(dir, 'evidence');
    mkdirSync(evidence);
    const script = scriptFile(evidence, "  await page.goto(baseUrl);\n  await capture(baseUrl.endsWith('/') ? 'x' : 'shot', async () => assert.ok(await page.title()));");
    const state = join(evidence, 'review-state.json');
    const a = await run(['--script', script, '--url', url, '--out', join(evidence, 'run-a'), '--state', state], {}, { cwd: dir });
    const b = await run(['--script', script, '--url', `${url}/?v=other`, '--out', join(evidence, 'run-b'), '--state', state], {}, { cwd: dir });
    assert.equal(a.status, 0, a.stderr);
    assert.equal(b.status, 0, b.stderr);
    assert.match(readFileSync(join(evidence, 'run-b', 'web-log.txt'), 'utf8'), /login failed for other/);
    assert.ok(!readFileSync(join(evidence, 'run-a', 'web-log.txt'), 'utf8').includes('login failed'), 'the normal log is unchanged');
    assert.deepEqual(JSON.parse(readFileSync(state, 'utf8')).captures, ['evidence/run-a/shot.png', 'evidence/run-b/shot.png']);
    const first = await run(['--script', script, '--url', url, '--state', state], {}, { cwd: dir });
    assert.ok(!/is replaced/.test(first.stderr));
    const second = await run(['--script', script, '--url', url, '--state', state], {}, { cwd: dir });
    assert.match(second.stderr, /warning: .*web-log\.txt is replaced; .*evidence\/run-<port>/);
  } finally {
    server.close();
  }
});
