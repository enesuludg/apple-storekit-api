const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const {
  AppleStoreKitVerificationError,
  BaseService
} = require('../dist/services/base.service');
const { AppleStoreKit } = require('../dist/appleStoreKit');

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

function config(overrides = {}) {
  return {
    issuerId: '00000000-0000-4000-8000-000000000000',
    keyId: 'TESTKEY123',
    privateKey: privateKeyPem,
    bundleId: 'com.example.app',
    maxRetries: 0,
    ...overrides
  };
}

function verifierFactory(environmentCalls = []) {
  return environment => {
    environmentCalls.push(environment);
    return {
      verifyAndDecodeTransaction: async () => ({
        transactionId: 'verified-transaction',
        environment: environment === 'production' ? 'Production' : 'Sandbox'
      }),
      verifyAndDecodeRenewalInfo: async () => ({}),
      verifyAndDecodeNotification: async () => ({}),
      verifyAndDecodeAppTransaction: async () => ({})
    };
  };
}

function axiosNetworkError(code) {
  const error = new Error(code);
  error.isAxiosError = true;
  error.code = code;
  return error;
}

function axiosHttpError(status, data = {}) {
  const error = new Error(`HTTP ${status}`);
  error.isAxiosError = true;
  error.response = { status, data, headers: {} };
  return error;
}

test('signed data cannot be decoded without an Apple trust root', async () => {
  const client = new BaseService(config({ environment: 'sandbox' }));

  await assert.rejects(
    () => client.verifyAndDecodeTransaction('header.payload.signature', 'sandbox'),
    error => {
      assert.ok(error instanceof AppleStoreKitVerificationError);
      assert.match(error.message, /root certificate/i);
      return true;
    }
  );
});

test('production verification requires the App Apple ID', async () => {
  const client = new BaseService(config({
    environment: 'production',
    appleRootCertificates: [Buffer.from('invalid-certificate')]
  }));

  await assert.rejects(
    () => client.verifyAndDecodeTransaction('header.payload.signature', 'production'),
    /appAppleId/
  );
});

test('purchase verification uses the environment that served the response', async () => {
  const environments = [];
  const storeKit = new AppleStoreKit(config({
    httpClient: {
      request: async () => ({
        status: 200,
        data: { signedTransactionInfo: 'signed' }
      })
    },
    signedDataVerifierFactory: verifierFactory(environments)
  }));

  const transaction = await storeKit.verifyPurchase('transaction');
  assert.equal(transaction.transactionId, 'verified-transaction');
  assert.deepEqual(environments, ['production']);
});

test('the deprecated facade decoder remains available and verifies signed data', async () => {
  const environments = [];
  const storeKit = new AppleStoreKit(config({
    environment: 'sandbox',
    signedDataVerifierFactory: verifierFactory(environments)
  }));

  const transaction = await storeKit.decodeSignedData('signed');

  assert.equal(transaction.transactionId, 'verified-transaction');
  assert.deepEqual(environments, ['sandbox']);
});

test('timeout and AbortSignal are forwarded to the HTTP adapter', async () => {
  let requestConfig;
  const controller = new AbortController();
  const client = new BaseService(config({
    timeoutMs: 12_000,
    httpClient: {
      request: async request => {
        requestConfig = request;
        return { status: 200, data: { ok: true } };
      }
    }
  }));

  await client.makeRequest('get', '/test', undefined, {
    timeoutMs: 321,
    signal: controller.signal
  });

  assert.equal(requestConfig.timeout, 321);
  assert.equal(requestConfig.signal, controller.signal);
});

test('aborting during retry backoff prevents another request', async () => {
  let calls = 0;
  const controller = new AbortController();
  const client = new BaseService(config({
    maxRetries: 2,
    retryBaseDelayMs: 5_000,
    maxRetryDelayMs: 5_000,
    httpClient: {
      request: async () => {
        calls += 1;
        throw axiosNetworkError('ECONNRESET');
      }
    }
  }));

  const request = client.makeRequest('get', '/test', undefined, {
    signal: controller.signal
  });
  setImmediate(() => controller.abort(new Error('cancelled')));

  await assert.rejects(request, /cancelled/);
  assert.equal(calls, 1);
});

test('permanent network errors are not retried', async () => {
  let calls = 0;
  const client = new BaseService(config({
    maxRetries: 3,
    retryBaseDelayMs: 0,
    maxRetryDelayMs: 0,
    httpClient: {
      request: async () => {
        calls += 1;
        throw axiosNetworkError('ENOTFOUND');
      }
    }
  }));

  await assert.rejects(() => client.makeRequest('get', '/test'));
  assert.equal(calls, 1);
});

test('non-transient HTTP 5xx responses are not retried', async () => {
  let calls = 0;
  const client = new BaseService(config({
    maxRetries: 3,
    retryBaseDelayMs: 0,
    maxRetryDelayMs: 0,
    httpClient: {
      request: async () => {
        calls += 1;
        throw axiosHttpError(501);
      }
    }
  }));

  await assert.rejects(() => client.makeRequest('get', '/test'));
  assert.equal(calls, 1);
});

