import test from 'node:test';
import assert from 'node:assert/strict';
import { readTokens, renderTokens } from '../scripts/lib/design-tokens.mjs';

const dart = (text, path = 'lib/theme/app_colors.dart') => readTokens([{ path, text }]);
const css = (text, path = 'src/theme.css') => readTokens([{ path, text }]);
const get = (r, name, theme = 'light') => r.tokens.find((t) => t.name === name && t.theme === theme);

// ---- Dart
test('Scenario: A named colour - the name, the value, the theme and the file and line of the definition', () => {
  const r = dart("class AppColors {\n  static const Color primary = Color(0xFF1E88E5);\n}\n");
  assert.deepEqual(get(r, 'AppColors.primary'), { name: 'AppColors.primary', value: '#1E88E5', kind: 'colour', theme: 'light', file: 'lib/theme/app_colors.dart', line: 2 });
});

test('colours written with fromARGB and fromRGBO, and a constant without a type', () => {
  const r = dart("class C {\n  static const a = Color.fromARGB(255, 10, 20, 30);\n  static const b = Color.fromRGBO(255, 0, 0, 0.5);\n  static const c = Color(0x80112233);\n}\n");
  assert.equal(get(r, 'C.a').value, '#0A141E');
  assert.equal(get(r, 'C.b').value, '#FF000080');
  assert.equal(get(r, 'C.c').value, '#11223380');
});

test('a constant that refers to another is followed to its definition, also across files', () => {
  const r = readTokens([
    { path: 'lib/a.dart', text: "class Base {\n  static const Color brand = Color(0xFF123456);\n}\n" },
    { path: 'lib/b.dart', text: "class Theme2 {\n  static const Color accent = Base.brand;\n}\n" },
  ]);
  assert.equal(get(r, 'Theme2.accent').value, '#123456');
  assert.equal(get(r, 'Theme2.accent').via, 'Base.brand');
});

test('Scenario: A reference that cannot be followed - unresolved, with the reason', () => {
  const r = dart("class C {\n  static const Color x = Elsewhere.value;\n}\n");
  assert.equal(r.tokens.length, 0);
  assert.equal(r.unresolved[0].name, 'C.x');
  assert.match(r.unresolved[0].reason, /could not be followed/);
});

test('Scenario: A palette shade - the value comes from the fixed table; one that is not in it is unresolved', () => {
  const r = dart("class C {\n  static const Color a = Colors.blue.shade700;\n  static const Color b = Colors.red;\n  static const Color c = Colors.white;\n  static const Color d = Colors.teal;\n  static const Color e = Colors.grey[300];\n}\n");
  assert.equal(get(r, 'C.a').value, '#1976D2');
  assert.equal(get(r, 'C.b').value, '#F44336');
  assert.equal(get(r, 'C.c').value, '#FFFFFF');
  assert.equal(get(r, 'C.e').value, '#E0E0E0');
  assert.match(r.unresolved.find((u) => u.name === 'C.d').reason, /not in the fixed table/);
});

test('Scenario: An opacity on a known colour - the resulting value, marked as derived', () => {
  const r = dart("class C {\n  static const Color base = Color(0xFF0000FF);\n  static final Color soft = base.withOpacity(0.5);\n  static final Color other = base.withValues(alpha: 0.2);\n}\n");
  assert.equal(get(r, 'C.soft').value, '#0000FF80');
  assert.match(get(r, 'C.soft').derived, /opacity of 0\.5/);
  assert.equal(get(r, 'C.other').value, '#0000FF33');
});

test('Scenario: A colour scheme with explicit parameters is read, light and dark as two sets', () => {
  const r = dart("class AppTheme {\n  static final light = ColorScheme.light(\n    primary: Color(0xFF111111),\n    surface: Colors.white,\n  );\n  static final dark = ColorScheme.dark(\n    primary: Color(0xFFEEEEEE),\n    surface: Color(0xFF121212),\n  );\n}\n");
  assert.equal(get(r, 'AppTheme.light.primary', 'light').value, '#111111');
  assert.equal(get(r, 'AppTheme.dark.primary', 'dark').value, '#EEEEEE');
  assert.equal(get(r, 'AppTheme.dark.surface', 'dark').value, '#121212');
  assert.equal(get(r, 'AppTheme.light.surface', 'light').value, '#FFFFFF');
});

