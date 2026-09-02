const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const { AppleStoreKit } = require('../dist/appleStoreKit');
const { createPng, PNG_SIGNATURE } = require('./png-fixture');

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const IMAGE_IDENTIFIER = '00000000-0000-4000-8000-000000000001';
const MESSAGE_IDENTIFIER = '00000000-0000-4000-8000-000000000002';
const REQUEST_IDENTIFIER = '00000000-0000-4000-8000-000000000003';
const FULL_SIZE_PNG = createPng(3840, 160);
const BULLET_POINT_PNG = createPng(1024, 1024);

function createStoreKit(calls) {
  return new AppleStoreKit({
    issuerId: '00000000-0000-4000-8000-000000000000',
    keyId: 'TESTKEY123',
    privateKey: privateKeyPem,
    bundleId: 'com.example.app',
    environment: 'production',
    maxRetries: 0,
    httpClient: {
      request: async request => {
        calls.push(request);
        return { status: 200, data: {} };
      }
    }
  });
}

test('renewal validation follows the individual and mass request contracts', async () => {
  const calls = [];
  const storeKit = createStoreKit(calls);
  const individualRequest = {
    extendByDays: 1,
    extendReasonCode: 0,
    requestIdentifier: 'x'.repeat(128)
  };
  const massRequest = {
    extendByDays: 90,
    extendReasonCode: 3,
    requestIdentifier: REQUEST_IDENTIFIER,
    productId: 'com.example.monthly',
    storefrontCountryCodes: ['USA', 'TUR']
  };

  await storeKit.extendSubscriptionRenewalDate('original-transaction', individualRequest);
  await storeKit.extendRenewalDateForAllActiveSubscribers(massRequest);
  await storeKit.getStatusOfSubscriptionRenewalDateExtensions(
    REQUEST_IDENTIFIER,
    massRequest.productId
  );

  assert.deepEqual(calls[0].data, individualRequest);
  assert.deepEqual(calls[1].data, massRequest);
  assert.equal(calls.length, 3);

  const validBase = {
    extendByDays: 1,
    extendReasonCode: 0,
    requestIdentifier: REQUEST_IDENTIFIER,
    productId: 'com.example.monthly'
  };
  const invalidCalls = [
    () => storeKit.extendSubscriptionRenewalDate('original-transaction', {
      ...individualRequest,
      requestIdentifier: 'x'.repeat(129)
    }),
    () => storeKit.extendRenewalDateForAllActiveSubscribers({
      ...validBase,
      requestIdentifier: 'not-a-uuid'
    }),
    () => storeKit.extendRenewalDateForAllActiveSubscribers({
      ...validBase,
      storefrontCountryCodes: []
    }),
    () => storeKit.extendRenewalDateForAllActiveSubscribers({
      ...validBase,
      storefrontCountryCodes: ['US']
    }),
    () => storeKit.extendRenewalDateForAllActiveSubscribers({
      ...validBase,
      storefrontCountryCodes: ['usa']
    }),
    () => storeKit.getStatusOfSubscriptionRenewalDateExtensions(
      'not-a-uuid',
      massRequest.productId
    )
  ];

  for (const invoke of invalidCalls) {
    await assert.rejects(invoke);
  }
  assert.equal(calls.length, 3, 'invalid renewal requests must not reach the network');
});

test('notification history validates required and mutually exclusive fields before I/O', async () => {
  const calls = [];
  const storeKit = createStoreKit(calls);
  const validRequest = {
    startDate: 1,
    endDate: 2,
    notificationType: 'DID_RENEW',
    notificationSubtype: 'BILLING_RECOVERY',
    onlyFailures: false
  };

  await storeKit.getNotificationHistory(validRequest);
  assert.deepEqual(calls[0].data, validRequest);

  const invalidCalls = [
    () => storeKit.getNotificationHistory({ endDate: 2 }),
    () => storeKit.getNotificationHistory({ startDate: 1 }),
    () => storeKit.getNotificationHistory({ startDate: 2, endDate: 2 }),
    () => storeKit.getNotificationHistory({ startDate: 3, endDate: 2 }),
    () => storeKit.getNotificationHistory({
      startDate: 1,
      endDate: 2,
      transactionId: 'transaction',
      notificationType: 'DID_RENEW'
    }),
    () => storeKit.getNotificationHistory({
      startDate: 1,
      endDate: 2,
      notificationSubtype: 'BILLING_RECOVERY'
    }),
    () => storeKit.getNotificationHistory({
      startDate: 1,
      endDate: 2,
      transactionId: '   '
    }),
    () => storeKit.getNotificationHistory({
      startDate: 1,
      endDate: 2,
      onlyFailures: 'true'
    }),
    () => storeKit.getAllNotificationHistory({
      startDate: 2,
      endDate: 2,
      transactionId: 'transaction'
    })
  ];

  for (const invoke of invalidCalls) {
    await assert.rejects(invoke);
  }

  const iterator = storeKit.iterateNotificationHistoryPages({
    startDate: 1,
    endDate: 2,
    transactionId: 'transaction',
    notificationType: 'DID_RENEW'
  });
  await assert.rejects(() => iterator.next());
  assert.equal(calls.length, 1, 'invalid notification requests must not reach the network');
});

