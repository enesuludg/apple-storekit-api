'use strict';

const { execFileSync } = require('node:child_process');
const {
  copyFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'src');
const expectedFiles = new Set(['CHANGES.md', 'LICENSE', 'README.md', 'package.json']);
const publishEntries = ['dist', 'README.md', 'CHANGES.md', 'LICENSE'];

function addCompiledFiles(directory, relativeDirectory = '') {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      throw new Error(`Source symlink is not allowed: ${entry.name}`);
    }

    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      addCompiledFiles(path.join(directory, entry.name), relativePath);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts')) {
      throw new Error(`Unexpected source file: ${relativePath}`);
    }

    const stem = relativePath.slice(0, -3);
    expectedFiles.add(`dist/${stem}.js`);
    expectedFiles.add(`dist/${stem}.js.map`);
    expectedFiles.add(`dist/${stem}.d.ts`);
  }
}

addCompiledFiles(sourceRoot);

const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!Array.isArray(packageJson.files) ||
    packageJson.files.length !== publishEntries.length ||
    new Set(packageJson.files).size !== publishEntries.length ||
    publishEntries.some((entry) => !packageJson.files.includes(entry))) {
  throw new Error(`Unexpected package files allowlist: ${JSON.stringify(packageJson.files)}.`);
}
if (packageJson.bin !== undefined || packageJson.man !== undefined ||
    packageJson.bundleDependencies !== undefined ||
    packageJson.bundledDependencies !== undefined ||
    packageJson.directories?.bin !== undefined ||
    packageJson.directories?.man !== undefined ||
    packageJson.workspaces !== undefined) {
  throw new Error('Unexpected package metadata that may add files to the tarball.');
}

// npm 10 runs `prepare` even for `npm pack --dry-run --ignore-scripts`. Packing
// a script-free copy preserves the actual packlist without rebuilding (and
// thereby hiding) stale dist files in the checkout being verified.
const stagingRoot = mkdtempSync(path.join(tmpdir(), 'storekit-packlist-'));
let packOutput;
try {
  for (const entry of publishEntries) {
    const from = path.join(root, entry);
    const to = path.join(stagingRoot, entry);
    if (entry === 'dist') {
      cpSync(from, to, { recursive: true });
    } else {
      copyFileSync(from, to);
    }
  }
  for (const ignoreFile of ['.npmignore', '.gitignore']) {
    const from = path.join(root, ignoreFile);
    if (existsSync(from)) {
      copyFileSync(from, path.join(stagingRoot, ignoreFile));
    }
  }
  const stagedPackageJson = { ...packageJson };
  delete stagedPackageJson.scripts;
  writeFileSync(path.join(stagingRoot, 'package.json'), JSON.stringify(stagedPackageJson));
  packOutput = execFileSync(
    'npm',
    ['pack', '--dry-run', '--ignore-scripts', '--json'],
    { cwd: stagingRoot, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }
  );
} finally {
  rmSync(stagingRoot, { recursive: true, force: true });
}
const packEntries = JSON.parse(packOutput);
if (packEntries.length !== 1 || !Array.isArray(packEntries[0].files)) {
  throw new Error('npm pack returned an unexpected manifest.');
}

const actualFiles = new Set(packEntries[0].files.map(({ path: filePath }) => filePath));
const missing = [...expectedFiles].filter((filePath) => !actualFiles.has(filePath));
const unexpected = [...actualFiles].filter((filePath) => !expectedFiles.has(filePath));
if (missing.length > 0 || unexpected.length > 0 || actualFiles.size !== packEntries[0].files.length) {
  throw new Error(
    `Package manifest mismatch. Missing: ${missing.join(', ') || 'none'}. ` +
    `Unexpected: ${unexpected.join(', ') || 'none'}.`
  );
}

const sensitivePatterns = [
  {
    label: 'private key',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----\s+(?:[A-Za-z0-9+/=]{16,}\s+){2,}-----END (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/
  },
  {
    label: 'GitHub access token',
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/
  },
  {
    label: 'App Store Connect issuer ID',
    pattern: /\bissuerId\s*:\s*['"`]\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\s*['"`]/i
  },
  {
    label: 'App Store Connect key ID',
    pattern: /\bkeyId\s*:\s*['"`][A-Z0-9]{10}['"`]/
  }
];

for (const filePath of actualFiles) {
  const absolutePath = path.resolve(root, filePath);
  if (!absolutePath.startsWith(`${root}${path.sep}`) ||
      !realpathSync(absolutePath).startsWith(`${root}${path.sep}`)) {
    throw new Error(`Package path escapes repository: ${filePath}`);
  }
  const contents = readFileSync(absolutePath, 'utf8');
  for (const { label, pattern } of sensitivePatterns) {
    if (pattern.test(contents)) {
      throw new Error(`Potential ${label} in package file ${filePath}.`);
    }
  }
}

console.log(`Package manifest verified: ${actualFiles.size} expected files; no credential patterns detected.`);
