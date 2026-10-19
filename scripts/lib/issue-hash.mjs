// A hash of the text of an issue, to know that what is built is what a person approved.
// Implements "The issue that is built is the issue that was approved" of the security specification.

import { createHash } from 'node:crypto';

const normalize = (text) => String(text ?? '')
  .replace(/\r\n?/g, '\n')
  .split('\n')
  .map((line) => line.replace(/[ \t]+$/, ''))
  .join('\n')
  .trim();

/** SHA-256 (hex) of the title and the body. Line endings and trailing spaces do not change it. */
export function issueHash({ title, body }) {
  return createHash('sha256').update(`${normalize(title)}\n\n${normalize(body)}`, 'utf8').digest('hex');
}

/** The first characters of a hash, for messages. */
export const shortHash = (hash, length = 8) => String(hash ?? '').slice(0, length);

/** Compare the text of an issue with the hash it was claimed with. Returns { ok, actual }. */
export function checkIssueHash({ expected, title, body }) {
  const actual = issueHash({ title, body });
  return { ok: actual === String(expected ?? '').toLowerCase(), actual };
}
