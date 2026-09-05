// Smoke e2e: запускает упакованное приложение через Playwright (_electron)
// и проверяет, что главное окно загрузилось. Запуск: npm run test:e2e.
// Нужна машина с рабочим дисплеем (Windows); в headless/CI может не подняться.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { _electron } = require('playwright');

test('приложение запускается и загружает главное окно', async () => {
  let app;
  try {
    app = await _electron.launch({ args: [path.join(__dirname, '..', 'main.js')] });
  } catch (e) {
    // Нет дисплея/электрона — помечаем тест как пропущенный, а не красный
    test.skip('Electron не запустился в этом окружении: ' + e.message);
    return;
  }
  try {
    const win = await app.firstWindow({ timeout: 15000 });
    await win.waitForLoadState('domcontentloaded', { timeout: 15000 });
    const title = await win.title();
    assert.equal(typeof title, 'string');
    await win.keyboard.press('Control+O');
    await win.locator('#settingsPanel').waitFor({ state: 'visible', timeout: 3000 });
    await win.locator('[data-tab="personality"]').click();
    await win.locator('#personalityEditor').waitFor({ state: 'visible', timeout: 3000 });
    assert.equal(await win.locator('#personalityEditor').count(), 1);

    await win.locator('[data-tab="general"]').click();
    await win.locator('#setLanguage').selectOption('en');
    await win.locator('#btnSaveSettings').click();
    await assert.deepEqual(await win.locator('.settings-tab').allTextContents(), ['Model', 'Personalization', 'Theme', 'Diagnostics', 'Other']);

    await win.locator('#setLanguage').selectOption('ru');
    await win.locator('#btnSaveSettings').click();
    await assert.deepEqual(await win.locator('.settings-tab').allTextContents(), ['Модель', 'Персонализация', 'Тема', 'Диагностика', 'Прочее']);
  } finally {
    if (app) await app.close();
  }
});