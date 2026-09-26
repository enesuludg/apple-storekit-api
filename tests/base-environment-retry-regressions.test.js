const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const {
  AppleStoreKitApiError,
  BaseService
} = require('../dist/services/base.service');

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const retryableAppleCodes = [4040002, 4040004, 4040006];

function config(overrides = {}) {
  return {
    issuerId: '00000000-0000-4000-8000-000000000000',
    keyId: 'TESTKEY123',
    privateKey: privateKeyPem,
    bundleId: 'com.example.app',
    environment: 'sandbox',
    maxRetries: 0,
    ...overrides
  };
}

function appleError(errorCode) {
  const error = new Error(`Apple error ${errorCode}`);
  error.isAxiosError = true;
  error.response = {
    status: 404,
    data: { errorCode, errorMessage: 'Try again later.' },
    headers: {}
  };
  return error;
}

test('constructor snapshots the validated environment and rejects invalid runtime values before I/O', async () => {
  const urls = [];
  const mutableConfig = config({
    httpClient: {
      request: async request => {
        urls.push(request.url);
        return { status: 200, data: { ok: true } };
      }
    }
  });
  const client = new BaseService(mutableConfig);
  mutableConfig.environment = 'production';

  await client.makeRequest('get', '/inApps/v1/test');
  assert.equal(urls.length, 1);
  assert.ok(urls[0].startsWith('https://api.storekit-sandbox.apple.com/'));

  for (const invalid of ['sandobox', '', null]) {
    await assert.rejects(
      () => client.makeRequest('get', '/inApps/v1/test', undefined, { environment: invalid }),
      { name: 'TypeError', message: 'environment must be production or sandbox.' }
    );
    await assert.rejects(
      () => client.verifyAndDecodeTransaction('signed-payload', invalid),
      { name: 'TypeError', message: 'environment must be production or sandbox.' }
    );
  }
  assert.equal(urls.length, 1, 'invalid environments must not send HTTP requests');
  assert.throws(
    () => new BaseService(config({ environment: 'staging' })),
    { name: 'TypeError', message: 'environment must be production or sandbox.' }
  );
});

test('transaction environment resolution ignores unsupported control fields', async () => {
  const urls = [];
  const client = new BaseService(config({
    environment: undefined,
    httpClient: {
      request: async request => {
        urls.push(request.url);
        if (request.url.startsWith('https://api.storekit.apple.com/')) {
          throw appleError(4040010);
        }
        return { status: 200, data: { signedTransactionInfo: 'signed-payload' } };
      }
    }
  }));

  const environment = await client.resolveTransactionEnvironment('transaction-id', {
    environment: 'production',
    allowEnvironmentFallback: false
  });
  assert.equal(environment, 'sandbox');
  assert.equal(urls.length, 2);
  assert.ok(urls[0].startsWith('https://api.storekit.apple.com/'));
  assert.ok(urls[1].startsWith('https://api.storekit-sandbox.apple.com/'));
});

test('Apple retryable 404 codes retry GET requests in the selected environment', async () => {
  for (const errorCode of retryableAppleCodes) {
    const urls = [];
    const client = new BaseService(config({
      maxRetries: 1,
      retryBaseDelayMs: 0,
      maxRetryDelayMs: 0,
      httpClient: {
        request: async request => {
          urls.push(request.url);
          if (urls.length === 1) {
            throw appleError(errorCode);
          }
          return { status: 200, data: { recovered: true } };
        }
      }
    }));

    const result = await client.makeRequestWithEnvironment('get', '/inApps/v1/test');
    assert.deepEqual(result.data, { recovered: true });
    assert.equal(urls.length, 2, `Apple error ${errorCode} should retry once`);
    assert.ok(urls.every(url => url.startsWith('https://api.storekit-sandbox.apple.com/')));
  }
});

test('Apple retryable 404 codes retain retryable error metadata when retries are disabled', async () => {
  for (const errorCode of retryableAppleCodes) {
    const client = new BaseService(config({
      httpClient: { request: async () => { throw appleError(errorCode); } }
    }));

    await assert.rejects(
      () => client.makeRequest('get', '/inApps/v1/test'),
      error => {
        assert.ok(error instanceof AppleStoreKitApiError);
        assert.equal(error.errorCode, errorCode);
        assert.equal(error.statusCode, 404);
        assert.equal(error.retryable, true);
        assert.equal(error.environment, 'sandbox');
        return true;
      }
    );
  }
});
