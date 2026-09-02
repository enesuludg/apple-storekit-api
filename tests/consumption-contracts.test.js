const test = require('node:test');
const assert = require('node:assert/strict');
const { ConsumptionService } = require('../dist/services/consumption.service');
const {
  AccountTenure,
  ConsumptionStatus,
  DeliveryStatusV1,
  LifetimeDollars,
  Platform,
  PlayTime,
  RefundPreferenceV1,
  UserStatus
} = require('../dist/interfaces/consumption');

function createClient() {
  const calls = {
    resolve: [],
    request: [],
    requestWithEnvironment: []
  };
  const client = {
    makeRequest: async (...args) => {
      calls.request.push(args);
    },
    makeRequestWithEnvironment: async (...args) => {
      calls.requestWithEnvironment.push(args);
      return {
        data: undefined,
        environment: 'production',
        statusCode: 202
      };
    },
    resolveTransactionEnvironment: async (...args) => {
      calls.resolve.push(args);
      return 'production';
    },
    verifyAndDecodeTransaction: async () => ({})
  };

  return { calls, client };
}

function createV1Request(overrides = {}) {
  return {
    accountTenure: AccountTenure.UNDECLARED,
    appAccountToken: '',
    consumptionStatus: ConsumptionStatus.FULLY_CONSUMED,
    customerConsented: true,
    deliveryStatus: DeliveryStatusV1.DELIVERED_AND_WORKING_PROPERLY,
    lifetimeDollarsPurchased: LifetimeDollars.UNDECLARED,
    lifetimeDollarsRefunded: LifetimeDollars.USD_0,
    platform: Platform.APPLE,
    playTime: PlayTime.UNDECLARED,
    refundPreference: RefundPreferenceV1.NO_PREFERENCE,
    sampleContentProvided: true,
    userStatus: UserStatus.ACTIVE,
    ...overrides
  };
}

test('V1 enums expose Apple numeric contract values', () => {
  assert.deepEqual(
    [
      DeliveryStatusV1.DELIVERED_AND_WORKING_PROPERLY,
      DeliveryStatusV1.DID_NOT_DELIVER_DUE_TO_QUALITY_ISSUE,
      DeliveryStatusV1.DELIVERED_WRONG_ITEM,
      DeliveryStatusV1.DID_NOT_DELIVER_DUE_TO_SERVER_OUTAGE,
      DeliveryStatusV1.DID_NOT_DELIVER_DUE_TO_IN_GAME_CURRENCY_CHANGE,
      DeliveryStatusV1.DID_NOT_DELIVER_FOR_OTHER_REASON
    ],
    [0, 1, 2, 3, 4, 5]
  );
  assert.deepEqual(
    [
      RefundPreferenceV1.UNDECLARED,
      RefundPreferenceV1.PREFER_GRANT,
      RefundPreferenceV1.PREFER_DECLINE,
      RefundPreferenceV1.NO_PREFERENCE
    ],
    [0, 1, 2, 3]
  );
});

test('V1 sends the complete V1 request to the deprecated endpoint', async () => {
  const { calls, client } = createClient();
  const service = new ConsumptionService(client);
  const request = createV1Request({
    appAccountToken: '00000000-0000-4000-8000-000000000000',
    unexpected: 'must not be sent'
  });

  await service.sendConsumptionInformation('transaction/id', request);

  assert.equal(calls.resolve.length, 1);
  assert.equal(calls.request.length, 1);
  assert.deepEqual(calls.request[0], [
    'put',
    '/inApps/v1/transactions/consumption/transaction%2Fid',
    {
      accountTenure: request.accountTenure,
      appAccountToken: request.appAccountToken,
      consumptionStatus: request.consumptionStatus,
      customerConsented: request.customerConsented,
      deliveryStatus: request.deliveryStatus,
      lifetimeDollarsPurchased: request.lifetimeDollarsPurchased,
      lifetimeDollarsRefunded: request.lifetimeDollarsRefunded,
      platform: request.platform,
      playTime: request.playTime,
      refundPreference: request.refundPreference,
      sampleContentProvided: request.sampleContentProvided,
      userStatus: request.userStatus
    },
    { environment: 'production', retry: true }
  ]);
  assert.equal(calls.requestWithEnvironment.length, 0);
});

test('V1 validates every required field before environment resolution', async () => {
  const invalidRequests = [
    createV1Request({ accountTenure: undefined }),
    createV1Request({ appAccountToken: undefined }),
    createV1Request({ consumptionStatus: 4 }),
    createV1Request({ deliveryStatus: 'DELIVERED' }),
    createV1Request({ lifetimeDollarsPurchased: 8 }),
    createV1Request({ lifetimeDollarsRefunded: -1 }),
    createV1Request({ platform: 3 }),
    createV1Request({ playTime: 8 }),
    createV1Request({ refundPreference: 4 }),
    createV1Request({ sampleContentProvided: null }),
    createV1Request({ userStatus: 5 })
  ];

  for (const request of invalidRequests) {
    const { calls, client } = createClient();
    const service = new ConsumptionService(client);
    await assert.rejects(
      () => service.sendConsumptionInformation('transaction', request)
    );
    assert.equal(calls.resolve.length, 0);
    assert.equal(calls.request.length, 0);
  }
});

