// Временный тест: реальный OCR через локальный tesseract в рендерере
// Запуск: npx electron scripts/test-ocr.js
const path = require('path');
const { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..'); // корень проекта (скрипт лежит в scripts\)
const vendorUrl = pathToFileURL(path.join(ROOT, 'app', 'vendor')).href + '/';
const workerPath = new URL('worker.min.js', vendorUrl).href;
const corePath = new URL('core/', vendorUrl).href;
const langPath = new URL('lang-data/', vendorUrl).href;
const { app, BrowserWindow } = require('electron');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { preload: path.join(ROOT, 'preload.js') } });
  await win.loadFile(path.join(ROOT, 'app', 'chat.html'));
  const res = await win.webContents.executeJavaScript(`
    (async () => {
      try {
        // 1x1 белый PNG: проверяем загрузку локального worker, core и языковых данных.
        const r = await Tesseract.recognize(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'rus+eng',
          { workerPath: ${JSON.stringify(workerPath)}, corePath: ${JSON.stringify(corePath)}, langPath: ${JSON.stringify(langPath)}, workerBlobURL: false, logger: () => {} }
        );
        return 'OCR OK, confidence=' + r.data.confidence;
      } catch (e) { return 'OCR FAIL: ' + (e && (e.message || JSON.stringify(e)) ); }
    })()`, true);
  console.log('RESULT:', res);
  app.exit(0);
}).catch(e => { console.error('APP ERROR:', e.message); app.exit(1); });