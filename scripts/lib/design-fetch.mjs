// Downloads the references of a design reference, inside fixed limits. Implements "The fetcher stays inside fixed
// limits" of openspec/specs/go/spec.md. The network and `gh` are injected so the module is tested without either.

import { ATTACHMENT_HOSTS, MAX_REFERENCES } from './issue-parse.mjs';

export const IMAGE_MAX = 5 * 1024 * 1024;
export const TEXT_MAX = 200 * 1024;
export const FILES_MAX = MAX_REFERENCES;
export const HOPS_MAX = 5;
// Where a download may be redirected to: the attachment domains and the host that serves them signed.
export const REDIRECT_HOSTS = [...ATTACHMENT_HOSTS, 'objects.githubusercontent.com'];
// The token is sent only here.
const TOKEN_HOSTS = new Set(['github.com', 'api.github.com']);

/** png, jpeg, gif or webp from the first bytes, or null. The name and the Content-Type are never trusted. */
export function sniffImage(buf) {
  const b = Buffer.from(buf);
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 6 && ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1'))) return 'gif';
  if (b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

/** Is it UTF-8 text, with no NUL byte? */
export function isText(buf) {
  const b = Buffer.from(buf);
  if (b.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(b);
    return true;
  } catch {
    return false;
  }
}

const hostOf = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.hostname : null;
  } catch {
    return null;
  }
};

async function readCapped(res, max) {
  const declared = Number(res.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > max) return { tooLarge: true };
  if (!res.body?.getReader) {
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > max ? { tooLarge: true } : { buf };
  }
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return { tooLarge: true };
    }
    chunks.push(Buffer.from(value));
  }
  return { buf: Buffer.concat(chunks) };
}

/**
 * Download one pasted attachment. Redirects are followed by hand and only to REDIRECT_HOSTS; the token goes only to
 * GitHub. Returns { ok: true, buf, type } or { ok: false, reason }.
 */
export async function downloadAttachment(url, { fetch, token = null, max = IMAGE_MAX } = {}) {
  let current = url;
  for (let hop = 0; hop <= HOPS_MAX; hop += 1) {
    const host = hostOf(current);
    if (!host || !REDIRECT_HOSTS.includes(host)) return { ok: false, reason: `${host ?? 'that address'} is not an allowed host` };
    const headers = token && TOKEN_HOSTS.has(host) ? { authorization: `Bearer ${token}` } : {};
    let res;
    try {
      res = await fetch(current, { redirect: 'manual', headers });
    } catch (error) {
      return { ok: false, reason: `the download failed: ${String(error?.message ?? error).split('\n')[0]}` };
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers?.get?.('location');
      if (!location) return { ok: false, reason: 'the redirect has no destination' };
      current = new URL(location, current).href;
      continue;
    }
    if (res.status !== 200) return { ok: false, reason: `GitHub answered ${res.status}${res.status === 404 || res.status === 403 ? ' (the token may not read it)' : ''}` };
    const { buf, tooLarge } = await readCapped(res, max);
    if (tooLarge) return { ok: false, reason: `the file is larger than ${Math.round(max / 1024 / 1024)} MB` };
    const type = sniffImage(buf);
    if (!type) return { ok: false, reason: 'the file is not a PNG, JPEG, GIF or WebP image' };
    return { ok: true, buf, type };
  }
  return { ok: false, reason: `more than ${HOPS_MAX} redirects` };
}

/** One file of a linked repository, read through `gh api` (injected). Returns { ok, buf, type } or { ok: false, reason }. */
export async function fetchRepoFile({ repo, path }, { gh, max = TEXT_MAX } = {}) {
  let info;
  try {
    info = JSON.parse(gh(['api', `repos/${repo}/contents/${path}`]));
  } catch (error) {
    return { ok: false, reason: `${repo} could not be read: ${String(error?.message ?? error).split('\n')[0]}` };
  }
  if (Array.isArray(info) || info.type !== 'file') return { ok: false, reason: `${path} is not a file` };
  if (info.size > max) return { ok: false, reason: `the file is larger than ${Math.round(max / 1024)} KB` };
  if (info.encoding !== 'base64' || typeof info.content !== 'string') return { ok: false, reason: 'the file could not be read' };
  const buf = Buffer.from(info.content, 'base64');
  if (buf.length > max) return { ok: false, reason: `the file is larger than ${Math.round(max / 1024)} KB` };
  if (!isText(buf)) return { ok: false, reason: 'the file is not text' };
  return { ok: true, buf, type: 'text' };
}

/**
 * The references of an issue (from parseDesign) turned into files.
 *   references  [{ kind, target, repo?, path?, allowed?, match }]
 *   images      design.images
 *   links       the linked repositories
 *   exists      (path) => boolean, for the references to files of the repository
 * Returns { files: [{ reference, kind, buf?, type }], refused: [{ reference, reason }] }.
 * A `path` reference needs no download: it is checked and the builder reads it where it is.
 */
export async function fetchReferences({ references, images = false, links = [], exists, fetch, gh, token = null }) {
  const files = [];
  const refused = [];
  for (const ref of references) {
    if (files.length >= FILES_MAX) {
      refused.push({ reference: ref.target, reason: `more than ${FILES_MAX} references` });
      continue;
    }
    if (ref.kind === 'path') {
      if (exists(ref.path)) files.push({ reference: ref.target, kind: 'path', path: ref.path, type: 'repository' });
      else refused.push({ reference: ref.target, reason: 'the file does not exist in the repository' });
    } else if (ref.kind === 'attachment') {
      if (!ref.allowed) refused.push({ reference: ref.target, reason: 'it is not a GitHub attachment' });
      else if (!images) refused.push({ reference: ref.target, reason: 'design.images is off: turn it on in relevo.yml, or commit the picture to the repository and point to the file' });
      else {
        const r = await downloadAttachment(ref.target, { fetch, token });
        if (r.ok) files.push({ reference: ref.target, kind: 'attachment', buf: r.buf, type: r.type });
        else refused.push({ reference: ref.target, reason: r.reason });
      }
    } else if (ref.kind === 'repo-file') {
      if (!links.includes(ref.repo)) refused.push({ reference: ref.target, reason: `${ref.repo} is not in links of relevo.yml` });
      else {
        const r = await fetchRepoFile(ref, { gh });
        if (r.ok) files.push({ reference: ref.target, kind: 'repo-file', buf: r.buf, type: r.type, path: ref.path });
        else refused.push({ reference: ref.target, reason: r.reason });
      }
    }
  }
  return { files, refused };
}
