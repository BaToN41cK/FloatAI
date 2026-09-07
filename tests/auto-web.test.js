const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldAutoSearch, buildExtraInstructions } = require('../src/client');

test('shouldAutoSearch срабатывает на запросы про актуальные данные', () => {
  assert.equal(shouldAutoSearch('сколько стоит iPhone 16 в России сейчас'), true);
  assert.equal(shouldAutoSearch('новости за сегодня про ИИ'), true);
  assert.equal(shouldAutoSearch('какая погода завтра в Москве'), true);
  assert.equal(shouldAutoSearch('последняя версия GLM-4.7-Flash'), true);
  assert.equal(shouldAutoSearch('найди канал SleveR на сайте:youtube.com'), true);
  assert.equal(shouldAutoSearch('https://youtube.com/@channel что это за канал'), true);
});

test('shouldAutoSearch НЕ срабатывает на бытовые фразы и код', () => {
  assert.equal(shouldAutoSearch('привет'), false);
  assert.equal(shouldAutoSearch('как дела'), false);
  assert.equal(shouldAutoSearch('объясни как работает рекурсия в питоне'), false, 'без маркеров актуальности');
  assert.equal(shouldAutoSearch('напиши функцию fibonacci на js'), false);
});

test('инструкция поиска подсказывает единственный вызов инструмента', () => {
  const ins = buildExtraInstructions(false, 8192, { webSearch: true, fetchPage: true });
  assert.match(ins, /один раз/i, 'инструкция говорит вызвать web_search один раз');
  assert.match(ins, /не вызывай инструмент повторно/i);
  assert.match(ins, /site:youtube/);
});