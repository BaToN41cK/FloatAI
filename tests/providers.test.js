const test = require('node:test');
const assert = require('node:assert/strict');
const { PROVIDERS, providerForModel, getProvider, modelPricing } = require('../src/providers');
const { isRateLimitError, isZaiOverload, friendlyError } = require('../src/ai-errors');
const { Cooldown } = require('../src/cooldown');
const { buildExtraInstructions } = require('../src/client');
const { Client } = require('../src/client');

test('определяет провайдера по модели', () => {
  assert.equal(providerForModel('gpt-4o-mini'), 'openai');
  assert.equal(providerForModel('claude-3-5-haiku-latest'), 'anthropic');
  assert.equal(providerForModel('gemini-2.5-flash'), 'google');
  assert.equal(providerForModel('mistral-small-latest'), 'mistral');
  assert.equal(providerForModel('GLM-4.7-Flash'), 'zai');
});

test('возвращает каталог моделей провайдера', () => {
  const provider = getProvider('openai');
  assert.equal(provider.id, 'openai');
  assert.ok(provider.models.includes('gpt-4o-mini'));
});

test('каждый провайдер имеет достаточно моделей', () => {
  // Cerebras сейчас официально держит на публичном API всего две модели
  for (const [id, provider] of Object.entries(PROVIDERS)) {
    assert.ok(provider.models.length >= (id === 'cerebras' ? 2 : 5), `${id}: мало моделей`);
  }
});

test('Z.ai содержит пять платных и три бесплатные модели', () => {
  const paid = PROVIDERS.zai.models.filter(model => modelPricing('zai', model) === 'paid');
  const free = PROVIDERS.zai.models.filter(model => modelPricing('zai', model) === 'free');
  assert.ok(paid.length >= 5);
  assert.ok(free.length >= 3);
});

test('распознаёт ошибку лимита и удерживает cooldown', () => {
  assert.equal(isRateLimitError('HTTP 429 rate_limited'), true);
  assert.match(friendlyError('HTTP 401 unauthorized'), /API-ключ/);
  const cooldown = new Cooldown(1000);
  cooldown.start(100);
  assert.equal(cooldown.active(500), true);
  assert.equal(cooldown.active(1200), false);
});

test('распознаёт перегрузку Z.ai и показывает понятную ошибку', () => {
  const raw = '{"error":{"code":"1305","message":"该模型当前访问量过大，请您稍后再试"}}';
  assert.equal(isZaiOverload(raw), true);
  assert.equal(isZaiOverload('HTTP 429 rate_limited'), false);
  assert.match(friendlyError(`AI API 429: ${raw}`), /Z\.ai/);
  assert.match(friendlyError(`AI API 429: ${raw}`), /перегружена/);
});

test('Auto — локальный провайдер без ключа, модель ~8B', () => {
  const auto = getProvider('auto');
  assert.equal(auto.local, true, 'Auto — локальный, ключ не нужен');
  assert.ok(auto.models.some(m => /(:7b|:8b|8b)/i.test(m)), 'есть модель около 8 млрд параметров');
  assert.match(auto.chatUrl, /^http:\/\/127\.0\.0\.1/, 'работает офлайн через локальный endpoint');
  assert.equal(modelPricing('auto', 'qwen2.5:7b'), 'free');
});

test('Cohere и Cerebras добавлены в каталог', () => {
  assert.ok(PROVIDERS.cohere, 'Cohere присутствует');
  assert.ok(PROVIDERS.cerebras, 'Cerebras присутствует');
  assert.equal(modelPricing('cerebras', 'gpt-oss-120b'), 'free', 'Cerebras — бесплатный тариф');
  assert.ok(PROVIDERS.cohere.models.length >= 3);
  assert.ok(PROVIDERS.cerebras.models.length >= 2);
});

test('формирует OpenAI-совместимый запрос с инструментами', () => {
  const client = new Client({ provider: 'openai', model: 'gpt-4o-mini', apiKey: 'test-key', deepThink: true });
  const request = client.requestFor([{ role: 'user', content: 'найди новости' }]);
  assert.equal(request.body.model, 'gpt-4o-mini');
  assert.equal(request.body.stream, true);
  assert.ok(request.body.max_tokens > 1000);
  assert.ok(Array.isArray(request.body.tools));
});

