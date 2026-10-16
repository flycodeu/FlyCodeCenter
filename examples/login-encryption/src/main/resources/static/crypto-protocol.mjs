const utf8 = new TextEncoder();

export const demoInput = Object.freeze({
  username: 'reader_demo',
  password: 'DemoOnly!2026',
  captchaId: '11111111111111111111111111111111',
  captchaAnswer: 'A2B3C',
});

export function fromBase64Url(value) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

export function toBase64Url(value) {
  return btoa(String.fromCharCode(...new Uint8Array(value)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function encrypt(challenge, input = demoInput) {
  const { subtle } = globalThis.crypto;
  const pair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const serverPublicKey = await subtle.importKey('spki', fromBase64Url(challenge.serverPublicKey),
    { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = await subtle.deriveBits({ name: 'ECDH', public: serverPublicKey }, pair.privateKey, 256);
  const source = await subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  const salt = Uint8Array.from(challenge.challengeId.match(/../g), part => parseInt(part, 16));
  const key = await subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt,
    info: utf8.encode('streamfusion-login-v1') }, source, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv,
    additionalData: utf8.encode(challenge.challengeId), tagLength: 128 }, key, utf8.encode(JSON.stringify(input)));
  return { challengeId: challenge.challengeId,
    clientPublicKey: toBase64Url(await subtle.exportKey('spki', pair.publicKey)),
    iv: toBase64Url(iv), ciphertext: toBase64Url(ciphertext) };
}
