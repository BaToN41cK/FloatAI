// Тесты защиты служебных ключей режима Auto:
// 1) в исходниках нет открытых секретов
// 2) ключи декодируются в валидном формате
// 3) служебный ключ не уходит на сторонний endpoint (защита как в Cline)
// 4) дневная квота служебных запросов
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const secretKeys = require('../src/secret-keys');
const { Client } = require('../src/client');

const ROOT = path.join(__dirname, '..');

test('в исходниках нет открытых API-ключей', () => {
  for (const f of ['src/secret-keys.js', 'main.js', 'src/client.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!/gsk_[A-Za-z0-9]{20,}/.test(src), `открытый Groq-ключ в ${f}`);
    assert.ok(!/csk-[A-Za-z0-9]{20,}/.test(src), `открытый Cerebras-ключ в ${f}`);
    assert.ok(!/cohere_[A-Za-z0-9]{20,}/.test(src), `открытый Cohere-ключ в ${f}`);
  }
});

test('служебные ключи декодируются в валидном формате', () => {
  assert.match(secretKeys.cohere(), /^cohere_[A-Za-z0-9]{20,}$/);
  assert.match(secretKeys.cerebras(), /^csk-[A-Za-z0-9]{20,}$/);
  assert.match(secretKeys.groq(), /^gsk_[A-Za-z0-9]{20,}$/);
});

test('isBuiltin различает служебный и посторонний ключ', () => {
  assert.equal(secretKeys.isBuiltin('cohere', secretKeys.cohere()), true);
  assert.equal(secretKeys.isBuiltin('cohere', 'cohere_совершенно_другой_ключ_123456'), false);
  assert.equal(secretKeys.isBuiltin('groq', ''), false);
});

function makeClient(opts = {}) {
  return new Client({ provider: 'cohere', model: 'command-a-03-2025', apiKey: 'cohere_test', ...opts });
}

test('служебный ключ игнорирует customEndpoint — запрос идёт на официальный URL', () => {
  const c = makeClient({ keyRestricted: true, customEndpoint: 'https://evil.example.com/v1' });
  const req = c.requestFor([{ role: 'user', content: 'hi' }]);
  assert.equal(req.url.startsWith('https://evil.example.com'), false, 'ключ утёк на чужой endpoint!');
  assert.ok(req.url.length > 0, 'URL должен быть официальным');
});

test('свой ключ пользователя: customEndpoint работает как раньше', () => {
  const c = new Client({ provider: 'custom', model: 'm', apiKey: 'k', customEndpoint: 'https://my.proxy.example.com/v1' });
  const req = c.requestFor([{ role: 'user', content: 'hi' }]);
  assert.equal(req.url, 'https://my.proxy.example.com/v1');
});

test('служебный режим запрещает провайдера custom', () => {
  const c = makeClient({ keyRestricted: true });
  c.setModel('m', 'custom');
  assert.throws(() => c.requestFor([{ role: 'user', content: 'hi' }]), /Auto не работает со своим endpoint/);
});

test('дневная квота служебных запросов: после лимита отказ', () => {
  const c = makeClient({ keyRestricted: true });
  for (let i = 0; i < 300; i++) assert.equal(c.checkBuiltinQuota(), true, `запрос ${i + 1} должен проходить`);
  assert.equal(c.checkBuiltinQuota(), false, 'после лимита квота исчерпана');
  // Свой ключ: квота не действует
  const free = makeClient({ keyRestricted: false });
  for (let i = 0; i < 305; i++) assert.equal(free.checkBuiltinQuota(), true);
});

test('setKeyRestricted переключает режим на лету', () => {
  const c = new Client({ provider: 'custom', model: 'm', apiKey: 'k', customEndpoint: 'https://x.example.com' });
  c.setKeyRestricted(true);
  assert.equal(c.isKeyRestricted(), true);
  assert.throws(() => c.requestFor([{ role: 'user', content: 'hi' }]));
  c.setKeyRestricted(false);
  assert.equal(c.isKeyRestricted(), false);
  assert.equal(c.requestFor([{ role: 'user', content: 'hi' }]).url, 'https://x.example.com');
});
