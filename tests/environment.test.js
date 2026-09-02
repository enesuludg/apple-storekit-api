const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const {
  AppleStoreKitApiError,
  BaseService
} = require('../dist/services/base.service');
const { AppleStoreKit } = require('../dist/appleStoreKit');

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

function createConfig(overrides = {}) {
  return {
    issuerId: '00000000-0000-0000-0000-000000000000',
    keyId: 'TESTKEY123',
    privateKey: privateKeyPem,
    bundleId: 'com.example.app',
    maxRetries: 0,
    ...overrides
  };
}

function createAxiosError(status, data, headers = {}) {
  const error = new Error(data?.errorMessage || `Request failed with status ${status}`);
  error.isAxiosError = true;
  error.response = { status, data, headers };
  return error;
}

test('auto mode falls back to sandbox only for Apple error 4040010', async () => {
  const calls = [];
  const httpClient = { request: async request => {
    calls.push(request.url);

    if (request.url.startsWith('https://api.storekit.apple.com')) {
      throw createAxiosError(404, {
        errorCode: 4040010,
        errorMessage: 'Transaction id not found.'
      });
    }
    return { status: 200, data: { found: true } };
  }};
  const client = new BaseService(createConfig({ httpClient }));
  const result = await client.makeRequestWithEnvironment(
    'get',
    '/inApps/v1/transactions/sandbox-transaction',
    undefined,
    { allowEnvironmentFallback: true }
  );

  assert.equal(result.environment, 'sandbox');
  assert.deepEqual(result.data, { found: true });
  assert.equal(client.getConfiguredEnvironment(), 'auto');
  assert.equal(client.getCurrentEnvironment(), 'auto');

  assert.deepEqual(calls, [
    'https://api.storekit.apple.com/inApps/v1/transactions/sandbox-transaction',
    'https://api.storekit-sandbox.apple.com/inApps/v1/transactions/sandbox-transaction'
  ]);
});

test('authentication errors do not trigger an environment fallback', async () => {
  const calls = [];
  const httpClient = { request: async request => {
    calls.push(request.url);
    throw createAxiosError(401, { errorMessage: 'Unauthorized' });
  }};
  const client = new BaseService(createConfig({ httpClient }));

  await assert.rejects(
    () => client.makeRequest(
      'get',
      '/inApps/v1/transactions/transaction',
      undefined,
      { allowEnvironmentFallback: true }
    ),
    error => {
      assert.ok(error instanceof AppleStoreKitApiError);
      assert.equal(error.environment, 'production');
      assert.equal(error.statusCode, 401);
      return true;
    }
  );

  assert.equal(calls.length, 1);
  assert.ok(calls[0].startsWith('https://api.storekit.apple.com'));
});

test('retryable server errors retry in the same environment', async () => {
  const calls = [];
  const httpClient = { request: async request => {
    calls.push(request.url);

    if (calls.length === 1) {
      throw createAxiosError(500, {
        errorCode: 5000001,
        errorMessage: 'Please try again.'
      });
    }
    return { status: 200, data: { recovered: true } };
  }};
  const client = new BaseService(createConfig({
    maxRetries: 1,
    retryBaseDelayMs: 0,
    maxRetryDelayMs: 0,
    httpClient
  }));

  const result = await client.makeRequestWithEnvironment(
    'get',
    '/inApps/v1/transactions/transaction',
    undefined,
    { allowEnvironmentFallback: true }
  );

  assert.equal(result.environment, 'production');
  assert.deepEqual(result.data, { recovered: true });

  assert.equal(calls.length, 2);
  assert.ok(calls.every(url => url.startsWith('https://api.storekit.apple.com')));
});

test('V2 consumption resolves the environment before sending one PUT request', async () => {
  const calls = [];
  const httpClient = { request: async request => {
    calls.push({ method: request.method, url: request.url, data: request.data });

    if (
      request.method === 'get' &&
      request.url.startsWith('https://api.storekit.apple.com')
    ) {
      throw createAxiosError(404, {
        errorCode: 4040010,
        errorMessage: 'Transaction id not found.'
      });
    }

    if (request.method === 'get') {
      return { status: 200, data: { signedTransactionInfo: 'header.payload.signature' } };
    }
    return { status: 202, data: undefined };
  }};
  const storeKit = new AppleStoreKit(createConfig({ httpClient }));
  const result = await storeKit.sendConsumptionInformationV2(
    'sandbox-transaction',
    {
      customerConsented: true,
      deliveryStatus: 'DELIVERED',
      sampleContentProvided: false
    }
  );

  assert.deepEqual(result, {
    success: true,
    transactionId: 'sandbox-transaction',
    statusCode: 202
  });

  const putCalls = calls.filter(call => call.method === 'put');
  assert.equal(putCalls.length, 1);
  assert.ok(putCalls[0].url.startsWith('https://api.storekit-sandbox.apple.com'));
});

test('order lookup never falls back to sandbox automatically', async () => {
  const calls = [];
  const httpClient = { request: async request => {
    calls.push(request.url);
    throw createAxiosError(404, {
      errorCode: 4040010,
      errorMessage: 'Not found.'
    });
  }};
  const storeKit = new AppleStoreKit(createConfig({ httpClient }));
  await assert.rejects(() => storeKit.lookupOrder('order-id'));

  assert.equal(calls.length, 1);
  assert.ok(calls[0].startsWith('https://api.storekit.apple.com'));
});
