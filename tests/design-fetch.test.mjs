import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadAttachment, FILES_MAX, fetchReferences, fetchRepoFile, HOPS_MAX, IMAGE_MAX, isText, sniffImage, TEXT_MAX } from '../scripts/lib/design-fetch.mjs';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 2)]);
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(32, 3)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP'), Buffer.alloc(32, 4)]);
const URL1 = 'https://github.com/user-attachments/assets/0a1b2c3d-1111-2222-3333-444455556666';
const CDN = 'https://private-user-images.githubusercontent.com/1/2.png?jwt=signed';

/** A fake fetch: `routes` maps a url to { status, location?, body? } and every call is recorded. */
function fakeFetch(routes) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, headers: options?.headers ?? {}, redirect: options?.redirect });
    const r = routes[url];
    if (!r) return new Response('not found', { status: 404 });
    const headers = r.location ? { location: r.location } : {};
    return new Response(r.body ?? null, { status: r.status ?? 200, headers });
  };
  return { fetch, calls };
}

test('the type of an image comes from its first bytes', () => {
  assert.equal(sniffImage(PNG), 'png');
  assert.equal(sniffImage(JPEG), 'jpeg');
  assert.equal(sniffImage(GIF), 'gif');
  assert.equal(sniffImage(WEBP), 'webp');
  assert.equal(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null, 'an SVG is not accepted');
  assert.equal(sniffImage(Buffer.from('not an image.png')), null);
  assert.equal(sniffImage(Buffer.alloc(0)), null);
});

test('text is UTF-8 without NUL bytes', () => {
  assert.equal(isText(Buffer.from('<template>ñ</template>')), true);
  assert.equal(isText(Buffer.from([0x68, 0x00, 0x69])), false);
  assert.equal(isText(Buffer.from([0xff, 0xfe, 0xfd])), false);
});

test('a good attachment: github.com redirects to the signed host, and each image type is kept', async () => {
  for (const [buf, type] of [[PNG, 'png'], [JPEG, 'jpeg'], [GIF, 'gif'], [WEBP, 'webp']]) {
    const { fetch } = fakeFetch({ [URL1]: { status: 302, location: CDN }, [CDN]: { body: buf } });
    const r = await downloadAttachment(URL1, { fetch, token: 'ghs_secret' });
    assert.deepEqual([r.ok, r.type, r.buf.length], [true, type, buf.length]);
  }
});

test('the token goes to github.com and never to the host that serves the file', async () => {
  const { fetch, calls } = fakeFetch({ [URL1]: { status: 302, location: CDN }, [CDN]: { body: PNG } });
  await downloadAttachment(URL1, { fetch, token: 'ghs_secret' });
  assert.equal(calls[0].headers.authorization, 'Bearer ghs_secret');
  assert.deepEqual(calls[1].headers, {});
  assert.ok(calls.every((c) => c.redirect === 'manual'), 'redirects are followed by hand');
});

