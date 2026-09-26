'use strict';

const { rmSync } = require('node:fs');
const path = require('node:path');

rmSync(path.resolve(__dirname, '..', 'dist'), { recursive: true, force: true });
