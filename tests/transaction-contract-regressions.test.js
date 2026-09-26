const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const { AppleStoreKit } = require('../dist/appleStoreKit');
const { AccountTenure } = require('../dist/interfaces/consumption');

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

function createStoreKit(request, overrides = {}) {
  return new AppleStoreKit({
    issuerId: '00000000-0000-4000-8000-000000000000',
    keyId: 'TESTKEY123',
    privateKey: privateKeyPem,
    bundleId: 'com.example.app',
    environment: 'production',
    maxRetries: 0,
    httpClient: { request },
    ...overrides
  });
}

test('order lookup returns an empty result for Apple invalid-order status', async () => {
  let response = { status: 1 };
  const storeKit = createStoreKit(async () => ({ status: 200, data: response }));

  assert.deepEqual(await storeKit.lookupOrder('invalid-order'), {
    status: 1,
    transactions: [],
    signedTransactions: []
  });

  response = { status: 1, signedTransactions: [] };
  assert.deepEqual(await storeKit.lookupOrder('invalid-order'), {
    status: 1,
    transactions: [],
    signedTransactions: []
  });
});

test('order lookup requires signed transactions for Apple valid-order status', async () => {
  let response = { status: 0 };
  const decoded = { transactionId: 'verified-transaction' };
  const storeKit = createStoreKit(
    async () => ({ status: 200, data: response }),
    {
      signedDataVerifierFactory: () => ({
        verifyAndDecodeTransaction: async signed => {
          assert.equal(signed, 'signed-transaction');
          return decoded;
        }
      })
    }
  );

  await assert.rejects(() => storeKit.lookupOrder('valid-order'), /signedTransactions/);
  response = { status: 0, signedTransactions: [] };
  await assert.rejects(() => storeKit.lookupOrder('valid-order'), /signedTransactions/);

  response = { status: 0, signedTransactions: ['signed-transaction'] };
  assert.deepEqual(await storeKit.lookupOrder('valid-order'), {
    status: 0,
    transactions: [decoded],
    signedTransactions: [decoded]
  });
});

test('transaction history rejects an equal date range before I/O', async () => {
  let requests = 0;
  const storeKit = createStoreKit(async () => {
    requests += 1;
    return {
      status: 200,
      data: { hasMore: false, signedTransactions: [] }
    };
  });

  await assert.rejects(
    () => storeKit.getTransactionHistoryPage('transaction-id', { startDate: 10, endDate: 10 }),
    /startDate must be earlier than endDate/
  );
  assert.equal(requests, 0);

  await storeKit.getTransactionHistoryPage('transaction-id', { startDate: 10, endDate: 11 });
  assert.equal(requests, 1);
});

test('account tenure uses elapsed time at category boundaries', () => {
  const storeKit = createStoreKit(async () => ({ status: 200, data: {} }));
  const now = 1_800_000_000_000;
  const day = 24 * 60 * 60 * 1000;
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    const examples = [
      [2.5, AccountTenure.DAYS_0_3],
      [3, AccountTenure.DAYS_3_10],
      [9.5, AccountTenure.DAYS_3_10],
      [10, AccountTenure.DAYS_10_30],
      [30, AccountTenure.DAYS_30_90],
      [90, AccountTenure.DAYS_90_180],
      [180, AccountTenure.DAYS_180_365],
      [365, AccountTenure.DAYS_OVER_365]
    ];

    for (const [elapsedDays, expected] of examples) {
      assert.equal(
        storeKit.getAccountTenure(new Date(now - elapsedDays * day)),
        expected,
        `${elapsedDays} elapsed days`
      );
    }
  } finally {
    Date.now = originalNow;
  }
});
