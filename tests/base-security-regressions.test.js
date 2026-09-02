const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const { inspect } = require('node:util');
const jwt = require('jsonwebtoken');
const {
  AppleStoreKitApiError,
  BaseService
} = require('../dist/services/base.service');

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const MAX_TIMER_DELAY_MS = 2_147_483_647;

function config(overrides = {}) {
  return {
    issuerId: '00000000-0000-4000-8000-000000000000',
    keyId: 'TESTKEY123',
    privateKey: privateKeyPem,
    bundleId: 'com.example.app',
    environment: 'production',
    maxRetries: 0,
    ...overrides
  };
}

function axiosHttpError(request, status, data) {
  const authorization = request.headers.Authorization;
  const error = new Error(`Request failed while using ${authorization}`);
  error.name = 'AxiosError';
  error.isAxiosError = true;
  error.code = 'ERR_BAD_REQUEST';
  error.config = request;
  error.request = { headers: request.headers };
  error.response = {
    status,
    data,
    headers: { authorization }
  };
  return error;
}

test("the actual request bearer contains Apple's required JWT claims", async () => {
  let requestConfig;
  const before = Math.floor(Date.now() / 1000);
  const client = new BaseService(config({
    httpClient: {
      request: async request => {
        requestConfig = request;
        return { status: 200, data: { ok: true } };
      }
    }
  }));

  await client.makeRequest('get', '/inApps/v1/test', undefined, {
    query: {
      productType: ['AUTO_RENEWABLE', 'CONSUMABLE'],
      revoked: false,
      ignored: undefined
    }
  });
  const after = Math.floor(Date.now() / 1000);

  assert.ok(requestConfig);
  const authorization = requestConfig.headers.Authorization;
  assert.match(authorization, /^Bearer /);
  const encodedToken = authorization.slice('Bearer '.length);
  const decoded = jwt.decode(encodedToken, { complete: true });

  assert.ok(decoded);
  assert.equal(decoded.header.alg, 'ES256');
  assert.equal(decoded.header.kid, 'TESTKEY123');
  assert.equal(decoded.payload.iss, config().issuerId);
  assert.equal(decoded.payload.aud, 'appstoreconnect-v1');
  assert.equal(decoded.payload.bid, 'com.example.app');
  assert.ok(Number.isInteger(decoded.payload.iat));
  assert.ok(decoded.payload.iat >= before && decoded.payload.iat <= after);
  assert.equal(decoded.payload.exp, decoded.payload.iat + 300);

  const url = new URL(requestConfig.url);
  assert.equal(url.origin, 'https://api.storekit.apple.com');
  assert.deepEqual(
    url.searchParams.getAll('productType'),
    ['AUTO_RENEWABLE', 'CONSUMABLE']
  );
  assert.equal(url.searchParams.get('revoked'), 'false');
  assert.equal(url.searchParams.has('ignored'), false);
});

test('unsafe endpoints fail before a token is generated or an HTTP request is made', async () => {
  let requestCalls = 0;
  let tokenCalls = 0;

  class TokenCountingClient extends BaseService {
    generateToken() {
      tokenCalls += 1;
      return super.generateToken();
    }
  }

  const client = new TokenCountingClient(config({
    httpClient: {
      request: async () => {
        requestCalls += 1;
        return { status: 200, data: {} };
      }
    }
  }));

  const unsafeEndpoints = [
    '.attacker.example/collect',
    '//attacker.example/collect',
    'https://attacker.example/collect',
    '/\\attacker.example/collect',
    '/safe\npath',
    '/safe#fragment'
  ];

  for (const endpoint of unsafeEndpoints) {
    await assert.rejects(
      () => client.makeRequest('get', endpoint),
      /endpoint must/
    );
  }

  assert.equal(requestCalls, 0);
  assert.equal(tokenCalls, 0);
});

test('API errors retain sanitized diagnostics without serializing bearer credentials', async () => {
  let bearerToken;
  const client = new BaseService(config({
    httpClient: {
      request: async request => {
        bearerToken = request.headers.Authorization.slice('Bearer '.length);
        throw axiosHttpError(request, 400, {
          errorCode: 4000000,
          errorMessage: {
            reason: 'nested validation failure',
            reference: 42,
            credential: request.headers.Authorization
          },
          echoedToken: bearerToken
        });
      }
    }
  }));

  await assert.rejects(
    () => client.makeRequest('get', '/inApps/v1/test'),
    error => {
      assert.ok(error instanceof AppleStoreKitApiError);
      assert.match(error.message, /nested validation failure/);
      assert.match(error.message, /"reference":42/);
      assert.equal(error.statusCode, 400);
      assert.equal(error.errorCode, 4000000);
      assert.equal(error.originalError, error.cause);
      assert.equal(error.originalError.config, undefined);
      assert.equal(error.originalError.request, undefined);
      assert.equal(error.originalError.response.status, 400);
      assert.equal(
        error.originalError.response.data.errorMessage.credential,
        '[REDACTED]'
      );
      assert.equal(error.originalError.response.data.echoedToken, '[REDACTED]');

      const logged = `${error.message}\n${JSON.stringify(error)}`;
      assert.ok(bearerToken);
      assert.equal(logged.includes(bearerToken), false);
      assert.doesNotMatch(logged, /Bearer\s+/i);
      return true;
    }
  );
});

