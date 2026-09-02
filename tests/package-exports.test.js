const test = require('node:test');
const assert = require('node:assert/strict');

const legacyRuntimeSubpaths = [
  'dist',
  'dist/index',
  'dist/index.js',
  'dist/appleStoreKit',
  'dist/appleStoreKit.js',
  'dist/interfaces',
  'dist/interfaces/index',
  'dist/interfaces/index.js',
  'dist/interfaces/config',
  'dist/interfaces/config.js',
  'dist/interfaces/consumption',
  'dist/interfaces/consumption.js',
  'dist/interfaces/subscription',
  'dist/interfaces/subscription.js',
  'dist/interfaces/transaction',
  'dist/interfaces/transaction.js',
  'dist/services',
  'dist/services/index',
  'dist/services/index.js',
  'dist/services/base.service',
  'dist/services/base.service.js',
  'dist/services/consumption.service',
  'dist/services/consumption.service.js',
  'dist/services/subscription.service',
  'dist/services/subscription.service.js',
  'dist/services/transaction.service',
  'dist/services/transaction.service.js'
];

test('package root supports CommonJS and ESM consumers', async () => {
  const commonJsPackage = require('apple-storekit-api');
  const esmPackage = await import('apple-storekit-api');

  assert.equal(typeof commonJsPackage.AppleStoreKit, 'function');
  assert.equal(typeof esmPackage.AppleStoreKit, 'function');
});

test('all published v1 JavaScript deep imports remain available', async () => {
  for (const subpath of legacyRuntimeSubpaths) {
    const specifier = `apple-storekit-api/${subpath}`;
    assert.doesNotThrow(() => require(specifier), `CommonJS import failed: ${specifier}`);
    await assert.doesNotReject(import(specifier), `ESM import failed: ${specifier}`);
  }

  assert.equal(require('apple-storekit-api/package.json').name, 'apple-storekit-api');
});

test('v2 internals are not exposed as accidental public subpaths', () => {
  const privateSubpaths = [
    'apple-storekit-api/services/validation',
    'apple-storekit-api/dist/services/pagination',
    'apple-storekit-api/dist/interfaces/retention'
  ];

  for (const specifier of privateSubpaths) {
    assert.throws(
      () => require(specifier),
      error => error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
      `Unexpected public subpath: ${specifier}`
    );
  }
});