test('Scenario: A scheme derived from a seed - unresolved with its file and line, and no colour invented', () => {
  const r = dart("ThemeData build() {\n  return ThemeData(\n    colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),\n  );\n}\n", 'lib/theme.dart');
  assert.equal(r.tokens.length, 0);
  assert.deepEqual([r.unresolved[0].file, r.unresolved[0].line], ['lib/theme.dart', 3]);
  assert.match(r.unresolved[0].reason, /derived from a seed/);
});

test('a colour from the device is unresolved', () => {
  const r = dart("Widget build() {\n  return DynamicColorBuilder(builder: (light, dark) => App());\n}\n");
  assert.match(r.unresolved[0].reason, /comes from the device/);
});

test('classes that extend the theme with colours of their own are read', () => {
  const r = dart("class AppColors extends ThemeExtension<AppColors> {\n  const AppColors({required this.success});\n  final Color success;\n  static const light = AppColors(success: Color(0xFF2E7D32));\n  static const dark = AppColors(success: Color(0xFF81C784));\n}\n");
  assert.equal(get(r, 'AppColors.light.success', 'light').value, '#2E7D32');
  assert.equal(get(r, 'AppColors.dark.success', 'dark').value, '#81C784');
});

test('text styles (size, weight, family), and spacing and radius constants', () => {
  const r = dart("class T {\n  static const TextStyle title = TextStyle(fontSize: 20, fontWeight: FontWeight.w600, fontFamily: 'Inter');\n}\nclass Space {\n  static const double sm = 8;\n  static const double md = 16;\n}\nclass Radii {\n  static const double card = 12;\n}\nclass Other {\n  static const double timeout = 30;\n}\n");
  assert.deepEqual([get(r, 'T.title').value, get(r, 'T.title').kind], ['20px w600 Inter', 'text']);
  assert.deepEqual([get(r, 'Space.sm').value, get(r, 'Space.sm').kind], ['8px', 'spacing']);
  assert.deepEqual([get(r, 'Radii.card').value, get(r, 'Radii.card').kind], ['12px', 'radius']);
  assert.equal(get(r, 'Other.timeout'), undefined);
});

test('Scenario: Two brands - the sets are listed, not merged', () => {
  const r = readTokens([
    { path: 'lib/a.dart', text: "class BrandAColors {\n  static const Color primary = Color(0xFF111111);\n}\n" },
    { path: 'lib/b.dart', text: "class BrandBColors {\n  static const Color primary = Color(0xFF222222);\n}\n" },
  ]);
  assert.deepEqual(r.sets, ['BrandAColors', 'BrandBColors']);
  assert.equal(get(r, 'BrandAColors.primary').value, '#111111');
  assert.equal(get(r, 'BrandBColors.primary').value, '#222222');
  assert.match(renderTokens(r), /ask which one to use/);
});

test('Scenario: The same input twice - identical output, whatever the order of the files', () => {
  const files = [{ path: 'lib/b.dart', text: 'class B { static const Color x = Color(0xFF000001); }\n' }, { path: 'lib/a.dart', text: 'class A { static const Color y = Color(0xFF000002); }\n' }];
  const one = JSON.stringify(readTokens(files));
  assert.equal(one, JSON.stringify(readTokens(files)));
  assert.equal(one, JSON.stringify(readTokens([...files].reverse())));
});

// ---- web
test('Scenario: A property that refers to another - the final value and the names of both', () => {
  const r = css(":root {\n  --blue-600: #1d4ed8;\n  --app-primary: var(--blue-600);\n}\n");
  assert.equal(get(r, '--app-primary').value, '#1d4ed8');
  assert.equal(get(r, '--app-primary').via, '--blue-600');
  assert.equal(get(r, '--blue-600').value, '#1d4ed8');
});

