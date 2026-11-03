// The commands a Supabase review may run, and the ones it never runs. A review only touches the local containers.
// Implements "A Supabase review only touches the local database" of openspec/specs/review/spec.md.

// A flag or word that points a command at a remote project, or that reaches the project reference or a secret.
const REMOTE_TOKENS = ['--linked', '--db-url', 'link', 'push', 'pull'];
const REMOTE_PATHS = /(^|\/)supabase\/\.temp(\/|$)|(^|\/)\.env(\.[\w-]+)?$/;

// The closed list: the words a command must start with. `[files]` of `test db` are paths, checked below.
const ALLOWED = [
  ['supabase', 'test', 'db'],
  ['supabase', 'db', 'lint'],
  ['supabase', 'status'],
  ['supabase', 'start'],
  ['supabase', 'stop'],
  ['docker', 'logs'],
  ['docker', 'inspect'],
  ['docker', 'info'],
];

const words = (command) => String(command ?? '').trim().split(/\s+/).filter(Boolean);

/** Does a command line target a remote project, or read what a review never reads? Returns the offending word or null. */
export function remoteTarget(command) {
  const hit = words(command).find((w) => REMOTE_TOKENS.includes(w) || REMOTE_PATHS.test(w) || /^--db-url=/.test(w));
  return hit ?? null;
}

/**
 * May a Supabase review run this command? Returns { allowed, reason }.
 * Allowed: `supabase test db [files]`, `supabase db lint`, `supabase status`, `supabase start`, `supabase stop` and read-only
 * `docker logs`, `docker inspect`, `docker info`, none of them aimed at a remote project.
 */
export function checkSupabaseCommand(command) {
  const w = words(command);
  if (w.length === 0) return { allowed: false, reason: 'the command is empty' };
  const bad = remoteTarget(command);
  if (bad) return { allowed: false, reason: `"${bad}" would reach a remote project or a file a review never reads: a Supabase review is local only` };
  const listed = ALLOWED.some((prefix) => prefix.every((p, i) => w[i] === p));
  if (!listed) return { allowed: false, reason: `"${w.slice(0, 3).join(' ')}" is not one of the commands a Supabase review runs (supabase test db, supabase db lint, supabase status, supabase start, supabase stop, docker logs, docker inspect, docker info)` };
  return { allowed: true, reason: null };
}
