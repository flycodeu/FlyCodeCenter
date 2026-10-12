import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHALLENGE_LIFETIME, DEMO_LOGIN, RSA_DEMO_TEXT, comparePasswordHashes,
  createChallenge, encryptLogin, encryptLoginWithProof, runRsaOaepExample, submitLogin, tamperCiphertext
} from '../../src/plugins/runtime/article/login-crypto-model.js';

test('independent ECDH sides derive a key that decrypts the exact four-field login payload', async () => {
  const challenge = await createChallenge();
  const envelope = await encryptLogin(challenge);
  assert.deepEqual(Object.keys(envelope), ['challengeId', 'clientPublicKey', 'iv', 'ciphertext']);
  assert.equal(Buffer.from(envelope.iv, 'base64url').length, 12);
  assert.equal(JSON.stringify(envelope).includes(DEMO_LOGIN.password), false);
  assert.deepEqual(await submitLogin(challenge, envelope), DEMO_LOGIN);
});

test('same demo input generates different challenges, ephemeral public keys, IVs and ciphertexts', async () => {
  const first = await encryptLogin(await createChallenge());
  const second = await encryptLogin(await createChallenge());
  for (const field of Object.keys(first)) assert.notEqual(first[field], second[field]);
});

test('ECDH proof compares both independently derived AES keys without exposing key material', async () => {
  const challenge = await createChallenge();
  const { envelope, proof } = await encryptLoginWithProof(challenge);
  assert.deepEqual(proof, { sameAesKey: true, clientPublicKeyBytes: 91, serverPublicKeyBytes: 91 });
  assert.deepEqual(Object.keys(envelope), ['challengeId', 'clientPublicKey', 'iv', 'ciphertext']);
  assert.deepEqual(await submitLogin(challenge, envelope), DEMO_LOGIN);
});

test('flipping a ciphertext bit fails GCM authentication and consumes the challenge', async () => {
  const challenge = await createChallenge();
  const envelope = await encryptLogin(challenge);
  await assert.rejects(submitLogin(challenge, tamperCiphertext(envelope)), { code: 'CIPHERTEXT_INVALID' });
  await assert.rejects(submitLogin(challenge, envelope), { code: 'CHALLENGE_USED' });
});

test('concurrent replay is rejected before a second decrypt can start', async () => {
  const challenge = await createChallenge();
  const envelope = await encryptLogin(challenge);
  const outcomes = await Promise.allSettled([submitLogin(challenge, envelope), submitLogin(challenge, envelope)]);
  assert.equal(outcomes[0].status, 'fulfilled');
  assert.equal(outcomes[1].status, 'rejected');
  assert.equal(outcomes[1].reason.code, 'CHALLENGE_USED');
});

test('challenge expires at the 120-second boundary and cannot be revived', async () => {
  const challenge = await createChallenge(1000);
  const envelope = await encryptLogin(challenge);
  await assert.rejects(submitLogin(challenge, envelope, 1000 + CHALLENGE_LIFETIME), { code: 'CHALLENGE_EXPIRED' });
  await assert.rejects(submitLogin(challenge, envelope, 1001), { code: 'CHALLENGE_USED' });
});

test('another challenge or invalid IV never returns cleartext', async () => {
  const first = await createChallenge();
  const second = await createChallenge();
  const envelope = await encryptLogin(first);
  await assert.rejects(submitLogin(second, envelope), { code: 'CHALLENGE_MISMATCH' });
  await assert.rejects(submitLogin(first, { ...envelope, iv: 'AQ' }), { code: 'CIPHERTEXT_INVALID' });
});

test('PBKDF2 uses distinct 16-byte salts, matches the correct password and rejects a wrong one', async () => {
  const result = await comparePasswordHashes();
  assert.notEqual(result.first.salt, result.second.salt);
  assert.equal(Buffer.from(result.first.salt, 'base64url').length, 16);
  assert.equal(Buffer.from(result.first.hash, 'base64url').length, 32);
  assert.notEqual(result.first.hash, result.second.hash);
  assert.equal(result.correctMatches, true);
  assert.equal(result.wrongMatches, false);
});

test('RSA-OAEP encrypts a short input randomly and decrypts both results with its private key', async () => {
  const result = await runRsaOaepExample();
  assert.equal(result.input, RSA_DEMO_TEXT);
  assert.equal(result.inputBytes, Buffer.byteLength(RSA_DEMO_TEXT));
  assert.equal(result.ciphertextBytes, 256);
  assert.equal(Buffer.from(result.ciphertext, 'base64url').length, 256);
  assert.equal(result.decrypted, RSA_DEMO_TEXT);
  assert.equal(result.decryptionMatches, true);
  assert.equal(result.randomizedCiphertexts, true);
  assert.deepEqual(Object.keys(result), ['input', 'inputBytes', 'ciphertext', 'ciphertextBytes', 'decrypted', 'decryptionMatches', 'randomizedCiphertexts']);
});
