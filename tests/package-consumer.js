'use strict';

const { execFileSync } = require('node:child_process');
const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const packageName = 'apple-storekit-api';
const repositoryRoot = path.resolve(__dirname, '..');
const temporaryRoot = mkdtempSync(path.join(tmpdir(), `${packageName}-consumer-`));
const consumerRoot = path.join(temporaryRoot, 'consumer');
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

function run(command, args, cwd = consumerRoot) {
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

try {
  const packOutput = execFileSync(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', temporaryRoot],
    { cwd: repositoryRoot, encoding: 'utf8' }
  );
  const [{ filename }] = JSON.parse(packOutput);
  const tarballPath = path.join(temporaryRoot, filename);

  mkdirSync(consumerRoot);
  writeFileSync(
    path.join(consumerRoot, 'package.json'),
    JSON.stringify({ name: 'storekit-package-consumer', private: true }, null, 2)
  );
  run('npm', [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--package-lock=false',
    tarballPath
  ]);

  const commonJsConsumer = `
const assert = require('node:assert/strict');
const packageRoot = require('${packageName}');
assert.equal(typeof packageRoot.AppleStoreKit, 'function');
for (const subpath of ${JSON.stringify(legacyRuntimeSubpaths)}) {
  assert.doesNotThrow(() => require(\`${packageName}/\${subpath}\`), subpath);
}
assert.equal(require('${packageName}/package.json').version, '2.0.0');
`;
  writeFileSync(path.join(consumerRoot, 'consumer.cjs'), commonJsConsumer);
  run(process.execPath, ['consumer.cjs']);

  const esmConsumer = `
import assert from 'node:assert/strict';
import { AppleStoreKit } from '${packageName}';
assert.equal(typeof AppleStoreKit, 'function');
for (const subpath of ${JSON.stringify(legacyRuntimeSubpaths)}) {
  await assert.doesNotReject(import(\`${packageName}/\${subpath}\`), subpath);
}
`;
  writeFileSync(path.join(consumerRoot, 'consumer.mjs'), esmConsumer);
  run(process.execPath, ['consumer.mjs']);

  const legacyTypeImports = legacyRuntimeSubpaths
    .map((subpath, index) => `import * as Legacy${index} from '${packageName}/${subpath}';`)
    .join('\n');
  const typeScriptConsumer = `
import {
  AppleStoreKit,
  type AppleStoreKitConfig,
  type TransactionInfo
} from '${packageName}';
${legacyTypeImports}

declare const config: AppleStoreKitConfig;
const client = new AppleStoreKit(config);
const decoded: Promise<TransactionInfo> = client.decodeSignedData('signed', 'sandbox');
void client;
void decoded;
`;
  writeFileSync(path.join(consumerRoot, 'consumer.ts'), typeScriptConsumer);
  writeFileSync(
    path.join(consumerRoot, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'es2022',
        module: 'Node16',
        moduleResolution: 'Node16',
        strict: true,
        noEmit: true,
        skipLibCheck: false
      },
      include: ['consumer.ts']
    }, null, 2)
  );

  const compilers = [
    path.join(repositoryRoot, 'node_modules/typescript-5-2/bin/tsc'),
    path.join(repositoryRoot, 'node_modules/typescript/bin/tsc')
  ];
  for (const compiler of compilers) {
    run(process.execPath, [compiler, '-p', 'tsconfig.json']);
  }

  const installedPackage = JSON.parse(readFileSync(
    path.join(consumerRoot, 'node_modules', packageName, 'package.json'),
    'utf8'
  ));
  if (installedPackage.version !== '2.0.0') {
    throw new Error(`Expected package version 2.0.0, received ${installedPackage.version}.`);
  }

  console.log('Tarball consumer checks passed for CJS, ESM, TypeScript 5.2, and current TypeScript.');
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
