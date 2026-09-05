const test = require('node:test');
const assert = require('node:assert/strict');
const settings = require('../src/settings');

test('ключи запоминаются per-провайдер и переживают перезагрузку', () => {
  settings.reload();
  const saved = settings.save({ providerKeys: { openai: 'test-key-openai-123' } });
  assert.equal(saved.providerKeys.openai, 'test-key-openai-123');
  // перечитываем с диска (вне Electron шифрование недоступно — ключи хранятся как есть)
  settings.reload();
  const loaded = settings.load();
  assert.equal(loaded.providerKeys.openai, 'test-key-openai-123');
  // ключ другого провайдера не затирается
  settings.save({ providerKeys: { mistral: 'test-key-mistral-456' } });
  const again = settings.load();
  assert.equal(again.providerKeys.openai, 'test-key-openai-123');
  assert.equal(again.providerKeys.mistral, 'test-key-mistral-456');
});

test('сохранение с пустым apiKey для провайдера очищает его ключ в карте', () => {
  settings.reload();
  settings.save({ providerKeys: { zai: 'zai-key-789' } });
  const saved = settings.save({ provider: 'zai', apiKey: '' });
  assert.equal(saved.providerKeys.zai, '');
  settings.reload();
  // пустая запись после перезагрузки просто исчезает с диска
  assert.equal(settings.load().providerKeys.zai, undefined);
  // ключ другого провайдера при этом цел
  assert.equal(settings.load().providerKeys.openai, 'test-key-openai-123');
});
