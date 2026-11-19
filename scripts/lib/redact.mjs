// Replaces secrets in text that a run prints or saves from the agent's log. Implements "Secrets are redacted from the
// agent's output that a run prints or saves" of the security specification.
//
// It works on text only: it never opens a path, so it cannot read a restricted file. It is a second line of defence and
// not a control: a secret in a shape it does not know passes, which is why the output it protects is off by default.

export const REDACTED = '[redacted]';

// Values shorter than this are not replaced by value: "1" or "true" would eat ordinary text.
const MIN_VALUE_LENGTH = 8;

// A name that holds a credential: the value of NAME=value or NAME: value is replaced whatever its shape.
const CREDENTIAL_NAME = String.raw`[A-Za-z0-9_.-]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PASSPHRASE|CREDENTIAL|AUTH)[A-Za-z0-9_.-]*`;

// Each rule: [regex, replacement]. The order matters: blocks first, then shapes, then assignments.
const RULES = [
  // A PEM block (private keys), through its end line; an unterminated block goes to the end of the text.
  [/-----BEGIN [A-Z0-9 ]*(?:PRIVATE KEY|CERTIFICATE)-----[\s\S]*?(?:-----END [A-Z0-9 ]*(?:PRIVATE KEY|CERTIFICATE)-----|$)/g, REDACTED],
  // Credentials inside a URL: scheme://user:password@host (.git-credentials, remotes, connection strings).
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, `$1${REDACTED}@`],
  // Authorization headers and bearer values.
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/g, `$1 ${REDACTED}`],
  // Known token shapes.
  [/\bsk-ant-[A-Za-z0-9_-]{8,}/g, REDACTED],
  [/\bsk-[A-Za-z0-9]{20,}/g, REDACTED],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/g, REDACTED],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, REDACTED],
  [/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, REDACTED],
  [/\bAIza[0-9A-Za-z_-]{30,}/g, REDACTED],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, REDACTED],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, REDACTED],
  // .npmrc: //registry/:_authToken=value and _auth=value.
  [/(_auth(?:Token)?\s*=\s*)\S+/gi, `$1${REDACTED}`],
  // .pgpass: host:port:database:user:password, with a port and no spaces.
  [/\b([A-Za-z0-9_.*-]+:(?:\d{1,5}|\*):[A-Za-z0-9_.*-]+:[A-Za-z0-9_.*-]+:)[^\s:]+/g, `$1${REDACTED}`],
  // NAME=value, NAME: value and "NAME": "value" with a credential name; keeps the name and the separator.
  [new RegExp(String.raw`(["']?${CREDENTIAL_NAME}["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s"',;}]+)`, 'gi'), `$1${REDACTED}`],
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The exact values worth replacing: the secret as given and in base64, longest first so a long value is not cut by a short one. */
function valuesOf(secrets) {
  const out = new Set();
  (secrets ?? []).forEach((s) => {
    const v = String(s ?? '');
    if (v.length < MIN_VALUE_LENGTH) return;
    out.add(v);
    out.add(Buffer.from(v, 'utf8').toString('base64'));
  });
  return [...out].sort((a, b) => b.length - a.length);
}

/**
 * text     what the agent wrote or read
 * secrets  the values of the secrets the job holds (the model credential, the workflow token)
 * Returns the text with every known shape and every given value replaced by "[redacted]".
 */
export function redact(text, { secrets = [] } = {}) {
  let out = String(text ?? '');
  valuesOf(secrets).forEach((v) => {
    out = out.replace(new RegExp(escape(v), 'g'), REDACTED);
  });
  RULES.forEach(([re, to]) => {
    out = out.replace(re, to);
  });
  return out;
}
