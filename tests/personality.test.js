const test = require('node:test');
const assert = require('node:assert/strict');
const { corePrompt, selectPersonality, reload, loadPersonality, validatePersonality } = require('../src/personality');
const { approxTokens, trimHistory, peekReply } = require('../src/client');

// Тесты должны быть независимы от сортировки кэша модуля
test('loadPersonality возвращает полный текст личности', () => {
  const full = loadPersonality();
  assert.ok(full.length > 20, 'личность должна содержать текст');
  assert.match(full, /ассистент/i);
});

test('corePrompt читается один раз и содержит ВЕСЬ файл личности', () => {
  const a = corePrompt();
  const b = corePrompt(); // второй вызов должен вернуть то же самое (кэш)
  assert.equal(a, b, 'постоянный system prompt не должен меняться');
  assert.ok(a.length > 0);
  // Постоянная память: полная личность целиком, без выборки секций
  assert.equal(a, loadPersonality(), 'corePrompt = весь файл личности, всегда');
  assert.match(a, /ассистент|Характер и поведение/i);
  assert.match(a, /Речевые фишки|Формат и принципы/i);
});

test('после reload corePrompt пересобирается корректно', () => {
  const before = corePrompt();
  reload(); // сбрасывает и кэш файла, и corePrompt
  const after = corePrompt();
  assert.ok(after.length > 0);
  assert.match(after, /ассистент/i);
});

test('peekReply даёт мгновенный ответ на простые фразы', () => {
  assert.match(peekReply('привет'), /^Привет/);
  assert.match(peekReply('как дела?'), /Работаю/);
  assert.match(peekReply('спасибо'), /пожалуйста/);
  assert.match(peekReply('пока'), /До связи/);
  assert.equal(peekReply('реши задачу по математике'), null);
  assert.equal(peekReply(''), null);
});

test('личность постоянная: selectPersonality всегда возвращает весь файл', () => {
  const sel = selectPersonality('привет', '');
  assert.equal(sel, loadPersonality(), 'личность не выбирается под запрос — она всегда полная');
});

test('approxTokens оценивает токены и не падает на пустых значениях', () => {
  assert.equal(approxTokens(''), 0);
  assert.equal(approxTokens(null), 0);
  const cyrillic = approxTokens('а'.repeat(20)); // ~2 симв/токен -> ~10
  const latin = approxTokens('a'.repeat(20));    // ~4 симв/токен -> ~5
  assert.ok(cyrillic >= 7, 'кириллица дороже токеном, чем латиница');
  assert.ok(latin < cyrillic);
});

test('trimHistory соблюдает бюджет токенов и держит последнее сообщение', () => {
  const history = [
    { role: 'user', content: 'a'.repeat(4000) },   // ~1000 токенов
    { role: 'assistant', content: 'b'.repeat(400) },// ~100 токенов
    { role: 'user', content: 'новый вопрос' }       // всегда последним
  ];
  const trimmed = trimHistory(history, 200);
  assert.ok(trimmed.length >= 1);
  assert.equal(trimmed[trimmed.length - 1].content, 'новый вопрос');
  const total = trimmed.reduce((s, m) => s + approxTokens(m.content), 0);
  assert.ok(total <= 260, 'бюджет должен соблюдаться (± одно сообщение)');
});

test('reload перечитывает файл без падений', () => {
  const a = reload();
  assert.ok(a.length > 0);
});

test('validatePersonality отклоняет пустую личность и предупреждает о секрете', () => {
  assert.equal(validatePersonality('').ok, false);
  const result = validatePersonality('# Агент\napi_key: secret');
  assert.equal(result.ok, true);
  assert.ok(result.warnings.length > 0);
});