// Каталог моделей не должен расходиться между рендерером (app/js/models.js)
// и главным процессом (src/providers.js). Раньше из-за такого дрейфа
// провайдеры Cohere и Cerebras показывали список моделей Mistral.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PROVIDERS } = require('../src/providers');

const modelsJsPath = path.join(__dirname, '..', 'app', 'js', 'models.js');
const modelsJs = fs.readFileSync(modelsJsPath, 'utf8');

// Извлечь блок MODEL_OPTIONS = { ... } и собрать ключи "provider: [...]".
const start = modelsJs.indexOf('export const MODEL_OPTIONS = {');
const end = modelsJs.indexOf('};', start);
assert.ok(start !== -1 && end !== -1, 'MODEL_OPTIONS найден в app/js/models.js');
const block = modelsJs.slice(start, end);

const rendererKeys = new Set();
for (const m of block.matchAll(/(^|\n)\s*([a-zA-Z]\w*):\s*\[/g)) {
  rendererKeys.add(m[2]);
}

test('у каждого провайдера из providers.js есть список моделей в рендерере', () => {
  for (const key of Object.keys(PROVIDERS)) {
    assert.ok(
      rendererKeys.has(key),
      `провайдер "${key}" отсутствует в MODEL_OPTIONS (app/js/models.js) — UI покажет чужой список моделей`
    );
  }
});

test('списки моделей провайдеров совпадают с главным процессом', () => {
  for (const [key, cfg] of Object.entries(PROVIDERS)) {
    const expected = cfg.models || [];
    assert.ok(expected.length > 0, `провайдер "${key}" без моделей`);
    // "auto" резолвится динамически в main.js (Cohere или локальный fallback Ollama),
    // поэтому его список в рендерере намеренно короче — проверяем только ключ выше.
    if (key === 'auto') continue;
    for (const model of expected) {
      assert.ok(
        block.includes(`'${model}'`) || block.includes(`"${model}"`),
        `модель "${model}" провайдера "${key}" отсутствует в app/js/models.js`
      );
    }
  }
});

test('бесплатные модели провайдеров помечены бесплатными в рендерере', () => {
  const freeBlock = modelsJs.slice(modelsJs.indexOf('export const FREE_MODELS'));
  for (const [key, cfg] of Object.entries(PROVIDERS)) {
    for (const model of cfg.freeModels || []) {
      assert.ok(
        freeBlock.includes(`'${model}'`),
        `модель "${model}" (${key}) в freeModels, но не в FREE_MODELS рендерера — бейдж покажет PAID`
      );
    }
  }
});
