// What an api review (Laravel) checks before it runs a test: PHP and Composer, the installed dependencies, and the
// database the test configuration declares. The real environment files are never read.
// Implements "An api review checks its tools and the test database before running" of openspec/specs/review/spec.md.

export const EXIT = { tool: 3, vendor: 4, deps_stale: 5, database: 6 };

/** The `<env>` and `<server>` entries of a PHPUnit configuration as { NAME: value }. */
export function phpunitEnv(xml) {
  const out = {};
  [...String(xml ?? '').matchAll(/<(?:env|server)\b[^>]*>/gi)].forEach(([tag]) => {
    const name = tag.match(/\bname\s*=\s*"([^"]*)"/i)?.[1];
    const value = tag.match(/\bvalue\s*=\s*"([^"]*)"/i)?.[1];
    if (name !== undefined && value !== undefined) out[name] = value;
  });
  return out;
}

/**
 * The database the test configuration declares and whether a test may run against it without the person's word.
 * In-memory SQLite is safe; any other connection, or none declared, needs the confirmation.
 */
export function testDatabase(xml) {
  if (xml === null || xml === undefined) return { declared: false, connection: null, database: null, safe: false, reason: 'neither phpunit.xml nor phpunit.xml.dist exists, so the test database is unknown' };
  const env = phpunitEnv(xml);
  const connection = env.DB_CONNECTION ?? null;
  const database = env.DB_DATABASE ?? null;
  if (connection === null) return { declared: false, connection, database, safe: false, reason: 'the test configuration declares no DB_CONNECTION, so the tests use whatever the environment says' };
  if (connection === 'sqlite' && database === ':memory:') return { declared: true, connection, database, safe: true, reason: null };
  return { declared: true, connection, database, safe: false, reason: `the tests use the ${connection} connection${database ? ` (${database})` : ''}, not in-memory SQLite` };
}

const parse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/**
 * Do the installed packages (vendor/composer/installed.json) match composer.lock? Compares name and version of every
 * package of the lock file, dev ones included. null when it cannot tell (never treated as stale).
 */
export function lockMatches(lockText, installedText) {
  const lock = parse(lockText);
  const installed = parse(installedText);
  if (!lock || !installed) return null;
  const list = installed.packages ?? installed;
  if (!Array.isArray(list)) return null;
  const have = new Map(list.map((p) => [p.name, p.version]));
  const wanted = [...(lock.packages ?? []), ...(lock['packages-dev'] ?? [])];
  return wanted.every((p) => have.get(p.name) === p.version);
}

/**
 * Check an api review. deps: which(tool) -> boolean, exists(path), read(path) -> text | null.
 * Returns { ok, check, detail, install, database, needs_confirm, exit }.
 * `exit` is 0 when a test may run, 6 when it may run only after the person confirmed the database is not production.
 */
export function apiPreflight({ cwd }, deps) {
  const base = { install: 'composer install', database: null, needs_confirm: false };
  const missing = ['php', 'composer'].filter((t) => !deps.which(t));
  if (missing.length > 0) return { ...base, ok: false, check: 'tool', detail: `${missing.join(' and ')} not found on the path`, exit: EXIT.tool };
  if (!deps.exists(`${cwd}/vendor/autoload.php`)) return { ...base, ok: false, check: 'vendor', detail: 'there is no vendor/ folder: the dependencies are not installed', exit: EXIT.vendor };
  const stale = lockMatches(deps.read(`${cwd}/composer.lock`), deps.read(`${cwd}/vendor/composer/installed.json`));
  if (stale === false) return { ...base, ok: false, check: 'deps_stale', detail: 'the installed packages do not match composer.lock', exit: EXIT.deps_stale };
  const database = testDatabase(deps.read(`${cwd}/phpunit.xml`) ?? deps.read(`${cwd}/phpunit.xml.dist`));
  if (!database.safe) return { ...base, ok: true, check: 'database', detail: database.reason, database, needs_confirm: true, exit: EXIT.database };
  return { ...base, ok: true, check: 'ready', detail: 'PHP and Composer found, dependencies installed, tests use in-memory SQLite', database, exit: 0 };
}

// Exit codes of the Supabase review: 3 a tool is missing, 4 Docker does not answer, 5 no supabase/config.toml, 7 the local
// stack is stopped. 7 is not a stop: the review asks before it starts the stack.
export const SUPABASE_EXIT = { tool: 3, docker: 4, config: 5, stack_stopped: 7 };

/**
 * Check a Supabase review. deps: which(tool) -> boolean, exists(path), run(command, args) -> { status }.
 * Returns { ok, check, detail, install, exit }. It reads no environment file and starts nothing.
 */
