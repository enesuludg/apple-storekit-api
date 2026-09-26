const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const { AppleStoreKit } = require('../dist/appleStoreKit');

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const DAY_MS = 24 * 60 * 60 * 1_000;

test('an accepted retention-boundary query can fetch later pages after the clock advances', async t => {
  const acceptedAt = 1_800_000_000_000;
  let now = acceptedAt;
  t.mock.method(Date, 'now', () => now);

  const calls = [];
  const storeKit = new AppleStoreKit({
    issuerId: '00000000-0000-4000-8000-000000000000',
    keyId: 'TESTKEY123',
    privateKey: privateKeyPem,
    bundleId: 'com.example.app',
    environment: 'sandbox',
    maxRetries: 0,
    httpClient: {
      request: async request => {
        calls.push(request);
        if (calls.length === 1) {
          now += 1;
          return {
            status: 200,
            data: {
              notificationHistory: [{ signedPayload: 'page-one' }],
              hasMore: true,
              paginationToken: 'next-page'
            }
          };
        }
        return {
          status: 200,
          data: {
            notificationHistory: [{ signedPayload: 'page-two' }],
            hasMore: false
          }
        };
      }
    }
  });
  const request = {
    startDate: acceptedAt - 30 * DAY_MS,
    endDate: acceptedAt - 1
  };

  const result = await storeKit.getAllNotificationHistory(request);
  assert.deepEqual(result.notificationHistory, [
    { signedPayload: 'page-one' },
    { signedPayload: 'page-two' }
  ]);
  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[0].url).searchParams.has('paginationToken'), false);
  assert.equal(new URL(calls[1].url).searchParams.get('paginationToken'), 'next-page');
  assert.ok(calls.every(call => call.url.startsWith('https://api.storekit-sandbox.apple.com/')));
  assert.ok(calls.every(call => call.data.startDate === request.startDate));

  await assert.rejects(
    () => storeKit.getNotificationHistory(request),
    /past 30 days in sandbox/
  );
  assert.equal(calls.length, 2, 'a new query outside retention must fail before I/O');
});
