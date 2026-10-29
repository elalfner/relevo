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

/** GitHub's own words from a failed `gh` call: its error line when there is one, else the first line of the message. */
function ghMessage(error) {
  const stderr = String(error?.stderr ?? '').trim();
  const line = stderr.split('\n').find((l) => l.trim() !== '');
  return (line ?? String(error?.message ?? error).split('\n')[0]).trim();
}

/**
 * Why a linked repository could not be read, in terms the person can act on. A 404 or 403 names what reads it:
 * the RELEVO_LINKS_TOKEN secret, the cloud without it, or the person's own `gh` login.
 */
export function unreadableReason(repo, error, { linksToken = false, cloud = false } = {}) {
  const text = `${String(error?.stderr ?? '')}\n${String(error?.message ?? error)}`;
  const code = text.match(/HTTP (\d{3})/)?.[1];
  if (code !== '404' && code !== '403') return `${repo} could not be read: ${ghMessage(error)}`;
  if (linksToken) return `the RELEVO_LINKS_TOKEN secret cannot read ${repo} (GitHub answered ${code}): give it read access to the contents of ${repo}`;
  if (cloud) return `${repo} could not be read without a token (GitHub answered ${code}): if it is private, store a token with read access to its contents as the secret RELEVO_LINKS_TOKEN`;
  return `your gh login cannot read ${repo} (GitHub answered ${code})`;
}

/**
 * One file of a linked repository. The metadata comes first (`gh`, injected), so a directory or a file over the image
 * limit is refused without downloading it; then the raw bytes (`ghRaw`, injected, returns a Buffer). The bytes decide
 * what it is: an image up to IMAGE_MAX, else UTF-8 text up to TEXT_MAX. Returns { ok, buf, type } or { ok: false, reason }.
 */
export async function fetchRepoFile({ repo, path }, { gh, ghRaw, linksToken = false, cloud = false } = {}) {
  const endpoint = `repos/${repo}/contents/${path}`;
  let info;
  let buf;
  try {
    info = JSON.parse(gh(['api', endpoint]));
    if (Array.isArray(info) || info.type !== 'file') return { ok: false, reason: `${path} is not a file` };
    if (info.size > IMAGE_MAX) return { ok: false, reason: `the file is larger than ${Math.round(IMAGE_MAX / 1024 / 1024)} MB` };
    buf = Buffer.from(ghRaw(['api', '-H', 'Accept: application/vnd.github.raw', endpoint]));
  } catch (error) {
    return { ok: false, reason: unreadableReason(repo, error, { linksToken, cloud }) };
  }
  const image = sniffImage(buf);
  if (image) {
    if (buf.length > IMAGE_MAX) return { ok: false, reason: `the file is larger than ${Math.round(IMAGE_MAX / 1024 / 1024)} MB` };
    return { ok: true, buf, type: image };
  }
  if (!isText(buf)) return { ok: false, reason: 'the file is neither a PNG, JPEG, GIF or WebP image nor text' };
  if (buf.length > TEXT_MAX) return { ok: false, reason: `the file is larger than ${Math.round(TEXT_MAX / 1024)} KB` };
  return { ok: true, buf, type: 'text' };
}

/**
 * The references of an issue (from parseDesign) turned into files.
 *   references  [{ kind, target, repo?, path?, allowed?, match, section? }] (section: 'design' or 'code-pointer')
 *   images      design.images
 *   links       the linked repositories
 *   exists      (path) => boolean, for the references to files of the repository
 * Returns { files: [{ reference, kind, buf?, type }], refused: [{ reference, reason }] }.
 * A `path` reference needs no download: it is checked and the builder reads it where it is.
 */
export async function fetchReferences({ references, images = false, links = [], exists, fetch, gh, ghRaw, token = null, linksToken = false, cloud = false }) {
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
        const r = await fetchRepoFile(ref, { gh, ghRaw, linksToken, cloud });
        if (r.ok) files.push({ reference: ref.target, kind: 'repo-file', buf: r.buf, type: r.type, path: ref.path, ...(ref.section ? { section: ref.section } : {}) });
        else refused.push({ reference: ref.target, reason: r.reason });
      }
    }
  }
  return { files, refused };
}