export function supabasePreflight({ cwd }, deps) {
  const base = { install: null };
  const missing = ['supabase', 'docker'].filter((t) => !deps.which(t));
  if (missing.length > 0) {
    const install = missing.includes('supabase') ? 'brew install supabase/tap/supabase (or see https://supabase.com/docs/guides/cli)' : 'install Docker (https://docs.docker.com/get-docker/)';
    return { ...base, ok: false, check: 'tool', detail: `${missing.join(' and ')} not found on the path`, install, exit: SUPABASE_EXIT.tool };
  }
  if (!deps.exists(`${cwd}/supabase/config.toml`)) return { ...base, ok: false, check: 'config', detail: 'there is no supabase/config.toml in this folder: run it from the folder of the platform, or run supabase init', install: 'supabase init', exit: SUPABASE_EXIT.config };
  if (deps.run('docker', ['info']).status !== 0) return { ...base, ok: false, check: 'docker', detail: 'the Docker daemon does not answer: start Docker', install: 'start Docker Desktop or the Docker service', exit: SUPABASE_EXIT.docker };
  if (deps.run('supabase', ['status']).status !== 0) return { ...base, ok: true, check: 'stack_stopped', detail: 'the local Supabase stack is not running', install: 'supabase start', exit: SUPABASE_EXIT.stack_stopped };
  return { ...base, ok: true, check: 'ready', detail: 'the Supabase CLI and Docker are there and the local stack is running', exit: 0 };
}

// A declared adapter: the names the repository chose are tools to find, never programs to run.
export const NEEDS_EXIT = { invalid: 2, tool: 3, docker: 4, checkout: 5 };
const NEEDS_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const INSTALL_HINTS = { docker: 'install Docker (https://docs.docker.com/get-docker/)' };

/**
 * Look for an executable called `name` in the directories of `pathVar`, without running it. deps: isExecutable(file) -> boolean.
 * `sep` and `ext` let a test stand in for another platform.
 */
export function findOnPath(name, pathVar, deps, { sep = ':', ext = [''] } = {}) {
  return String(pathVar ?? '').split(sep).filter(Boolean).some((dir) => ext.some((e) => deps.isExecutable(`${dir}/${name}${e}`)));
}

/**
 * Check the tools a declared adapter needs. deps: find(name) -> boolean (on the path, not run), run(command, args) -> { status }.
 * Returns { ok, check, detail, install, missing, exit }: exit 0 ready, 3 a tool is missing, 4 the Docker daemon does not answer,
 * 2 a name that is not a tool name, 5 ready but the checkout lacks something (`warnings` names each, `install` is the command for the
 * person). With `cwd` and deps.exists(path) it also looks at the checkout by the existence of paths only: `node_modules` when npm is
 * needed and there is a package.json, `.env` when there is a `.env.example` or `.env.sample`. It installs nothing, starts nothing and
 * never opens a file, so an environment file is never read.
 */
export function needsPreflight({ needs, cwd }, deps) {
  const base = { install: null, missing: [] };
  const names = [...new Set(needs ?? [])];
  const bad = names.filter((n) => !NEEDS_NAME_RE.test(n));
  if (bad.length > 0) return { ...base, ok: false, check: 'invalid', detail: `${bad.map((n) => `"${n}"`).join(', ')} ${bad.length === 1 ? 'is' : 'are'} not a tool name: --needs takes names, never a path or a command`, exit: NEEDS_EXIT.invalid };
  const missing = names.filter((n) => !deps.find(n));
  if (missing.length > 0) {
    const hints = missing.map((n) => INSTALL_HINTS[n]).filter(Boolean);
    return { ...base, ok: false, check: 'tool', detail: `${missing.join(' and ')} not found on the path`, install: hints.length > 0 ? hints.join('; ') : null, missing, exit: NEEDS_EXIT.tool };
  }
  if (names.includes('docker') && deps.run('docker', ['info']).status !== 0) return { ...base, ok: false, check: 'docker', detail: 'the Docker daemon does not answer: start Docker', install: 'start Docker Desktop or the Docker service', exit: NEEDS_EXIT.docker };
  const detail = names.length > 0 ? `${names.join(', ')} found${names.includes('docker') ? ' and the Docker daemon answers' : ''}` : 'the declared adapter needs no tool';
  const warnings = cwd !== undefined && deps.exists ? checkoutWarnings({ names, cwd }, deps.exists) : [];
  if (warnings.length > 0) {
    const installs = warnings.map((w) => w.install).filter(Boolean);
    return { ...base, ok: true, check: 'checkout', detail: `${detail}, but the checkout lacks ${warnings.map((w) => w.path).join(' and ')}`, warnings, install: installs.length > 0 ? installs.join('; ') : null, exit: NEEDS_EXIT.checkout };
  }
  return { ...base, ok: true, check: 'ready', detail, exit: 0 };
}

/** What the checkout lacks, from the existence of paths only: [{ path, detail, install }]. */
function checkoutWarnings({ names, cwd }, exists) {
  const at = (name) => `${cwd.replace(/\/$/, '')}/${name}`;
  const out = [];
  if (names.includes('npm') && exists(at('package.json')) && !exists(at('node_modules'))) out.push({ path: 'node_modules', detail: 'the checkout has a package.json and no node_modules, so a test fails before it runs', install: 'npm ci' });
  if ((exists(at('.env.example')) || exists(at('.env.sample'))) && !exists(at('.env'))) out.push({ path: '.env', detail: 'the checkout has an example environment file and no .env: copy the one the project uses, which this review never opens', install: null });
  return out;
}