test('Scenario: Address outside the domains - nothing is requested', async () => {
  const { fetch, calls } = fakeFetch({});
  const r = await downloadAttachment('https://evil.example.com/a.png', { fetch, token: 't' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /evil\.example\.com is not an allowed host/);
  assert.equal(calls.length, 0);
  assert.match((await downloadAttachment('http://github.com/user-attachments/assets/x', { fetch })).reason, /not an allowed host/, 'plain http is refused');
  assert.match((await downloadAttachment('file:///etc/passwd', { fetch })).reason, /not an allowed host/);
});

test('Scenario: Redirect to another host - the download stops and the token is not sent there', async () => {
  const { fetch, calls } = fakeFetch({ [URL1]: { status: 302, location: 'https://evil.example.com/steal' }, 'https://evil.example.com/steal': { body: PNG } });
  const r = await downloadAttachment(URL1, { fetch, token: 'ghs_secret' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /evil\.example\.com is not an allowed host/);
  assert.equal(calls.length, 1, 'the second host was never called');
});

test('a chain of redirects longer than the limit stops', async () => {
  const routes = {};
  for (let i = 0; i <= HOPS_MAX + 1; i += 1) routes[`https://github.com/user-attachments/assets/hop${i}`] = { status: 302, location: `https://github.com/user-attachments/assets/hop${i + 1}` };
  const { fetch } = fakeFetch(routes);
  const r = await downloadAttachment('https://github.com/user-attachments/assets/hop0', { fetch });
  assert.match(r.reason, /more than 5 redirects/);
});

test('Scenario: Too large - an image over the cap is cut while it streams and is not kept', async () => {
  let pulled = 0;
  const stream = new ReadableStream({
    pull(controller) {
      pulled += 1;
      controller.enqueue(new Uint8Array(1024 * 1024).fill(7));
      if (pulled > 20) controller.close();
    },
  });
  const { fetch } = fakeFetch({ [URL1]: { body: stream } });
  const r = await downloadAttachment(URL1, { fetch });
  assert.equal(r.ok, false);
  assert.match(r.reason, /larger than 5 MB/);
  assert.ok(pulled <= 7, `it stopped reading at the cap (read ${pulled} MB)`);
  assert.equal(IMAGE_MAX, 5 * 1024 * 1024);
  const declared = await downloadAttachment(URL1, { fetch: async () => new Response(PNG, { status: 200, headers: { 'content-length': String(IMAGE_MAX + 1) } }) });
  assert.match(declared.reason, /larger than 5 MB/, 'a declared length over the cap is refused before reading');
});

test('a file named .png whose bytes are not an image, an SVG and an error status are refused with a reason', async () => {
  const text = await downloadAttachment(URL1, { fetch: fakeFetch({ [URL1]: { body: 'not really a picture' } }).fetch });
  assert.match(text.reason, /not a PNG, JPEG, GIF or WebP/);
  const svg = await downloadAttachment(URL1, { fetch: fakeFetch({ [URL1]: { body: '<svg onload="x()"></svg>' } }).fetch });
  assert.match(svg.reason, /not a PNG, JPEG, GIF or WebP/);
  assert.match((await downloadAttachment(URL1, { fetch: fakeFetch({ [URL1]: { status: 404 } }).fetch })).reason, /answered 404.*token may not read it/);
  assert.match((await downloadAttachment(URL1, { fetch: fakeFetch({ [URL1]: { status: 500 } }).fetch })).reason, /answered 500$/);
  const boom = await downloadAttachment(URL1, { fetch: async () => { throw new Error('socket hang up'); } });
  assert.match(boom.reason, /download failed: socket hang up/);
});

const fileJson = (text, over = {}) => JSON.stringify({ type: 'file', size: Buffer.byteLength(text), encoding: 'base64', content: Buffer.from(text).toString('base64'), ...over });

test('a text file of a linked repository is read through gh and decoded', async () => {
  const gh = (args) => {
    assert.deepEqual(args, ['api', 'repos/acme/design/contents/components/Card.vue']);
    return fileJson('<template><div class="card"/></template>');
  };
  const r = await fetchRepoFile({ repo: 'acme/design', path: 'components/Card.vue' }, { gh });
  assert.deepEqual([r.ok, r.type, r.buf.toString()], [true, 'text', '<template><div class="card"/></template>']);
});

test('a repository file over 200 KB, a binary, a directory and an unreadable repository are refused', async () => {
  assert.match((await fetchRepoFile({ repo: 'a/b', path: 'x' }, { gh: () => fileJson('x', { size: TEXT_MAX + 1 }) })).reason, /larger than 200 KB/);
  assert.match((await fetchRepoFile({ repo: 'a/b', path: 'x' }, { gh: () => JSON.stringify({ type: 'file', size: 3, encoding: 'base64', content: Buffer.from([0, 1, 2]).toString('base64') }) })).reason, /not text/);
  assert.match((await fetchRepoFile({ repo: 'a/b', path: 'x' }, { gh: () => JSON.stringify([{ name: 'f' }]) })).reason, /not a file/);
  assert.match((await fetchRepoFile({ repo: 'a/b', path: 'x' }, { gh: () => { throw new Error('HTTP 404'); } })).reason, /a\/b could not be read: HTTP 404/);
});

test('references become files: a path is checked, an attachment needs design.images, a repository must be linked', async () => {
  const refs = [
    { kind: 'path', target: 'design/home.png', path: 'design/home.png', match: 'layout' },
    { kind: 'attachment', target: URL1, allowed: true, match: 'empty state' },
    { kind: 'repo-file', target: 'acme/design:Card.vue', repo: 'acme/design', path: 'Card.vue', match: 'the card' },
  ];
  const common = { exists: (p) => p === 'design/home.png', fetch: fakeFetch({ [URL1]: { body: PNG } }).fetch, gh: () => fileJson('<template/>') };
  const off = await fetchReferences({ references: refs, images: false, links: [], ...common });
  assert.deepEqual(off.files.map((f) => f.kind), ['path']);
  assert.match(off.refused[0].reason, /design\.images is off/);
  assert.match(off.refused[1].reason, /acme\/design is not in links/);
  const on = await fetchReferences({ references: refs, images: true, links: ['acme/design'], ...common });
  assert.deepEqual(on.files.map((f) => f.kind), ['path', 'attachment', 'repo-file']);
  assert.deepEqual(on.refused, []);
  const missing = await fetchReferences({ references: [refs[0]], images: true, exists: () => false });
  assert.match(missing.refused[0].reason, /does not exist in the repository/);
});

test('the sixth file is refused', async () => {
  const refs = Array.from({ length: FILES_MAX + 1 }, (_, i) => ({ kind: 'path', target: `d/${i}.png`, path: `d/${i}.png`, match: 'x' }));
  const r = await fetchReferences({ references: refs, exists: () => true });
  assert.equal(r.files.length, FILES_MAX);
  assert.match(r.refused[0].reason, /more than 5 references/);
});

test('an attachment outside the domains is refused without a request', async () => {
  const { fetch, calls } = fakeFetch({});
  const r = await fetchReferences({ references: [{ kind: 'attachment', target: 'https://evil.example.com/a.png', allowed: false, match: 'x' }], images: true, fetch });
  assert.match(r.refused[0].reason, /not a GitHub attachment/);
  assert.equal(calls.length, 0);
});
