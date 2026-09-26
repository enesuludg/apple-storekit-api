'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const {
  copyFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function runScript(packageRoot, script) {
  return spawnSync(process.execPath, [path.join(packageRoot, 'scripts', script)], {
    cwd: packageRoot,
    encoding: 'utf8'
  });
}

test('package gate rejects stale files and credentials and clean build removes stale output', () => {
  const packageRoot = mkdtempSync(path.join(tmpdir(), 'storekit-manifest-'));
  try {
    for (const fileName of ['.gitignore', '.npmignore', 'CHANGES.md', 'LICENSE', 'README.md', 'package.json']) {
      copyFileSync(path.join(root, fileName), path.join(packageRoot, fileName));
    }
    for (const directory of ['src', 'dist', 'scripts']) {
      cpSync(path.join(root, directory), path.join(packageRoot, directory), { recursive: true });
    }

    const cleanResult = runScript(packageRoot, 'verify-package.js');
    assert.equal(cleanResult.status, 0, cleanResult.stderr);

    writeFileSync(path.join(packageRoot, 'dist', 'example.js'), 'stale example');
    const staleResult = runScript(packageRoot, 'verify-package.js');
    assert.notEqual(staleResult.status, 0);
    assert.match(staleResult.stderr, /Unexpected: dist\/example\.js/);

    assert.equal(runScript(packageRoot, 'clean-dist.js').status, 0);
    cpSync(path.join(root, 'dist'), path.join(packageRoot, 'dist'), { recursive: true });
    assert.equal(runScript(packageRoot, 'verify-package.js').status, 0);

    const readmePath = path.join(packageRoot, 'README.md');
    writeFileSync(readmePath, readFileSync(readmePath, 'utf8') + '\n' + 'ghp_' + 'A'.repeat(30));
    const credentialResult = runScript(packageRoot, 'verify-package.js');
    assert.notEqual(credentialResult.status, 0);
    assert.match(credentialResult.stderr, /Potential GitHub access token in package file README\.md/);
  } finally {
    rmSync(packageRoot, { recursive: true, force: true });
  }
});