test('Scenario: A dark-mode block - the redefined values are marked dark, in a class or a media query', () => {
  const r = css(":root {\n  --bg: #ffffff;\n  --space-2: 8px;\n}\n.dark {\n  --bg: #111111;\n}\n@media (prefers-color-scheme: dark) {\n  :root {\n    --bg: #0a0a0a;\n  }\n}\n");
  assert.equal(get(r, '--bg', 'light').value, '#ffffff');
  assert.equal(r.tokens.filter((t) => t.name === '--bg' && t.theme === 'dark').map((t) => t.value).sort().join(), '#0a0a0a,#111111');
  assert.deepEqual([get(r, '--space-2').kind, get(r, '--space-2').value], ['spacing', '8px']);
});

test('a dark value that refers to a property is resolved in the dark theme first', () => {
  const r = css(":root {\n  --ink: #000000;\n  --text: var(--ink);\n}\n.dark {\n  --ink: #ffffff;\n  --text: var(--ink);\n}\n");
  assert.equal(get(r, '--text', 'dark').value, '#ffffff');
  assert.equal(get(r, '--text', 'light').value, '#000000');
});

test('a custom property that refers to an undefined one is unresolved, and a loop is reported', () => {
  const r = css(":root {\n  --a: var(--missing);\n  --b: var(--c);\n  --c: var(--b);\n}\n");
  assert.match(r.unresolved.find((u) => u.name === '--a').reason, /not defined in the declared files/);
  assert.match(r.unresolved.find((u) => u.name === '--b').reason, /loop/);
});

test('Scenario: Two brands on the web - the data-brand blocks are separate sets', () => {
  const r = css(":root {\n  --primary: #000000;\n}\n[data-brand=\"alpha\"] {\n  --primary: #ff0000;\n}\n[data-brand=\"beta\"] {\n  --primary: #00ff00;\n}\n");
  assert.deepEqual(r.sets, ['alpha', 'beta']);
  assert.equal(r.tokens.find((t) => t.set === 'alpha').value, '#ff0000');
  assert.equal(r.tokens.find((t) => t.set === 'beta').value, '#00ff00');
});

test('the colour, spacing and radius scales of the styling tool are read when they are literal', () => {
  const r = readTokens([{ path: 'tailwind.config.js', text: "module.exports = {\n  theme: {\n    extend: {\n      colors: {\n        brand: { 500: '#3366ff', 700: '#1a3fcc' },\n        ink: '#101010',\n        dyn: someFunction(),\n      },\n      spacing: { 18: '4.5rem' },\n      borderRadius: { card: '12px' },\n    },\n  },\n};\n" }]);
  assert.equal(r.tokens.find((t) => t.name === 'colors.brand-500').value, '#3366ff');
  assert.equal(r.tokens.find((t) => t.name === 'colors.ink').value, '#101010');
  assert.equal(r.tokens.find((t) => t.name === 'spacing.18').value, '4.5rem');
  assert.equal(r.tokens.find((t) => t.name === 'borderRadius.card').kind, 'radius');
  assert.match(r.unresolved.find((u) => u.name === 'colors.dyn').reason, /not a literal/);
});

test('the text table lists the unresolved tokens with their reason', () => {
  const r = dart("class C {\n  static const Color x = Elsewhere.value;\n  static const Color y = Color(0xFF000000);\n}\n");
  const text = renderTokens(r);
  assert.match(text, /C\.y = #000000 \(colour\) lib\/theme\/app_colors\.dart:3/);
  assert.match(text, /Unresolved \(not guessed\):\n {2}C\.x lib\/theme\/app_colors\.dart:2: /);
});

// ---- the command and the files it may read
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectCandidates, filesFor } from '../scripts/lib/design-token-files.mjs';

