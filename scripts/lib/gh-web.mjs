// The GitHub CLI subcommands that the commands of the person who writes issues use, answered over the REST API.
// In a session of Claude Code on the web GraphQL is blocked and `gh issue ...` fails; `gh api` (REST) works. Outside a
// remote session the arguments go to `gh` unchanged. The client is injected so everything here runs without a network:
//   api(args, input?) -> stdout of `gh api ...` (throws with .stderr / .stdout when GitHub refuses)
//   passthrough(args) -> exit code of the real `gh`, output not captured
// The token of the session is used as it is: this file never reads it, only removes it from an error before showing it.

export const isRemote = (env) => env.CLAUDE_CODE_REMOTE === 'true';

class Refusal extends Error {}
const refuse = (message) => {
  throw new Refusal(message);
};

// ---- the repository of the session

/** `owner/name` from a remote URL: the last two path segments, without `.git` (https, ssh, or the proxy of a session). */
export function repoFromUrl(url) {
  const text = String(url ?? '').trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const m = /([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(text);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** `--repo`, then `GITHUB_REPOSITORY`, then the `origin` remote. `git` is `(args) -> stdout`. */
export function findRepo({ flag, env, git }) {
  if (flag) return flag;
  if (env.GITHUB_REPOSITORY) return env.GITHUB_REPOSITORY;
  let url = null;
  try {
    url = git(['remote', 'get-url', 'origin']);
  } catch {
    url = null;
  }
  return repoFromUrl(url);
}

// ---- errors

const secrets = (env) => [env.GH_TOKEN, env.GITHUB_TOKEN, env.GH_LINKS_TOKEN].filter((s) => s && s.length > 3);

/** Removes the token and any authorization header from text that is about to be shown. */
export function redact(text, env = {}) {
  let out = String(text ?? '');
  secrets(env).forEach((s) => {
    out = out.split(s).join('***');
  });
  return out.replace(/(authorization:\s*)\S+(\s+\S+)?/gi, '$1***').replace(/\b(gh[pousr]_[A-Za-z0-9]{10,})\b/g, '***');
}

/** `HTTP 404: Not Found` from what a failed `gh api` left on stderr and stdout. */
export function describeFailure(err, env = {}) {
  const stderr = String(err?.stderr ?? '');
  const stdout = String(err?.stdout ?? '');
  const status = /\(HTTP (\d{3})\)/.exec(stderr)?.[1] ?? /HTTP (\d{3})/.exec(stderr)?.[1] ?? null;
  let message = null;
  try {
    message = JSON.parse(stdout).message ?? null;
  } catch {
    message = null;
  }
  message ??= stderr.replace(/^gh:\s*/, '').split('\n')[0].trim() || String(err?.message ?? 'the request failed');
  return { status: status ? Number(status) : null, text: redact(`${status ? `HTTP ${status}: ` : ''}${message}`, env) };
}

// ---- flags

const COMMON = { repo: 'value', json: 'value', jq: 'value' };
const SPECS = {
  'issue view': { flags: { ...COMMON, comments: 'bool' }, positional: 1 },
  'issue list': { flags: { ...COMMON, state: 'value', search: 'value', limit: 'value', label: 'list', assignee: 'value' }, positional: 0 },
  'issue create': { flags: { repo: 'value', title: 'value', body: 'value', 'body-file': 'value', milestone: 'value', assignee: 'list', label: 'list' }, positional: 0 },
  'issue edit': { flags: { repo: 'value', title: 'value', body: 'value', 'body-file': 'value', 'add-label': 'list', 'remove-label': 'list' }, positional: 1 },
  'repo view': { flags: { json: 'value', jq: 'value' }, positional: 0, optional: true },
  'label create': { flags: { repo: 'value', color: 'value', description: 'value', force: 'bool' }, positional: 1 },
};
const SHORT = { '-q': '--jq', '-R': '--repo' };

/** The subcommand, its positional arguments and its flags; refuses what the REST version does not implement. */
export function parseArgs(argv) {
  const [group, sub, ...rest] = argv;
  const key = `${group} ${sub}`;
  const spec = SPECS[key];
  if (!spec) refuse(`"gh ${[group, sub].filter(Boolean).join(' ')}" is not covered by the REST version used in a web session; the call was not made`);
  const flags = {};
  const positional = [];
  for (let i = 0; i < rest.length; i += 1) {
    let token = SHORT[rest[i]] ?? rest[i];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    let value;
    const eq = token.indexOf('=');
    if (eq !== -1) {
      value = token.slice(eq + 1);
      token = token.slice(0, eq);
    }
    const name = token.slice(2);
    const kind = spec.flags[name];
    if (!kind) refuse(`the flag --${name} of "gh ${key}" is not covered by the REST version used in a web session; the call was not made`);
    if (kind === 'bool') {
      flags[name] = true;
      continue;
    }
    if (value === undefined) {
      i += 1;
      value = rest[i];
      if (value === undefined) refuse(`the flag --${name} needs a value`);
    }
    if (kind === 'list') (flags[name] ??= []).push(value);
    else flags[name] = value;
  }
  if (positional.length > spec.positional && !(spec.optional && positional.length === 1)) refuse(`"gh ${key}" got more arguments than the REST version takes; the call was not made`);
  if (positional.length < spec.positional) refuse(`"gh ${key}" needs ${spec.positional === 1 ? 'an argument' : `${spec.positional} arguments`}`);
  if (flags.jq !== undefined) applyPath(null, flags.jq); // an expression that is not a path is refused before any request
  return { key, positional, flags };
}

// ---- shaping the answer like `gh` does

const ISSUE_FIELDS = ['number', 'title', 'body', 'state', 'labels', 'assignees', 'milestone', 'url', 'author', 'createdAt', 'updatedAt', 'closedAt'];
const FIELDS = {
  'issue view': [...ISSUE_FIELDS, 'comments'],
  'issue list': ISSUE_FIELDS,
  'repo view': ['nameWithOwner', 'name', 'url', 'defaultBranchRef'],
};

/** One issue of the REST API as `gh issue ... --json` gives it. */
export function shapeIssue(raw) {
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body ?? '',
    state: String(raw.state ?? '').toUpperCase(),
    labels: (raw.labels ?? []).map((l) => (typeof l === 'string' ? { name: l } : { name: l.name, color: l.color ?? '', description: l.description ?? '' })),
    assignees: (raw.assignees ?? []).map((a) => ({ login: a.login })),
    milestone: raw.milestone ? { number: raw.milestone.number, title: raw.milestone.title } : null,
    url: raw.html_url ?? '',
    author: raw.user ? { login: raw.user.login } : null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    closedAt: raw.closed_at ?? null,
  };
}

/** One comment as `gh` gives it. */
export const shapeComment = (c) => ({ author: c.user ? { login: c.user.login } : null, body: c.body ?? '', createdAt: c.created_at ?? null, url: c.html_url ?? '' });

const pick = (object, fields) => Object.fromEntries(fields.map((f) => [f, object[f]]));

function wantedFields(key, flags) {
  if (!flags.json) return null;
  const fields = flags.json.split(',').map((f) => f.trim()).filter(Boolean);
  const unknown = fields.filter((f) => !FIELDS[key].includes(f));
  if (unknown.length) refuse(`the field ${unknown.join(', ')} of "gh ${key} --json" is not covered by the REST version used in a web session; the call was not made`);
  return fields;
}

// ---- --jq: a path only

function applyPath(value, expression) {
  const text = expression.trim();
  const unsupported = () => refuse(`the --jq expression "${expression}" is not covered by the REST version used in a web session (only paths such as .body or .[].title); the call was not made`);
  if (!/^(\.|(\.[A-Za-z_][A-Za-z0-9_]*|\.?\[\d*\])+)$/.test(text)) unsupported();
  const steps = [...text.matchAll(/\.([A-Za-z_][A-Za-z0-9_]*)|\[(\d*)\]/g)].map((m) => (m[1] !== undefined ? { key: m[1] } : { index: m[2] === '' ? null : Number(m[2]) }));
  let values = [value];
  steps.forEach((s) => {
    values = values.flatMap((v) => {
      if (s.key !== undefined) return [v?.[s.key] ?? null];
      if (!Array.isArray(v)) return [null];
      return s.index === null ? v : [v[s.index] ?? null];
    });
  });
  return values;
}

const printValue = (v) => (typeof v === 'string' ? v : JSON.stringify(v));

/** The output of a command: JSON, or the lines of a `--jq` path. */
function render(value, flags) {
  if (flags.jq) return `${applyPath(value, flags.jq).map(printValue).join('\n')}\n`;
  return `${JSON.stringify(value)}\n`;
}

// ---- commands

const enc = encodeURIComponent;

function bodyOf(flags, readFile) {
  if (flags['body-file'] !== undefined) {
    try {
      return readFile(flags['body-file']);
    } catch (err) {
      return refuse(`cannot read ${flags['body-file']}: ${err.message}`);
    }
  }
  return flags.body;
}

function readJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return refuse('GitHub answered with something that is not JSON');
  }
}

