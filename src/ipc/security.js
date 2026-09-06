// IPC handlers для безопасности: проверка на секреты, подтвержение отправки.
const { t } = require('../i18n');

// Паттерны для обнаружения секретов в тексте пользователя
const SENSITIVE_PATTERNS = [
  // API ключи: sk-..., gsk_..., AIza...
  /(sk-[A-Za-z0-9_-]{20,})/i,
  /(gsk_[A-Za-z0-9_-]{20,})/i,
  /(AIza[0-9A-Za-z_-]{30,})/i,
  // Bearer токены
  /(Bearer\s+[A-Za-z0-9._-]{20,})/i,
  // Явные упоминания секретов
  /(?:парол|password|secret|token|api[_ -]?key|ключ)\s*[:=]\s*\S+/i
];

// Общий паттерн для быстрой проверки
const SENSITIVE_TEXT = new RegExp(
  SENSITIVE_PATTERNS.map(p => p.source).join('|'),
  'i'
);

function isSensitive(text) {
  return SENSITIVE_TEXT.test(String(text || ''));
}

function redactSensitive(text) {
  let result = String(text || '');
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[СЕКРЕТ_СКРЫТ]');
  }
  return result;
}

function register(ipcMain, confirmAction) {
  // Проверка: содержит ли текст секреты
  ipcMain.handle('security:check-sensitive', (_e, text) => ({
    sensitive: isSensitive(text)
  }));

  // Подтверждение отправки текста с секретами
  ipcMain.handle('security:confirm-sensitive', async (_e, text) => {
    if (!isSensitive(text)) return true;
    return confirmAction(t('security.sensitiveTitle'), t('security.sensitiveMsg'));
  });
}

module.exports = { register, isSensitive, redactSensitive, SENSITIVE_TEXT };
