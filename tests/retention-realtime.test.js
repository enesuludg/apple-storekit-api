const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const { AppleStoreKit } = require('../dist/appleStoreKit');
const { AppleStoreKitVerificationError } = require('../dist/services/base.service');

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

function createStoreKit(signedDataVerifierFactory) {
  return new AppleStoreKit({
    issuerId: '00000000-0000-4000-8000-000000000000',
    keyId: 'TESTKEY123',
    privateKey: privateKeyPem,
    bundleId: 'com.example.app',
    environment: 'sandbox',
    signedDataVerifierFactory
  });
}

function legacyVerifier() {
  return {
    verifyAndDecodeTransaction: async () => ({ transactionId: 'verified' }),
    verifyAndDecodeRenewalInfo: async () => ({}),
    verifyAndDecodeNotification: async () => ({}),
    verifyAndDecodeAppTransaction: async () => ({})
  };
}

test('retention real-time payload delegates to the verifier for the requested environment', async () => {
  const factoryEnvironments = [];
  const payloads = [];
  const storeKit = createStoreKit(environment => {
    factoryEnvironments.push(environment);
    return {
      ...legacyVerifier(),
      verifyAndDecodeRealtimeRequest: async signedPayload => {
        payloads.push(signedPayload);
        return { requestIdentifier: 'request-123', environment: 'Production' };
      }
    };
  });

  const decoded = await storeKit.verifyAndDecodeRealtimeRequest('signed-payload', 'production');

  assert.equal(decoded.requestIdentifier, 'request-123');
  assert.deepEqual(factoryEnvironments, ['production']);
  assert.deepEqual(payloads, ['signed-payload']);
});

test('legacy custom verifier stays compatible and gives a clear error for new method', async () => {
  const storeKit = createStoreKit(() => legacyVerifier());

  assert.equal(
    (await storeKit.verifyAndDecodeTransaction('signed-transaction', 'sandbox')).transactionId,
    'verified'
  );
  await assert.rejects(
    () => storeKit.verifyAndDecodeRealtimeRequest('signed-payload', 'sandbox'),
    error => {
      assert.ok(error instanceof AppleStoreKitVerificationError);
      assert.equal(error.environment, 'sandbox');
      assert.match(error.message, /retention realtime request/i);
      assert.match(error.cause.message, /does not support retention realtime requests/i);
      return true;
    }
  );
});

test('retention real-time verification needs Apple trust roots by default', async () => {
  const storeKit = createStoreKit();

  await assert.rejects(
    () => storeKit.verifyAndDecodeRealtimeRequest('signed-payload', 'sandbox'),
    error => {
      assert.ok(error instanceof AppleStoreKitVerificationError);
      assert.equal(error.environment, 'sandbox');
      assert.match(error.message, /root certificate/i);
      return true;
    }
  );
});