function pages(api, path) {
  return readJson(api(['api', '--paginate', '--slurp', path])).flat();
}

function humanIssue(issue, comments) {
  const lines = [
    `title:\t${issue.title}`,
    `state:\t${issue.state}`,
    `number:\t${issue.number}`,
    `labels:\t${issue.labels.map((l) => l.name).join(', ')}`,
    `assignees:\t${issue.assignees.map((a) => a.login).join(', ')}`,
    `milestone:\t${issue.milestone?.title ?? ''}`,
    '--',
    issue.body,
  ];
  (comments ?? []).forEach((c) => lines.push('--', `${c.author?.login ?? 'unknown'} commented ${c.createdAt ?? ''}`, '', c.body));
  return `${lines.join('\n')}\n`;
}

function issueView({ positional, flags }, ctx) {
  const n = positional[0].replace(/^#/, '');
  if (!/^\d+$/.test(n)) refuse(`"${positional[0]}" is not an issue number`);
  const fields = wantedFields('issue view', flags);
  const issue = shapeIssue(readJson(ctx.api(['api', `repos/${ctx.repo}/issues/${n}`])));
  const needComments = flags.comments || (fields ?? []).includes('comments');
  const comments = needComments ? pages(ctx.api, `repos/${ctx.repo}/issues/${n}/comments?per_page=100`).map(shapeComment) : null;
  if (!fields) return humanIssue(issue, flags.comments ? comments : null);
  return render(pick({ ...issue, comments }, fields), flags);
}

function issueList({ flags }, ctx) {
  const fields = wantedFields('issue list', flags);
  const state = flags.state ?? 'open';
  if (!['open', 'closed', 'all'].includes(state)) refuse(`--state must be open, closed or all, not "${state}"`);
  const limit = flags.limit === undefined ? 30 : Number(flags.limit);
  if (!Number.isInteger(limit) || limit < 1) refuse('--limit must be a positive number');
  let raw;
  if (flags.search) {
    const terms = [flags.search, `repo:${ctx.repo}`, 'is:issue', ...(state === 'all' ? [] : [`state:${state}`]), ...(flags.label ?? []).map((l) => `label:"${l}"`), ...(flags.assignee ? [`assignee:${flags.assignee}`] : [])];
    raw = readJson(ctx.api(['api', '--paginate', '--slurp', '-X', 'GET', 'search/issues', '-f', `q=${terms.join(' ')}`, '-f', `per_page=${Math.min(limit, 100)}`])).flatMap((p) => p.items ?? []);
  } else {
    const query = [`state=${state}`, 'per_page=100', ...(flags.label?.length ? [`labels=${enc(flags.label.join(','))}`] : []), ...(flags.assignee ? [`assignee=${enc(flags.assignee)}`] : [])];
    raw = pages(ctx.api, `repos/${ctx.repo}/issues?${query.join('&')}`);
  }
  const issues = raw.filter((i) => !i.pull_request).slice(0, limit).map(shapeIssue);
  if (!fields) return issues.map((i) => [i.number, i.state, i.title, i.labels.map((l) => l.name).join(', '), i.updatedAt ?? ''].join('\t')).join('\n') + (issues.length ? '\n' : '');
  return render(issues.map((i) => pick(i, fields)), flags);
}

function findMilestone(api, repo, title) {
  const found = pages(api, `repos/${repo}/milestones?state=all&per_page=100`).find((m) => m.title === title);
  if (!found) refuse(`no milestone "${title}" in ${repo}; the issue was not created`);
  return found.number;
}

function issueCreate({ flags }, ctx) {
  if (!flags.title) refuse('"gh issue create" needs --title');
  const body = bodyOf(flags, ctx.readFile) ?? '';
  const payload = { title: flags.title, body };
  if (flags.milestone) payload.milestone = findMilestone(ctx.api, ctx.repo, flags.milestone);
  if (flags.assignee?.length) payload.assignees = flags.assignee.map((a) => (a === '@me' ? readJson(ctx.api(['api', 'user'])).login : a));
  if (flags.label?.length) payload.labels = flags.label;
  const created = readJson(ctx.api(['api', '-X', 'POST', `repos/${ctx.repo}/issues`, '--input', '-'], JSON.stringify(payload)));
  return `${created.html_url}\n`;
}

function issueEdit({ positional, flags }, ctx) {
  const n = positional[0].replace(/^#/, '');
  if (!/^\d+$/.test(n)) refuse(`"${positional[0]}" is not an issue number`);
  const patch = {};
  if (flags.title !== undefined) patch.title = flags.title;
  const body = bodyOf(flags, ctx.readFile);
  if (body !== undefined) patch.body = body;
  if (Object.keys(patch).length === 0 && !flags['add-label']?.length && !flags['remove-label']?.length) refuse('"gh issue edit" got nothing to change');
  let url = `https://github.com/${ctx.repo}/issues/${n}`;
  if (Object.keys(patch).length) url = readJson(ctx.api(['api', '-X', 'PATCH', `repos/${ctx.repo}/issues/${n}`, '--input', '-'], JSON.stringify(patch))).html_url ?? url;
  if (flags['add-label']?.length) ctx.api(['api', '-X', 'POST', `repos/${ctx.repo}/issues/${n}/labels`, '--input', '-'], JSON.stringify({ labels: flags['add-label'] }));
  (flags['remove-label'] ?? []).forEach((name) => {
    try {
      ctx.api(['api', '-X', 'DELETE', `repos/${ctx.repo}/issues/${n}/labels/${enc(name)}`]);
    } catch (err) {
      if (describeFailure(err, ctx.env).status !== 404) throw err; // a label the issue does not carry is already gone
    }
  });
  return `${url}\n`;
}

function repoView({ positional, flags }, ctx) {
  const fields = wantedFields('repo view', flags);
  const repo = positional[0] ?? ctx.repo;
  const raw = readJson(ctx.api(['api', `repos/${repo}`]));
  const shaped = { nameWithOwner: raw.full_name, name: raw.name, url: raw.html_url, defaultBranchRef: { name: raw.default_branch } };
  if (!fields) return `${raw.full_name}\n${raw.description ?? ''}\n`;
  return render(pick(shaped, fields), flags);
}

function labelCreate({ positional, flags }, ctx) {
  const name = positional[0];
  const payload = { name, ...(flags.color ? { color: flags.color.replace(/^#/, '') } : {}), ...(flags.description !== undefined ? { description: flags.description } : {}) };
  try {
    ctx.api(['api', '-X', 'POST', `repos/${ctx.repo}/labels`, '--input', '-'], JSON.stringify(payload));
  } catch (err) {
    const failure = describeFailure(err, ctx.env);
    if (failure.status !== 422 || !flags.force) throw err;
    const { name: _unused, ...changes } = payload;
    ctx.api(['api', '-X', 'PATCH', `repos/${ctx.repo}/labels/${enc(name)}`, '--input', '-'], JSON.stringify(changes));
  }
  return `✓ Label "${name}" created in ${ctx.repo}\n`;
}

const COMMANDS = { 'issue view': issueView, 'issue list': issueList, 'issue create': issueCreate, 'issue edit': issueEdit, 'repo view': repoView, 'label create': labelCreate };

// ---- access

/**
 * Whether the session can reach the repository: a read over REST. { ok, repo } or { ok: false, repo, status, message }.
 * It is what decides "GitHub can be reached" in a remote session, because the sign-in status of `gh` fails there with a
 * token that works.
 */
export function githubAccess({ env, api, git, repo }) {
  const name = repo ?? findRepo({ env, git });
  if (!name) return { ok: false, repo: null, status: null, message: 'no repository found: there is no origin remote and GITHUB_REPOSITORY is not set' };
  try {
    api(['api', `repos/${name}`, '--jq', '.full_name']);
    return { ok: true, repo: name };
  } catch (err) {
    const { status, text } = describeFailure(err, env);
    const message = status === 401 ? `the session has no usable GitHub token (${text})` : status === 404 ? `${name} was not found or the token cannot see it (${text})` : text;
    return { ok: false, repo: name, status, message };
  }
}

// ---- the access check as a command: `gh-web.mjs --access [--repo owner/name]`

function access(rest, io) {
  if (!isRemote(io.env)) return io.passthrough(['auth', 'status']);
  const i = rest.indexOf('--repo');
  const result = githubAccess({ env: io.env, api: io.api, git: io.git, repo: i === -1 ? undefined : rest[i + 1] });
  if (result.ok) {
    io.out(`GitHub can be reached from this web session (${result.repo} read over the REST API)\n`);
    return 0;
  }
  io.err(`this web session cannot reach GitHub: ${result.message}\n`);
  return 1;
}

// ---- entry

/**
 * Runs one command. io: { env, api, git, passthrough, readFile, out, err }. Returns the exit code.
 * Outside a remote session, and for `gh api` in any session, the real `gh` runs with the same arguments.
 */
export function main(argv, io) {
  if (argv[0] === '--access') return access(argv.slice(1), io);
  // `gh api` is the REST API itself: it works in a web session, so it goes to `gh` as it is in every session. A skill that
  // sends all its GitHub calls through this script, `api` ones included, then keeps working.
  if (!isRemote(io.env) || argv[0] === 'api') return io.passthrough(argv);
  try {
    const parsed = parseArgs(argv);
    const repoFlag = parsed.flags.repo;
    const repo = parsed.key === 'repo view' && parsed.positional[0] ? parsed.positional[0] : findRepo({ flag: repoFlag, env: io.env, git: io.git });
    if (!repo) refuse('cannot tell which repository to use: pass --repo owner/name');
    const output = COMMANDS[parsed.key](parsed, { api: io.api, repo, env: io.env, readFile: io.readFile });
    io.out(output);
    return 0;
  } catch (err) {
    if (err instanceof Refusal) {
      io.err(`${redact(err.message, io.env)}\n`);
      return 1;
    }
    io.err(`${describeFailure(err, io.env).text}\n`);
    return 1;
  }
}
