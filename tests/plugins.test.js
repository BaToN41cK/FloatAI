const test = require('node:test');
const assert = require('node:assert/strict');
const { enabledTools } = require('../src/plugins');
const { getProvider } = require('../src/providers');

test('локальные провайдеры не требуют API-ключ', () => {
  assert.equal(getProvider('ollama').local, true);
  assert.equal(getProvider('lmstudio').local, true);
});

test('плагины можно отключать независимо', () => {
  assert.deepEqual(enabledTools({ webSearch: true, fetchPage: false }), ['web_search']);
  assert.deepEqual(enabledTools({ webSearch: false, fetchPage: false }), []);
});
