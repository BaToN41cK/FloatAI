const test = require('node:test');
const assert = require('node:assert/strict');
const { Client, extractReplyText } = require('../src/client');

test('извлечение текста из ответов разных провайдеров', () => {
  assert.equal(extractReplyText({ choices: [{ message: { content: 'привет' } }] }, 'mistral'), 'привет');
  assert.equal(extractReplyText({ content: [{ text: 'abc' }, { text: 'def' }] }, 'anthropic'), 'abcdef');
  assert.equal(extractReplyText({ candidates: [{ content: { parts: [{ text: 'x' }] } }] }, 'google'), 'x');
  assert.equal(extractReplyText({}, 'openai'), '');
});

test('компактирование: без доступной модели — эвристическая сводка (фолбэк)', async () => {
  const client = new Client({ provider: 'ollama', model: 'llama3.2' }); // локальный endpoint не запущен
  const session = client.ensureActive();
  const dropped = [
    { role: 'user', content: 'Меня зовут Серёжа, я люблю кофе' },
    { role: 'assistant', content: 'Запомнил: тебя зовут Серёжа, кофе — любимый напиток' }
  ];
  const prev = session.summary || '';
  client.compactSummary(session, dropped);
  // ждём фолбэк (соединение с Ollama падает быстро)
  await new Promise(r => setTimeout(r, 3000));
  assert.ok(session.summary && session.summary.length > prev.length, 'сводка дополнена');
  assert.match(session.summary, /Пользователь|Ассистент/);
});