test('non-idempotent retention mutations are never retried', async () => {
  const calls = new Map();
  const storeKit = new AppleStoreKit(config({
    environment: 'production',
    maxRetries: 3,
    retryBaseDelayMs: 0,
    maxRetryDelayMs: 0,
    httpClient: {
      request: async request => {
        const key = `${request.method} ${new URL(request.url).pathname}`;
        calls.set(key, (calls.get(key) || 0) + 1);
        throw axiosNetworkError('ECONNRESET');
      }
    }
  }));
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const operations = [
    [
      'put /inApps/v1/messaging/image/image-id',
      () => storeKit.uploadImage('image-id', png)
    ],
    [
      'delete /inApps/v1/messaging/image/image-id',
      () => storeKit.deleteImage('image-id')
    ],
    [
      'put /inApps/v1/messaging/message/message-id',
      () => storeKit.uploadMessage('message-id', { header: 'Header', body: 'Body' })
    ],
    [
      'delete /inApps/v1/messaging/message/message-id',
      () => storeKit.deleteMessage('message-id')
    ]
  ];

  for (const [, invoke] of operations) {
    await assert.rejects(invoke, /ECONNRESET/);
  }
  for (const [key] of operations) {
    assert.equal(calls.get(key), 1, `${key} must not be retried`);
  }
});

test('transaction aggregation stops at maxPages', async () => {
  let calls = 0;
  const storeKit = new AppleStoreKit(config({
    environment: 'production',
    appAppleId: 123456789,
    signedDataVerifierFactory: verifierFactory(),
    httpClient: {
      request: async () => {
        calls += 1;
        return {
          status: 200,
          data: {
            revision: `revision-${calls}`,
            bundleId: 'com.example.app',
            environment: 'Production',
            hasMore: true,
            signedTransactions: ['signed']
          }
        };
      }
    }
  }));

  await assert.rejects(
    () => storeKit.getTransactionHistory('transaction', {}, { maxPages: 1 }),
    /maxPages/
  );
  assert.equal(calls, 1);
});

test('transaction aggregation stops before exceeding maxItems', async () => {
  const storeKit = new AppleStoreKit(config({
    environment: 'sandbox',
    signedDataVerifierFactory: verifierFactory(),
    httpClient: {
      request: async () => ({
        status: 200,
        data: {
          revision: 'complete',
          bundleId: 'com.example.app',
          environment: 'Sandbox',
          hasMore: false,
          signedTransactions: ['first', 'second']
        }
      })
    }
  }));

  await assert.rejects(
    () => storeKit.getTransactionHistory('transaction', {}, { maxItems: 1 }),
    /maxItems/
  );
});

test('non-transaction endpoints require an environment in auto mode', async () => {
  let calls = 0;
  const storeKit = new AppleStoreKit(config({
    httpClient: {
      request: async () => {
        calls += 1;
        return { status: 200, data: {} };
      }
    }
  }));

  await assert.rejects(() => storeKit.requestTestNotification(), /explicit environment/i);
  assert.equal(calls, 0);
});

test('path segments are encoded and invalid account tokens fail early', async () => {
  let requestedUrl;
  const storeKit = new AppleStoreKit(config({
    environment: 'sandbox',
    signedDataVerifierFactory: verifierFactory(),
    httpClient: {
      request: async request => {
        requestedUrl = request.url;
        return { status: 200, data: { signedTransactionInfo: 'signed' } };
      }
    }
  }));

  await storeKit.verifyPurchase('transaction/with/slashes');
  assert.match(requestedUrl, /transaction%2Fwith%2Fslashes$/);
  await assert.rejects(
    () => storeKit.setAppAccountToken('transaction', 'not-a-uuid'),
    /valid UUID/
  );
});

test('account tenure rejects invalid and future dates', () => {
  const storeKit = new AppleStoreKit(config());
  assert.throws(() => storeKit.getAccountTenure(new Date('invalid')), /valid Date/);
  assert.throws(
    () => storeKit.getAccountTenure(new Date(Date.now() + 60_000)),
    /future/
  );
});

test('simplified subscription status selects an exact transaction match', async () => {
  const storeKit = new AppleStoreKit(config({
    environment: 'sandbox',
    signedDataVerifierFactory: () => ({
      verifyAndDecodeTransaction: async () => ({ expiresDate: 2_000_000_000_000 }),
      verifyAndDecodeRenewalInfo: async () => ({}),
      verifyAndDecodeNotification: async () => ({}),
      verifyAndDecodeAppTransaction: async () => ({})
    }),
    httpClient: {
      request: async () => ({
        status: 200,
        data: {
          environment: 'Sandbox',
          bundleId: 'com.example.app',
          data: [{
            subscriptionGroupIdentifier: 'group',
            lastTransactions: [
              {
                originalTransactionId: 'other',
                status: 1,
                signedTransactionInfo: 'other-transaction',
                signedRenewalInfo: 'other-renewal'
              },
              {
                originalTransactionId: 'target',
                status: 1,
                signedTransactionInfo: 'target-transaction',
                signedRenewalInfo: 'target-renewal'
              }
            ]
          }]
        }
      })
    }
  }));

  const status = await storeKit.getSubscriptionStatus('target');
  assert.equal(status.originalTransactionId, 'target');
  await assert.rejects(() => storeKit.getSubscriptionStatus('missing'), /ambiguous/);
});
