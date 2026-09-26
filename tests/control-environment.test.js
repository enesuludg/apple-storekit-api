const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const { AppleStoreKit } = require('../dist/appleStoreKit');

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

function createStoreKit(request, overrides = {}) {
  return new AppleStoreKit({
    issuerId: '00000000-0000-4000-8000-000000000000',
    keyId: 'TESTKEY123',
    privateKey: privateKeyPem,
    bundleId: 'com.example.app',
    maxRetries: 0,
    httpClient: { request },
    ...overrides
  });
}

test('finishTransaction cannot override resolved sandbox environment with JavaScript control fields', async () => {
  const calls = [];
  const abortController = new AbortController();
  const storeKit = createStoreKit(async request => {
    calls.push(request);
    return { status: 200, data: undefined };
  }, { environment: 'sandbox' });

  await storeKit.finishTransaction('transaction-id', {
    environment: 'production',
    allowEnvironmentFallback: true,
    query: { injected: 'yes' },
    signal: abortController.signal,
    timeoutMs: 50
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'post');
  assert.equal(
    calls[0].url,
    'https://api.storekit-sandbox.apple.com/inApps/v1/transactions/transaction-id/finish'
  );
  assert.equal(calls[0].signal, abortController.signal);
  assert.equal(calls[0].timeout, 50);
});

test('finishTransaction cannot turn POST retries on through untyped controls', async () => {
  let requests = 0;
  const storeKit = createStoreKit(async () => {
    requests += 1;
    const error = new Error('Apple temporary error');
    error.isAxiosError = true;
    error.response = {
      status: 500,
      data: { errorCode: 5000001, errorMessage: 'Try again.' },
      headers: {}
    };
    throw error;
  }, { environment: 'sandbox', maxRetries: 1, retryBaseDelayMs: 0 });

  await assert.rejects(() => storeKit.finishTransaction('transaction-id', { retry: true }));
  assert.equal(requests, 1);
});

test('transaction writes forward only signal and timeout controls', async () => {
  const calls = [];
  const storeKit = createStoreKit(async request => {
    calls.push(request);
    return { status: 202, data: undefined };
  }, { environment: 'sandbox' });
  const control = {
    environment: 'production',
    allowEnvironmentFallback: true,
    query: { injected: 'yes' }
  };

  await storeKit.setAppAccountToken(
    'transaction-id',
    '00000000-0000-4000-8000-000000000001',
    control
  );
  await storeKit.sendConsumptionInformationV2(
    'transaction-id',
    { customerConsented: true, deliveryStatus: 'DELIVERED', sampleContentProvided: false },
    control
  );
  await storeKit.extendSubscriptionRenewalDate(
    'transaction-id',
    { extendByDays: 1, extendReasonCode: 0, requestIdentifier: 'request-id' },
    control
  );

  assert.equal(calls.length, 3);
  assert.ok(calls.every(call => call.url.startsWith('https://api.storekit-sandbox.apple.com/')));
  assert.ok(calls.every(call => !call.url.includes('?')));
});

test('explicit falsy invalid history environments fail closed before HTTP', async () => {
  let requests = 0;
  const storeKit = createStoreKit(async () => {
    requests += 1;
    return { status: 200, data: { signedTransactions: [], hasMore: false } };
  });

  for (const invalid of ['', null, false, 0]) {
    await assert.rejects(
      () => storeKit.getTransactionHistoryPage('transaction-id', {}, undefined, invalid),
      /environment must be production or sandbox/
    );
    await assert.rejects(
      () => storeKit.getRefundHistoryPage('transaction-id', undefined, invalid),
      /environment must be production or sandbox/
    );
    await assert.rejects(
      () => storeKit.iterateTransactionHistory('transaction-id', {}, { environment: invalid }).next(),
      /environment must be production or sandbox/
    );
  }
  assert.equal(requests, 0);
});

test('order lookup rejects every status other than Apple-defined 0 and 1', async () => {
  let status = 2;
  const storeKit = createStoreKit(async () => ({
    status: 200,
    data: { status, signedTransactions: ['signed-transaction'] }
  }));

  for (const invalid of [2, -1, 0.5, '0', null, undefined]) {
    status = invalid;
    await assert.rejects(
      () => storeKit.lookupOrder('order-id'),
      /status must be 0 or 1/
    );
  }
});