const CLI = new URL('../scripts/design-tokens.mjs', import.meta.url).pathname;
function repo(files, relevo = '') {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-tokens-'));
  Object.entries(files).forEach(([path, text]) => {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), text);
  });
  if (relevo) writeFileSync(join(dir, 'relevo.yml'), relevo);
  return dir;
}
const MIN = 'limits:\n  run_max_cost: 5\n';
const run = (dir, ...args) => spawnSync('node', [CLI, '--root', dir, ...args], { encoding: 'utf8' });

test('Scenario: A colour in another file - it is not read and is not in the output', () => {
  const dir = repo({
    'lib/theme/colors.dart': 'class C {\n  static const Color a = Color(0xFF111111);\n}\n',
    'lib/feature/page.dart': 'class P {\n  static const Color b = Color(0xFF222222);\n}\n',
  }, `${MIN}design:\n  system:\n    tokens: [lib/theme]\n`);
  const out = JSON.parse(run(dir, '--json').stdout);
  assert.deepEqual(out.files, ['lib/theme/colors.dart']);
  assert.deepEqual(out.tokens.map((t) => t.name), ['C.a']);
  assert.ok(!JSON.stringify(out).includes('222222'));
});

test('Scenario: A restricted file - it is not opened and the output says that it was skipped', () => {
  const dir = repo({
    'config/theme.css': ':root { --a: #111111; }\n',
    'config/.env': 'SECRET=hunter2\n',
    'config/secrets.pem': 'KEY',
  }, `${MIN}design:\n  system:\n    tokens: [config]\n`);
  const r = run(dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /--a = #111111/);
  assert.doesNotMatch(r.stdout + r.stderr, /hunter2|KEY/);
  const json = JSON.parse(run(dir, '--json').stdout);
  assert.deepEqual(json.files, ['config/theme.css']);
  const restrictedFiles = filesFor(['config/.env', 'config/theme.css'], ['config'], undefined);
  assert.deepEqual(restrictedFiles.skippedRestricted, ['config/.env']);
});

test('a repository with declared paths reads them; with none it reads nothing and lists what it found, to confirm', () => {
  const dir = repo({
    'src/styles/tokens.css': ':root {\n  --brand: #123456;\n}\n',
    'src/app.css': 'body { margin: 0; }\n',
    'tailwind.config.js': 'module.exports = { theme: { extend: { colors: { x: "#fff" } } } };\n',
    'lib/theme/app_colors.dart': 'class C {}\n',
    'node_modules/pkg/theme.css': ':root { --nope: #000000; }\n',
  }, MIN);
  const text = run(dir).stdout;
  assert.match(text, /Found by convention, to confirm/);
  assert.match(text, /src\/styles\/tokens\.css: custom properties declared on the root/);
  assert.match(text, /tailwind\.config\.js: the configuration of the styling tool/);
  assert.match(text, /lib\/theme\/app_colors\.dart/);
  assert.doesNotMatch(text, /app\.css:|node_modules/);
  assert.doesNotMatch(text, /#123456/);
  const confirmed = run(dir, '--paths', 'src/styles/tokens.css');
  assert.match(confirmed.stdout, /--brand = #123456/);
  assert.deepEqual(detectCandidates([]), []);
});

test('Scenario: The same input twice - the command prints the same thing', () => {
  const dir = repo({ 'a/t.css': ':root { --x: #000000; --y: #ffffff; }\n' }, `${MIN}design:\n  system:\n    tokens: [a]\n`);
  assert.equal(run(dir, '--json').stdout, run(dir, '--json').stdout);
});

test('the command executes nothing and uses no network: a file that looks like code is only read as text', () => {
  const dir = repo({ 'a/theme.dart': "import 'dart:io';\nclass C { static const Color a = Color(0xFF000000); }\nvoid main() { Process.run('touch', ['/tmp/relevo-should-not-exist-' + 'x']); }\n" }, `${MIN}design:\n  system:\n    tokens: [a]\n`);
  assert.equal(run(dir).status, 0);
});
