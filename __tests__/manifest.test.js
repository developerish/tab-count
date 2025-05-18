const manifest = require('../manifest.json');

test('manifest version is 3', () => {
  expect(manifest.manifest_version).toBe(3);
});
