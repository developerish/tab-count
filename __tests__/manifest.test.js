const assert = require('assert');
const manifest = require('../manifest.json');

assert.strictEqual(manifest.manifest_version, 3);
console.log('manifest version is 3');
