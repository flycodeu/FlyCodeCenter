// Real Web Crypto operations; challenge lifetime and consumption model a server in local memory.
export const DEMO_LOGIN = Object.freeze({
  username: 'reader_demo',
  password: 'DemoOnly!2026',
  captchaId: '11111111111111111111111111111111',
  captchaAnswer: 'A2B3C'
});
export const CHALLENGE_LIFETIME = 120_000;
export const PASSWORD_ITERATIONS = 600_000;
export const RSA_DEMO_TEXT = 'demo-session-key';
const encoder = new TextEncoder();

export class DemoRejection extends Error {
  constructor(code) {
    super(code);
    this.name = 'DemoRejection';
    this.code = code;
  }
}

export function base64Url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decode(value, maximum) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value) || value.length > maximum * 2) {
    throw new DemoRejection('CIPHERTEXT_INVALID');
  }
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));
}

export async function createChallenge(now = Date.now()) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const challengeId = [...crypto.getRandomValues(new Uint8Array(16))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  return {
    challengeId,
    serverPublicKey: base64Url(await crypto.subtle.exportKey('spki', pair.publicKey)),
    privateKey: pair.privateKey,
    expiresAt: now + CHALLENGE_LIFETIME,
    consumed: false
  };
}

async function deriveKeyBytes(privateKey, encodedPublicKey, challengeId) {
  const publicKey = await crypto.subtle.importKey(
    'spki', decode(encodedPublicKey, 200), { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const material = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({
    name: 'HKDF',
    hash: 'SHA-256',
    salt: Uint8Array.from(challengeId.match(/.{2}/g), part => parseInt(part, 16)),
    info: encoder.encode('streamfusion-login-v1')
  }, material, 256));
}

async function deriveKey(privateKey, encodedPublicKey, challengeId, usage) {
  const bytes = await deriveKeyBytes(privateKey, encodedPublicKey, challengeId);
  try {
    return await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, [usage]);
  } finally {
    bytes.fill(0);
  }
}

export async function encryptLoginWithProof(challenge, value = DEMO_LOGIN) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const clientPublicKey = base64Url(await crypto.subtle.exportKey('spki', pair.publicKey));
  let clientBytes;
  let serverBytes;
  try {
    clientBytes = await deriveKeyBytes(pair.privateKey, challenge.serverPublicKey, challenge.challengeId);
    serverBytes = await deriveKeyBytes(challenge.privateKey, clientPublicKey, challenge.challengeId);
    // Compare locally for the lesson; return only the boolean, never the key material.
    const sameAesKey = clientBytes.length === serverBytes.length && clientBytes.every((byte, index) => byte === serverBytes[index]);
    const key = await crypto.subtle.importKey('raw', clientBytes, 'AES-GCM', false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({
      name: 'AES-GCM', iv, tagLength: 128, additionalData: encoder.encode(challenge.challengeId)
    }, key, encoder.encode(JSON.stringify(value)));
    return {
      envelope: { challengeId: challenge.challengeId, clientPublicKey, iv: base64Url(iv), ciphertext: base64Url(ciphertext) },
      proof: {
        sameAesKey,
        clientPublicKeyBytes: decode(clientPublicKey, 200).length,
        serverPublicKeyBytes: decode(challenge.serverPublicKey, 200).length
      }
    };
  } finally {
    clientBytes?.fill(0);
    serverBytes?.fill(0);
  }
}

export async function encryptLogin(challenge, value = DEMO_LOGIN) {
  return (await encryptLoginWithProof(challenge, value)).envelope;
}

export async function submitLogin(challenge, envelope, now = Date.now()) {
  if (challenge.consumed) throw new DemoRejection('CHALLENGE_USED');
  // Consume synchronously before awaiting cryptography, so concurrent requests cannot both pass.
  challenge.consumed = true;
  if (now >= challenge.expiresAt) throw new DemoRejection('CHALLENGE_EXPIRED');
  if (envelope?.challengeId !== challenge.challengeId) throw new DemoRejection('CHALLENGE_MISMATCH');
  try {
    const iv = decode(envelope.iv, 12);
    if (iv.length !== 12) throw new DemoRejection('CIPHERTEXT_INVALID');
    const key = await deriveKey(challenge.privateKey, envelope.clientPublicKey, challenge.challengeId, 'decrypt');
    const plaintext = await crypto.subtle.decrypt({
      name: 'AES-GCM', iv, tagLength: 128, additionalData: encoder.encode(challenge.challengeId)
    }, key, decode(envelope.ciphertext, 2064));
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new DemoRejection('CIPHERTEXT_INVALID');
  }
}

export function tamperCiphertext(envelope) {
  const bytes = decode(envelope.ciphertext, 2064);
  bytes[0] ^= 1;
  return { ...envelope, ciphertext: base64Url(bytes) };
}

async function passwordHash(password, salt) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return base64Url(await crypto.subtle.deriveBits({
    name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PASSWORD_ITERATIONS
  }, material, 256));
}

export async function comparePasswordHashes() {
  const firstSalt = crypto.getRandomValues(new Uint8Array(16));
  const secondSalt = crypto.getRandomValues(new Uint8Array(16));
  const firstHash = await passwordHash(DEMO_LOGIN.password, firstSalt);
  const secondHash = await passwordHash(DEMO_LOGIN.password, secondSalt);
  const correctHash = await passwordHash(DEMO_LOGIN.password, firstSalt);
  const wrongHash = await passwordHash('WrongDemo!2026', firstSalt);
  return {
    first: { salt: base64Url(firstSalt), hash: firstHash },
    second: { salt: base64Url(secondSalt), hash: secondHash },
    correctMatches: correctHash === firstHash,
    wrongMatches: wrongHash === firstHash
  };
}

export async function runRsaOaepExample() {
  const pair = await crypto.subtle.generateKey({
    name: 'RSA-OAEP', modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'
  }, false, ['encrypt', 'decrypt']);
  const input = encoder.encode(RSA_DEMO_TEXT);
  const first = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pair.publicKey, input);
  const second = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pair.publicKey, input);
  const firstPlaintext = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, pair.privateKey, first);
  const secondPlaintext = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, pair.privateKey, second);
  const decrypted = new TextDecoder().decode(firstPlaintext);
  return {
    input: RSA_DEMO_TEXT,
    inputBytes: input.length,
    ciphertext: base64Url(first),
    ciphertextBytes: first.byteLength,
    decrypted,
    decryptionMatches: decrypted === RSA_DEMO_TEXT && new TextDecoder().decode(secondPlaintext) === RSA_DEMO_TEXT,
    randomizedCiphertexts: base64Url(first) !== base64Url(second)
  };
}
