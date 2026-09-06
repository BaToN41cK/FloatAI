// IPC handlers для сетевых операций: проверка связи, скачивание файлов.
const { doFetch } = require('../electron-fetch');
const log = require('../logger');
const { t } = require('../i18n');

// Проверка связи: Wi-Fi есть/нет, прокси-сервер жив/мертв
async function checkConnectivity() {
  try {
    const res = await doFetch('https://www.gstatic.com/generate_204', { signal: AbortSignal.timeout(8000) });
    return res.status < 500 ? 'ok' : 'down';
  } catch (_) { return 'down'; }
}

// Скачивание бинарного файла через главный процесс (с поддержкой прокси)
async function downloadFile(url) {
  const res = await doFetch(String(url), { redirect: 'follow', signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

// OCR: текст со скриншота -> AI
async function handleOcrText(mistral, { question, text, confidence = 100 }) {
  const { friendlyError } = require('../ai-errors');
  try {
    const clean = (text || '').trim();
    if (!clean) throw new Error(t('ocr.emptyText'));
    log.info(`[ocr] текст: ${clean.length} символов, уверенность ${Math.round(confidence)}%`);

    const base = question
      ? `Вопрос пользователя: ${question}\n\n[Текст со скриншота, распознан автоматически]:\n${clean}`
      : `[Текст со скриншота, распознан автоматически]:\n${clean}`;
    const prompt = `${base}\n\nЭто машинное распознавание (OCR, уверенность ${Math.round(confidence)}%): текст может содержать ошибки, искажённые или склеенные слова.
- Если текст связный и понятен — отвечай по делу (например, реши задание из скриншота).
- Если текст выглядит как бесслислица, обрывки слов или явно искажён — НЕ придумывай ответ. Скажи, что скриншот распознался плохо, и попроси прислать скрин крупнее/чётче.
- Если для ответа не хватает контекста (обрезан текст, видно не всё) — так и скажи.`;

    let full = '';
    await mistral.chatStream(prompt, (chunk) => { full += chunk; });
    return { ok: true, reply: full, text: clean };
  } catch (err) {
    log.error('[ocr]', err.message);
    return { ok: false, error: friendlyError(err.message) };
  }
}

function register(ipcMain, getMistral) {
  ipcMain.handle('net:check', () => checkConnectivity());
  ipcMain.handle('net:download', async (_e, url) => downloadFile(url));
  ipcMain.handle('chat:ocr-text', async (_e, data) => handleOcrText(getMistral(), data));
}

module.exports = { register, checkConnectivity, downloadFile, handleOcrText };
