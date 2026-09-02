const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const { AppleStoreKit } = require('../dist/appleStoreKit');
const { createPng } = require('./png-fixture');

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const requestIdentifier = '00000000-0000-4000-8000-000000000001';
const imageIdentifier = '00000000-0000-4000-8000-000000000002';
const messageIdentifier = '00000000-0000-4000-8000-000000000003';
const performanceRequestId = '00000000-0000-4000-8000-000000000004';
const fullSizePng = createPng(3840, 160);

function createStoreKit(environment = 'production', request) {
  return new AppleStoreKit({
    issuerId: '00000000-0000-0000-0000-000000000000',
    keyId: 'TESTKEY123',
    privateKey: privateKeyPem,
    bundleId: 'com.example.app',
    environment,
    maxRetries: 0,
    ...(request ? { httpClient: { request } } : {}),
    signedDataVerifierFactory: () => ({
      verifyAndDecodeTransaction: async signedData => decodeSignedPayload(signedData),
      verifyAndDecodeRenewalInfo: async signedData => decodeSignedPayload(signedData),
      verifyAndDecodeNotification: async signedData => decodeSignedPayload(signedData),
      verifyAndDecodeAppTransaction: async signedData => decodeSignedPayload(signedData)
    })
  });
}

function decodeSignedPayload(signedData) {
  const payload = signedData.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

function signedPayload(payload) {
  const encoded = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `header.${encoded}.signature`;
}

test('current transaction, refund, app transaction, and finish endpoints are wired', async () => {
  const calls = [];
  const storeKit = createStoreKit('production', async request => {
    calls.push(request);
    const url = new URL(request.url);

    if (url.pathname === '/inApps/v2/history/transaction') {
      const revision = url.searchParams.get('revision');
      return revision
        ? {
          status: 200,
          data: {
            revision: 'history-complete',
            bundleId: 'com.example.app',
            environment: 'Production',
            hasMore: false,
            signedTransactions: [signedPayload({ transactionId: 'second' })]
          }
        }
        : {
          status: 200,
          data: {
            revision: 'history-next',
            bundleId: 'com.example.app',
            environment: 'Production',
            hasMore: true,
            signedTransactions: [signedPayload({ transactionId: 'first' })]
          }
        };
    }

    if (url.pathname === '/inApps/v2/refund/lookup/transaction') {
      const revision = url.searchParams.get('revision');
      return revision
        ? {
          status: 200,
          data: { revision: 'refund-complete', hasMore: false, signedTransactions: ['refund-2'] }
        }
        : {
          status: 200,
          data: { revision: 'refund-next', hasMore: true, signedTransactions: ['refund-1'] }
        };
    }

    if (url.pathname.includes('/appTransactions/')) {
      return { status: 200, data: { signedAppTransactionInfo: 'signed-app-transaction' } };
    }
    return { status: 200, data: undefined };
  });
  const history = await storeKit.getTransactionHistory('transaction', {
    productTypes: ['CONSUMABLE', 'NON_CONSUMABLE'],
    revoked: false
  });
  const refunds = await storeKit.getRefundHistory('transaction');
  const appTransaction = await storeKit.getAppTransactionInfo('transaction');
  await storeKit.finishTransaction('transaction');

  assert.deepEqual(history.map(item => item.transactionId), ['first', 'second']);
  assert.deepEqual(refunds.signedTransactions, ['refund-1', 'refund-2']);
  assert.equal(refunds.hasMore, false);
  assert.equal(appTransaction.signedAppTransactionInfo, 'signed-app-transaction');

  const historyCalls = calls.filter(call => call.url.includes('/inApps/v2/history/'));
  assert.equal(historyCalls.length, 2);
  assert.deepEqual(
    new URL(historyCalls[0].url).searchParams.getAll('productType'),
    ['CONSUMABLE', 'NON_CONSUMABLE']
  );
  assert.equal(new URL(historyCalls[0].url).searchParams.get('revoked'), 'false');
  assert.equal(new URL(historyCalls[1].url).searchParams.get('revision'), 'history-next');
  assert.equal(
    new URL(calls.find(call => call.url.includes('/inApps/v2/refund/lookup/')).url).pathname,
    '/inApps/v2/refund/lookup/transaction'
  );
  const finishCall = calls.find(call => call.url.endsWith('/transactions/transaction/finish'));
  assert.equal(finishCall.method, 'post');
});

test('subscription, notification, and renewal extension endpoints are wired', async () => {
  const calls = [];
  const storeKit = createStoreKit('production', async request => {
    calls.push(request);
    const path = new URL(request.url).pathname;

    if (path === '/inApps/v1/subscriptions/transaction') {
      return {
        status: 200,
        data: { environment: 'Production', bundleId: 'com.example.app', data: [] }
      };
    }
    if (path === '/inApps/v1/notifications/history') {
      return { status: 200, data: { hasMore: false, notificationHistory: [] } };
    }
    if (path === '/inApps/v1/notifications/test') {
      return { status: 200, data: { testNotificationToken: 'test-token' } };
    }
    if (path.endsWith('/notifications/test/test-token')) {
      return { status: 200, data: { sendAttempts: [] } };
    }
    if (path === '/inApps/v1/subscriptions/extend/original-transaction') {
      return { status: 200, data: { success: true } };
    }
    if (path === '/inApps/v1/subscriptions/extend/mass') {
      return { status: 200, data: { requestIdentifier: 'request-id' } };
    }
    return { status: 200, data: { complete: true } };
  });
  await storeKit.getAllSubscriptionStatuses('transaction', [1, 3]);
  await storeKit.getNotificationHistory({ startDate: 1, endDate: 2 });
  await storeKit.requestTestNotification();
  await storeKit.getTestNotificationStatus('test-token');
  await storeKit.extendSubscriptionRenewalDate('original-transaction', {
    extendByDays: 3,
    extendReasonCode: 1,
    requestIdentifier
  });
  await storeKit.extendRenewalDateForAllActiveSubscribers({
    extendByDays: 3,
    extendReasonCode: 1,
    requestIdentifier,
    productId: 'product-id'
  });
  await storeKit.getStatusOfSubscriptionRenewalDateExtensions(
    requestIdentifier,
    'product-id'
  );

  const statusUrl = new URL(calls[0].url);
  assert.deepEqual(statusUrl.searchParams.getAll('status'), ['1', '3']);
  assert.ok(calls.some(call => call.method === 'post' && call.url.endsWith('/notifications/history')));
  assert.ok(calls.some(call => call.method === 'post' && call.url.endsWith('/notifications/test')));
  assert.ok(calls.some(call => call.method === 'put' && call.url.includes('/subscriptions/extend/original-transaction')));
  assert.ok(calls.some(call => call.method === 'post' && call.url.endsWith('/subscriptions/extend/mass')));
  assert.ok(calls.some(call => call.method === 'get' && call.url.endsWith(`/subscriptions/extend/mass/product-id/${requestIdentifier}`)));
});

test('all Retention Messaging endpoints are wired', async () => {
  const calls = [];
  const storeKit = createStoreKit('production', async request => {
    calls.push(request);
    return { status: 200, data: {} };
  });
  await storeKit.uploadImage(
    imageIdentifier,
    fullSizePng,
    'FULL_SIZE'
  );
  await storeKit.deleteImage(imageIdentifier);
  await storeKit.getImageList();
  await storeKit.uploadMessage(messageIdentifier, { header: 'Header', body: 'Body' });
  await storeKit.deleteMessage(messageIdentifier);
  await storeKit.getMessageList();
  await storeKit.configureDefaultMessage('product-id', 'en-US', {
    messageIdentifier
  });
  await storeKit.deleteDefaultMessage('product-id', 'en-US');
  await storeKit.getDefaultMessage('product-id', 'en-US');
  await storeKit.configureRealtimeURL({ realtimeURL: 'https://example.com/retention' });
  await storeKit.deleteRealtimeURL();
  await storeKit.getRealtimeURL();
  await storeKit.initiatePerformanceTest({ originalTransactionId: 'transaction' });
  await storeKit.getPerformanceTestResults(performanceRequestId);

  const expected = [
    ['put', `/inApps/v1/messaging/image/${imageIdentifier}`],
    ['delete', `/inApps/v1/messaging/image/${imageIdentifier}`],
    ['get', '/inApps/v1/messaging/image/list'],
    ['put', `/inApps/v1/messaging/message/${messageIdentifier}`],
    ['delete', `/inApps/v1/messaging/message/${messageIdentifier}`],
    ['get', '/inApps/v1/messaging/message/list'],
    ['put', '/inApps/v1/messaging/default/product-id/en-US'],
    ['delete', '/inApps/v1/messaging/default/product-id/en-US'],
    ['get', '/inApps/v1/messaging/default/product-id/en-US'],
    ['put', '/inApps/v1/messaging/realtime/url'],
    ['delete', '/inApps/v1/messaging/realtime/url'],
    ['get', '/inApps/v1/messaging/realtime/url'],
    ['post', '/inApps/v1/messaging/performanceTest'],
    ['get', `/inApps/v1/messaging/performanceTest/result/${performanceRequestId}`]
  ];

  assert.deepEqual(
    calls.map(call => [call.method, new URL(call.url).pathname]),
    expected
  );
  assert.equal(calls[0].headers['Content-Type'], 'image/png');
  assert.equal(new URL(calls[0].url).searchParams.get('imageSize'), 'FULL_SIZE');
  assert.ok(calls[12].url.startsWith('https://api.storekit-sandbox.apple.com'));
  assert.ok(calls[13].url.startsWith('https://api.storekit-sandbox.apple.com'));
});