test('V2 sends only the five fields Apple accepts', async () => {
  const { calls, client } = createClient();
  const service = new ConsumptionService(client);

  const result = await service.sendConsumptionInformationV2('transaction', {
    customerConsented: true,
    deliveryStatus: 'DELIVERED',
    sampleContentProvided: false,
    consumptionPercentage: 100000,
    refundPreference: 'DECLINE',
    accountTenure: 7,
    appAccountToken: 'not-a-uuid',
    unexpected: 'must not be sent'
  });

  assert.deepEqual(result, {
    success: true,
    transactionId: 'transaction',
    statusCode: 202
  });
  assert.equal(calls.resolve.length, 1);
  assert.equal(calls.request.length, 0);
  assert.deepEqual(calls.requestWithEnvironment[0], [
    'put',
    '/inApps/v2/transactions/consumption/transaction',
    {
      customerConsented: true,
      deliveryStatus: 'DELIVERED',
      sampleContentProvided: false,
      consumptionPercentage: 100000,
      refundPreference: 'DECLINE'
    },
    { environment: 'production', retry: true }
  ]);
});

test('both endpoints reject non-true consent before environment resolution', async () => {
  for (const customerConsented of [false, undefined, null, 1]) {
    const { calls, client } = createClient();
    const service = new ConsumptionService(client);

    await assert.rejects(
      () => service.sendConsumptionInformation(
        'transaction',
        createV1Request({ customerConsented })
      ),
      /Customer consent is required/
    );
    await assert.rejects(
      () => service.sendConsumptionInformationV2('transaction', {
        customerConsented,
        deliveryStatus: 'DELIVERED',
        sampleContentProvided: true
      }),
      /Customer consent is required/
    );

    assert.equal(calls.resolve.length, 0);
    assert.equal(calls.request.length, 0);
    assert.equal(calls.requestWithEnvironment.length, 0);
  }
});

test('V2 rejects a non-integer or out-of-range percentage before any client call', async () => {
  for (const consumptionPercentage of [-1, 0.5, 100001, NaN, Infinity]) {
    const { calls, client } = createClient();
    const service = new ConsumptionService(client);

    await assert.rejects(
      () => service.sendConsumptionInformationV2('transaction', {
        customerConsented: true,
        deliveryStatus: 'DELIVERED',
        sampleContentProvided: true,
        consumptionPercentage
      }),
      /integer between 0 and 100000/
    );

    assert.equal(calls.resolve.length, 0);
    assert.equal(calls.requestWithEnvironment.length, 0);
  }
});

test('V2 validates required runtime types and delivery-percentage consistency', async () => {
  const invalidRequests = [
    {
      customerConsented: true,
      deliveryStatus: null,
      sampleContentProvided: true
    },
    {
      customerConsented: true,
      deliveryStatus: 'DELIVERED',
      sampleContentProvided: null
    },
    {
      customerConsented: true,
      deliveryStatus: 'DELIVERED',
      sampleContentProvided: true,
      refundPreference: null
    },
    {
      customerConsented: true,
      deliveryStatus: 'UNDELIVERED_OTHER',
      sampleContentProvided: true,
      consumptionPercentage: 1
    },
    {
      customerConsented: true,
      deliveryStatus: 'DELIVERED',
      sampleContentProvided: true,
      refundPreference: 'GRANT_PRORATED',
      consumptionPercentage: 0
    },
    {
      customerConsented: true,
      deliveryStatus: 'DELIVERED',
      sampleContentProvided: true,
      refundPreference: 'GRANT_PRORATED',
      consumptionPercentage: 100000
    }
  ];

  for (const request of invalidRequests) {
    const { calls, client } = createClient();
    const service = new ConsumptionService(client);
    await assert.rejects(
      () => service.sendConsumptionInformationV2('transaction', request)
    );
    assert.equal(calls.resolve.length, 0);
    assert.equal(calls.requestWithEnvironment.length, 0);
  }

  const { calls, client } = createClient();
  const service = new ConsumptionService(client);
  await service.sendConsumptionInformationV2('transaction', {
    customerConsented: true,
    deliveryStatus: 'UNDELIVERED_OTHER',
    sampleContentProvided: true,
    consumptionPercentage: 0
  });
  await service.sendConsumptionInformationV2('transaction', {
    customerConsented: true,
    deliveryStatus: 'DELIVERED',
    sampleContentProvided: true,
    refundPreference: 'GRANT_PRORATED',
    consumptionPercentage: 50000
  });
  assert.equal(calls.requestWithEnvironment.length, 2);
});
