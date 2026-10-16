import assert from 'node:assert/strict';
import { demoInput, encrypt, fromBase64Url, toBase64Url } from '../src/main/resources/static/crypto-protocol.mjs';

const base = (process.argv[2] || 'http://127.0.0.1:8080').replace(/\/$/, '');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname))
  throw new Error('This demo verifier only targets a local server.');
let passed = 0;

class Session {
  async challenge() {
    const response = await fetch(`${base}/auth/login/challenge`, {
      headers: this.cookie ? { Cookie: this.cookie } : {}, signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie');
    if (cookie) this.cookie = cookie.split(';')[0];
    this.csrf = response.headers.get('x-csrf-token');
    assert.ok(this.cookie && this.csrf);
    return response.json();
  }
  async post(envelope, { origin = base, csrf = this.csrf } = {}) {
    const headers = { 'Content-Type': 'application/json', Cookie: this.cookie, Origin: origin };
    if (csrf) headers['X-CSRF-Token'] = csrf;
    const response = await fetch(`${base}/auth/login/secure`, { method: 'POST', headers,
      body: JSON.stringify(envelope), signal: AbortSignal.timeout(5000) });
    return { status: response.status, ...(await response.json()) };
  }
}

async function check(name, run) {
  await run();
  passed++;
  console.log(`PASS ${name}`);
}
async function ready(input = demoInput) {
  const session = new Session();
  return { session, envelope: await encrypt(await session.challenge(), input) };
}
function expect(response, status, code) {
  assert.equal(response.status, status);
  if (code) assert.equal(response.code, code);
}

await check('WebCrypto -> Java normal request', async () => {
  const { session, envelope } = await ready();
  assert.deepEqual(Object.keys(envelope).sort(), ['challengeId', 'ciphertext', 'clientPublicKey', 'iv']);
  expect(await session.post(envelope), 200, 'DEMO_MATCH');
});
await check('GCM tampering rejected and challenge consumed', async () => {
  const { session, envelope } = await ready();
  const bytes = fromBase64Url(envelope.ciphertext);
  bytes[0] ^= 1;
  expect(await session.post({ ...envelope, ciphertext: toBase64Url(bytes) }), 400, 'ENVELOPE_REJECTED');
  expect(await session.post(envelope), 400, 'ENVELOPE_REJECTED');
});
await check('identical request cannot replay', async () => {
  const { session, envelope } = await ready();
  expect(await session.post(envelope), 200);
  expect(await session.post(envelope), 400);
});
await check('concurrent copies have exactly one winner', async () => {
  const { session, envelope } = await ready();
  const results = await Promise.all([session.post(envelope), session.post(envelope)]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 400]);
});
await check('challenge is bound to its session', async () => {
  const first = await ready();
  const second = await ready();
  expect(await second.session.post(first.envelope), 400);
  expect(await first.session.post(first.envelope), 200);
});
await check('refresh replaces the previous challenge', async () => {
  const { session, envelope } = await ready();
  await session.challenge();
  expect(await session.post(envelope), 400);
});
await check('missing CSRF rejected before consuming challenge', async () => {
  const { session, envelope } = await ready();
  expect(await session.post(envelope, { csrf: null }), 403, 'ORIGIN_OR_CSRF_REJECTED');
  expect(await session.post(envelope), 200);
});
await check('foreign Origin rejected', async () => {
  const { session, envelope } = await ready();
  expect(await session.post(envelope, { origin: 'https://other.example' }), 403);
});
for (const length of [11, 13]) {
  await check(`IV length ${length} rejected`, async () => {
    const { session, envelope } = await ready();
    expect(await session.post({ ...envelope, iv: toBase64Url(new Uint8Array(length)) }), 400);
  });
}
for (const length of [16, 2065]) {
  await check(`ciphertext length ${length} rejected`, async () => {
    const { session, envelope } = await ready();
    expect(await session.post({ ...envelope, ciphertext: toBase64Url(new Uint8Array(length)) }), 400);
  });
}
await check('oversized public key rejected', async () => {
  const { session, envelope } = await ready();
  expect(await session.post({ ...envelope, clientPublicKey: toBase64Url(new Uint8Array(201)) }), 400);
});
await check('incompatible EC curve rejected by Java key agreement', async () => {
  const { session, envelope } = await ready();
  const wrongPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-384' }, false, ['deriveBits']);
  const wrongPublic = await crypto.subtle.exportKey('spki', wrongPair.publicKey);
  expect(await session.post({ ...envelope, clientPublicKey: toBase64Url(wrongPublic) }), 400);
});
await check('padded Base64 is outside the Base64URL contract', async () => {
  const { session, envelope } = await ready();
  expect(await session.post({ ...envelope, iv: envelope.iv + '=' }), 400);
});
for (const length of [2048, 2049]) {
  await check(`plaintext length ${length} boundary`, async () => {
    const empty = { ...demoInput, password: '' };
    const overhead = new TextEncoder().encode(JSON.stringify(empty)).length;
    const { session, envelope } = await ready({ ...empty, password: 'x'.repeat(length - overhead) });
    expect(await session.post(envelope), length === 2048 ? 401 : 400,
      length === 2048 ? 'DEMO_MISMATCH' : 'ENVELOPE_REJECTED');
  });
}
console.log(`PASS: ${passed} real HTTP/WebCrypto checks`);