test('retention messaging accepts documented boundaries and preserves the request body', async () => {
  const calls = [];
  const storeKit = createStoreKit(calls);
  const message = {
    header: 'h'.repeat(66),
    body: 'b'.repeat(144),
    image: {
      imageIdentifier: IMAGE_IDENTIFIER,
      altText: 'a'.repeat(150)
    },
    headerPosition: 'ABOVE_IMAGE',
    bulletPoints: [{
      text: 't'.repeat(66),
      imageIdentifier: IMAGE_IDENTIFIER,
      altText: 'a'.repeat(150)
    }]
  };
  const urlPrefix = 'https://example.com/';
  const realtimeURL = urlPrefix + 'a'.repeat(256 - urlPrefix.length);

  await storeKit.uploadMessage(MESSAGE_IDENTIFIER, message);
  await storeKit.configureRealtimeURL({ realtimeURL });
  await storeKit.uploadImage(IMAGE_IDENTIFIER, FULL_SIZE_PNG);
  await storeKit.uploadImage(IMAGE_IDENTIFIER, BULLET_POINT_PNG, 'BULLET_POINT');

  assert.deepEqual(calls[0].data, message);
  assert.deepEqual(calls[1].data, { realtimeURL });
  assert.equal(calls[2].data, FULL_SIZE_PNG);
  assert.equal(calls[2].params, undefined);
  assert.equal(new URL(calls[2].url).searchParams.has('imageSize'), false);
  assert.equal(calls[3].data, BULLET_POINT_PNG);
  assert.equal(new URL(calls[3].url).searchParams.get('imageSize'), 'BULLET_POINT');
  assert.equal(calls.length, 4);
});

test('invalid retention identifiers, lengths, and image placement fail before I/O', async () => {
  const calls = [];
  const storeKit = createStoreKit(calls);
  const baseMessage = { header: 'Header', body: 'Body' };
  const urlPrefix = 'https://example.com/';
  const tooLongURL = urlPrefix + 'a'.repeat(257 - urlPrefix.length);
  const invalidCalls = [
    () => storeKit.uploadImage('not-a-uuid', FULL_SIZE_PNG),
    () => storeKit.uploadImage(IMAGE_IDENTIFIER, PNG_SIGNATURE),
    () => storeKit.uploadImage(IMAGE_IDENTIFIER, createPng(3839, 160)),
    () => storeKit.uploadImage(IMAGE_IDENTIFIER, createPng(1024, 1024), 'FULL_SIZE'),
    () => storeKit.uploadImage(
      IMAGE_IDENTIFIER,
      createPng(3840, 160, { colorType: 6 })
    ),
    () => storeKit.uploadImage(
      IMAGE_IDENTIFIER,
      createPng(3840, 160, { transparentChunk: true })
    ),
    () => storeKit.uploadImage(IMAGE_IDENTIFIER, FULL_SIZE_PNG, 'WRONG'),
    () => storeKit.deleteImage('not-a-uuid'),
    () => storeKit.uploadMessage('not-a-uuid', baseMessage),
    () => storeKit.deleteMessage('not-a-uuid'),
    () => storeKit.configureDefaultMessage('product-id', 'en-US', {
      messageIdentifier: 'not-a-uuid'
    }),
    () => storeKit.getPerformanceTestResults('not-a-uuid'),
    () => storeKit.uploadMessage(MESSAGE_IDENTIFIER, {
      ...baseMessage,
      image: { imageIdentifier: 'not-a-uuid', altText: 'Image' }
    }),
    () => storeKit.uploadMessage(MESSAGE_IDENTIFIER, {
      ...baseMessage,
      bulletPoints: [{ text: 'Point', imageIdentifier: 'not-a-uuid', altText: 'Point' }]
    }),
    () => storeKit.uploadMessage(MESSAGE_IDENTIFIER, {
      ...baseMessage,
      header: 'h'.repeat(67)
    }),
    () => storeKit.uploadMessage(MESSAGE_IDENTIFIER, {
      ...baseMessage,
      body: 'b'.repeat(145)
    }),
    () => storeKit.uploadMessage(MESSAGE_IDENTIFIER, {
      ...baseMessage,
      image: { imageIdentifier: IMAGE_IDENTIFIER, altText: 'a'.repeat(151) }
    }),
    () => storeKit.uploadMessage(MESSAGE_IDENTIFIER, {
      ...baseMessage,
      bulletPoints: [{
        text: 't'.repeat(67),
        imageIdentifier: IMAGE_IDENTIFIER,
        altText: 'Point'
      }]
    }),
    () => storeKit.uploadMessage(MESSAGE_IDENTIFIER, {
      ...baseMessage,
      bulletPoints: [{
        text: 'Point',
        imageIdentifier: IMAGE_IDENTIFIER,
        altText: 'a'.repeat(151)
      }]
    }),
    () => storeKit.uploadMessage(MESSAGE_IDENTIFIER, {
      ...baseMessage,
      headerPosition: 'ABOVE_IMAGE'
    }),
    () => storeKit.configureRealtimeURL({ realtimeURL: tooLongURL })
  ];

  for (const invoke of invalidCalls) {
    await assert.rejects(invoke);
  }
  assert.equal(calls.length, 0, 'invalid retention requests must not reach the network');
});
