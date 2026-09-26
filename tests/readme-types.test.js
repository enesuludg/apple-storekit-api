'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const readme = readFileSync(path.join(root, 'README.md'), 'utf8');

function extractExample(section) {
  const match = readme.match(new RegExp('^###? ' + section + '\\r?\\n[\\s\\S]*?^```typescript\\r?\\n([\\s\\S]*?)^```', 'm'));
  assert.ok(match, `README ${section} TypeScript example is missing`);
  return match[1];
}

function diagnosticsFor(typescript, source) {
  const virtualFile = path.join(root, 'readme-usage-check.ts');
  const options = {
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    target: typescript.ScriptTarget.ES2022,
    module: typescript.ModuleKind.Node16,
    moduleResolution: typescript.ModuleResolutionKind.Node16,
    esModuleInterop: true
  };
  const host = typescript.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.readFile = (filePath) => path.resolve(filePath) === virtualFile ? source : readFile(filePath);
  host.fileExists = (filePath) => path.resolve(filePath) === virtualFile || fileExists(filePath);
  const program = typescript.createProgram([virtualFile], options, host);
  return typescript.getPreEmitDiagnostics(program);
}

test('README usage and catch examples compile with supported TypeScript versions', () => {
  const usage = extractExample('Usage');
  const firstStatement = usage.indexOf('const appleRootCertificates');
  assert.ok(firstStatement > 0, 'README usage imports were not found');
  const usageSource = `${usage.slice(0, firstStatement)}async function usageExample() {\n${usage.slice(firstStatement)}\n}`;
  const catchSource = `import { AppleStoreKit } from 'apple-storekit-api';\n` +
    `declare const storeKit: AppleStoreKit;\nasync function catchExamples() {\n` +
    extractExample('Set App Account Token') + '\n' + extractExample('Error Handling') + '\n}';

  for (const typescript of [require('typescript-5-2'), require('typescript')]) {
    for (const [label, source] of [['usage', usageSource], ['catch', catchSource]]) {
      const diagnostics = diagnosticsFor(typescript, source);
      assert.deepEqual(
        diagnostics.map(({ code, messageText }) => ({ code, messageText })),
        [],
        `README ${label} example does not compile with TypeScript ${typescript.version}`
      );
    }
  }
});
