// Scans for temporary markers and credentials.
// Used before every commit, push and merge, and when validating relevo.yml.
// Findings never include the secret itself, only what kind of secret it looks like.

const MARKER_RE = /(\/\/|#|<!--|\/\*)\s*(NOCOMMIT|TEMP|DO NOT COMMIT)\b/;

const CREDENTIAL_PATTERNS = [
  { name: 'anthropic-key', re: /sk-ant-[A-Za-z0-9_-]{10,}/ },
  { name: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: 'github-fine-grained-token', re: /\bgithub_pat_[A-Za-z0-9_]{20,}/ },
  { name: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    // A name that holds a secret, assigned a long value. The value decides (see `assignedSecret`): code that only names
    // a secret (a variable, a call, a member) is not one.
    name: 'assigned-secret',
    re: /\b(api[_-]?key|secret|token|password|passwd)\b["']?\s*[:=]\s*(["'])?([A-Za-z0-9_\-/+=]{16,})/gi,
    accept: assignedSecret,
  },
];

/**
 * Is this match of the `assigned-secret` pattern a literal secret? A quoted value is. An unquoted one is only when it
 * looks like generated text (letters mixed with digits, or `/`, `+` or `=` as in base64) and is not the start of a call
 * (`(`), a member access (`.`) or an index (`[`): `token: someLongVariableName` and `password = readPasswordFromVault(x)` are code.
 */
function assignedSecret(match, text) {
  const [whole, , quote, value] = match;
  if (quote) return true;
  const next = text[match.index + whole.length];
  if (next === '(' || next === '.' || next === '[') return false;
  return (/[A-Za-z]/.test(value) && /\d/.test(value)) || /[/+=]/.test(value);
}

// A long unbroken token is only suspicious in a configuration value, not in code.
const OPAQUE_TOKEN_RE = /^[A-Za-z0-9+/_-]{40,}$/;

/** Returns [{ name }] for every credential-looking pattern in `text`. */
export function findCredentials(text, { strict = false } = {}) {
  const found = CREDENTIAL_PATTERNS.filter(({ re, accept }) => {
    if (!accept) return re.test(text);
    return [...text.matchAll(re)].some((match) => accept(match, text));
  }).map(({ name }) => ({ name }));
  if (strict && OPAQUE_TOKEN_RE.test(text.trim())) found.push({ name: 'opaque-token' });
  return found;
}

/** Returns the marker found in a line of text, or null. */
export function findMarker(text) {
  const m = text.match(MARKER_RE);
  return m ? m[2] : null;
}

/**
 * Scan a unified diff (for example `git diff --cached`). Only added lines are checked.
 * Returns [{ file, line, kind: 'marker' | 'credential', detail }].
 */
export function scanDiff(diffText) {
  const findings = [];
  let file = null;
  let line = 0;
  String(diffText).split('\n').forEach((raw) => {
    if (raw.startsWith('+++ ')) {
      const target = raw.slice(4).trim();
      file = target === '/dev/null' ? null : target.replace(/^b\//, '');
      return;
    }
    if (raw.startsWith('--- ') || raw.startsWith('diff --git') || raw.startsWith('index ')) return;
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      line = Number.parseInt(hunk[1], 10);
      return;
    }
    if (raw.startsWith('+')) {
      const added = raw.slice(1);
      const marker = findMarker(added);
      if (marker) findings.push({ file, line, kind: 'marker', detail: marker });
      findCredentials(added).forEach(({ name }) => findings.push({ file, line, kind: 'credential', detail: name }));
      line += 1;
    } else if (raw.startsWith(' ')) {
      line += 1;
    }
  });
  return findings;
}

export function formatFindings(findings) {
  return findings
    .map((f) => `${f.file ?? '(unknown file)'}:${f.line}  ${f.kind === 'marker' ? 'temporary marker' : 'possible credential'} (${f.detail})`)
    .join('\n');
}