test('automatic-environment attempt diagnostics are sanitized', async () => {
  const bearerTokens = [];
  const client = new BaseService(config({
    environment: undefined,
    httpClient: {
      request: async request => {
        const bearerToken = request.headers.Authorization.slice('Bearer '.length);
        bearerTokens.push(bearerToken);
        throw axiosHttpError(request, 404, {
          errorCode: 4040010,
          errorMessage: 'Transaction not found.',
          token: bearerToken
        });
      }
    }
  }));

  await assert.rejects(
    () => client.makeRequest(
      'get',
      '/inApps/v1/transactions/missing',
      undefined,
      { allowEnvironmentFallback: true }
    ),
    error => {
      assert.ok(error instanceof AppleStoreKitApiError);
      assert.equal(error.attempts.length, 2);
      assert.deepEqual(
        error.attempts.map(attempt => attempt.environment),
        ['production', 'sandbox']
      );
      assert.ok(error.attempts.every(attempt => attempt.error.config === undefined));

      const logged = `${error.message}\n${JSON.stringify(error)}`;
      assert.ok(bearerTokens.length === 2);
      for (const bearerToken of bearerTokens) {
        assert.equal(logged.includes(bearerToken), false);
      }
      assert.doesNotMatch(logged, /Bearer\s+/i);
      return true;
    }
  );
});

test('timeouts must be positive safe integers in client and request options', async () => {
  assert.throws(
    () => new BaseService(config({ timeoutMs: 0.5 })),
    /positive safe integer/
  );
  assert.throws(
    () => new BaseService(config({ timeoutMs: MAX_TIMER_DELAY_MS + 1 })),
    /no greater than/
  );
  assert.throws(
    () => new BaseService(config({ retryBaseDelayMs: MAX_TIMER_DELAY_MS + 1 })),
    /no greater than/
  );
  assert.throws(
    () => new BaseService(config({ maxRetryDelayMs: MAX_TIMER_DELAY_MS + 1 })),
    /no greater than/
  );

  let requestCalls = 0;
  let observedTimeout;
  const client = new BaseService(config({
    httpClient: {
      request: async request => {
        requestCalls += 1;
        observedTimeout = request.timeout;
        return { status: 200, data: {} };
      }
    }
  }));

  await assert.rejects(
    () => client.makeRequest('get', '/inApps/v1/test', undefined, { timeoutMs: 0.5 }),
    /positive safe integer/
  );
  await assert.rejects(
    () => client.makeRequest(
      'get',
      '/inApps/v1/test',
      undefined,
      { timeoutMs: MAX_TIMER_DELAY_MS + 1 }
    ),
    /no greater than/
  );
  assert.equal(requestCalls, 0);

  await client.makeRequest('get', '/inApps/v1/test', undefined, { timeoutMs: 1 });
  assert.equal(requestCalls, 1);
  assert.equal(observedTimeout, 1);
});

test('generic custom-adapter errors cannot expose the generated bearer token', async () => {
  let bearerToken;
  const client = new BaseService(config({
    httpClient: {
      request: async request => {
        bearerToken = request.headers.Authorization.slice('Bearer '.length);
        const error = new Error(`custom adapter failed with Bearer ${bearerToken}`);
        error.name = `Bearer ${bearerToken}`;
        error.code = `CUSTOM_ADAPTER_FAILURE Bearer ${bearerToken}`;
        error.requestConfig = request;
        throw error;
      }
    }
  }));

  await assert.rejects(
    () => client.makeRequest('get', '/inApps/v1/test'),
    error => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, '[REDACTED]');
      assert.equal(error.code, 'CUSTOM_ADAPTER_FAILURE [REDACTED]');
      assert.equal(error.requestConfig, undefined);
      assert.match(error.message, /custom adapter failed with \[REDACTED\]/);
      assert.ok(bearerToken);

      const logged = [
        error.message,
        error.stack,
        JSON.stringify(error),
        inspect(error, { depth: 8 })
      ].join('\n');
      assert.equal(logged.includes(bearerToken), false);
      assert.doesNotMatch(logged, /Bearer\s+/i);
      assert.equal(error.cause.name, '[REDACTED]');
      return true;
    }
  );
});