test('обычный режим (без глубокого размышления) — короткий потолок ~100 слов', () => {
  const client = new Client({ provider: 'openai', model: 'gpt-4o-mini', apiKey: 'test-key' });
  const request = client.requestFor([{ role: 'user', content: 'что такое HTTP' }]);
  assert.equal(request.body.max_tokens, 400, 'короткий потолок 400 токенов');
  const instructions = buildExtraInstructions(false, 8192, { webSearch: false, fetchPage: false });
  assert.match(instructions, /примерно в 100 слов/);
  assert.doesNotMatch(instructions, /Ограничений на длину ответа НЕТ/);
});

test('глубокое размышление снимает ограничение длины', () => {
  const client = new Client({ provider: 'openai', model: 'gpt-4o-mini', apiKey: 'test-key', deepThink: true });
  const request = client.requestFor([{ role: 'user', content: 'расскажи подробно' }]);
  assert.ok(request.body.max_tokens > 1000, 'полный лимит модели');
  const instructions = buildExtraInstructions(true, 8192, { webSearch: false, fetchPage: false });
  assert.match(instructions, /Ограничений на длину ответа НЕТ/);
  assert.match(instructions, /Глубокое размышление/);
});

test('ограничивает вывод Mistral лимитом модели', () => {
  const client = new Client({ provider: 'mistral', model: 'mistral-medium-latest', apiKey: 'test-key', deepThink: true });
  const request = client.requestFor([{ role: 'user', content: 'расскажи обо мне' }]);
  assert.equal(request.body.max_tokens, 8192);
});

test('ограничивает вывод Cohere лимитом модели', () => {
  const client = new Client({ provider: 'cohere', model: 'command-a-03-2025', apiKey: 'test-key', deepThink: true });
  const request = client.requestFor([{ role: 'user', content: 'расскажи обо мне' }]);
  assert.equal(request.body.max_tokens, 8192);
});

test('включённый поиск добавляет инструкцию про источники, выключенный — нет', () => {
  const withWeb = buildExtraInstructions(false, 8192, { webSearch: true, fetchPage: true });
  assert.match(withWeb, /Источники/);
  assert.match(withWeb, /web_search/);
  const noWeb = buildExtraInstructions(false, 8192, { webSearch: false, fetchPage: false });
  assert.doesNotMatch(noWeb, /Источники/);
  assert.doesNotMatch(noWeb, /web_search/);
});

test('формирует Anthropic и Google payload без OpenAI-полей', () => {
  const conversation = [{ role: 'system', content: 'Ты помощник' }, { role: 'user', content: 'Привет' }];
  const anthropic = new Client({ provider: 'anthropic', model: 'claude-3-5-haiku-latest', apiKey: 'test-key', deepThink: true }).requestFor(conversation);
  assert.equal(anthropic.body.system, 'Ты помощник');
  assert.ok(anthropic.body.max_tokens > 1000);
  assert.equal(anthropic.body.messages[0].role, 'user');
  const google = new Client({ provider: 'google', model: 'gemini-2.5-flash', apiKey: 'test-key', deepThink: true }).requestFor(conversation);
  assert.ok(google.body.contents[0].parts[0].text);
  assert.ok(google.body.generationConfig.maxOutputTokens > 1000);
});

test('ограничивает вывод Anthropic лимитом модели', () => {
  const client = new Client({ provider: 'anthropic', model: 'claude-3-5-haiku-latest', apiKey: 'test-key', deepThink: true });
  const request = client.requestFor([{ role: 'user', content: 'расскажи подробно' }]);
  assert.equal(request.body.max_tokens, 8192);
});

test('Z.ai получает переключатель глубокого размышления', () => {
  const client = new Client({ provider: 'zai', model: 'GLM-4.7-Flash', apiKey: 'test-key', deepThink: true });
  const request = client.requestFor([{ role: 'user', content: 'реши задачу' }]);
  assert.deepEqual(request.body.thinking, { type: 'enabled' });
});
