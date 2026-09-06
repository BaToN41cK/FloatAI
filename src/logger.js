// Простой логгер в файл + консоль
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const LOG_FILE = path.join(LOG_DIR, `app-${new Date().toISOString().slice(0, 10)}.log`);

// Ротация логов: удаляем файлы app-*.log старше LOG_TTL (7 дней по умолчанию).
let LOG_TTL = 7 * 24 * 60 * 60 * 1000;
function setLogTtl(days) {
  const d = Number(days);
  if (Number.isFinite(d) && d > 0) LOG_TTL = d * 24 * 60 * 60 * 1000;
}
function rotateLogs() {
  try {
    const now = Date.now();
    for (const f of fs.readdirSync(LOG_DIR)) {
      if (!/^app-.*\.log$/.test(f)) continue;
      const p = path.join(LOG_DIR, f);
      if (now - fs.statSync(p).mtimeMs > LOG_TTL) {
        fs.unlinkSync(p);
        console.log(`[logger] удалён старый лог: ${f}`);
      }
    }
  } catch (_) { /* ignore */ }
}
rotateLogs();
setInterval(rotateLogs, 5 * 60 * 1000).unref();

function ts() { return new Date().toISOString(); }

// Расширенные паттерны для редактирования секретов в логах
const SECRET_PATTERNS = [
  // Bearer токены
  (s) => s.replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,}]+/ig, '$1[REDACTED]'),
  // x-api-key
  (s) => s.replace(/(x-api-key\s*[:=]*\s*)[^\s,}]+/ig, '$1[REDACTED]'),
  // api_key / api-key / apikey (общий паттерн)
  (s) => s.replace(/(api[_-]?key\s*[:=]*\s*)[^\s,}]+/ig, '$1[REDACTED]'),
  // Query parameters
  (s) => s.replace(/([?&](?:api_?key|key|token|secret)=)[^&\s]+/ig, '$1[REDACTED]'),
  // Явные упоминания секретов (пароль, токен, ключ)
  (s) => s.replace(/(?:парол|password|secret|token|ключ)\s*[:=]\s*\S+/ig, '[SECRET_REDACTED]'),
  // sk-... и gsk_... ключи
  (s) => s.replace(/(sk-[A-Za-z0-9_-]{20,})/g, '[SK_REDACTED]'),
  (s) => s.replace(/(gsk_[A-Za-z0-9_-]{20,})/g, '[GSK_REDACTED]'),
  // Google API keys
  (s) => s.replace(/(AIza[0-9A-Za-z_-]{30,})/g, '[GOOGLE_KEY_REDACTED]'),
];

function redact(value) {
  let result = String(value);
  for (const pattern of SECRET_PATTERNS) {
    result = pattern(result);
  }
  return result;
}

function write(level, ...args) {
  const line = `[${ts()}] [${level}] ${args.map(a =>
    typeof a === 'string' ? redact(a) : redact(JSON.stringify(a))
  ).join(' ')}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch (_) { /* ignore */ }
  try {
    if (level === 'ERROR') console.error(line.trim());
    else console.log(line.trim());
  } catch (_) { /* ignore */ }
}

module.exports = {
  info: (...a) => write('INFO', ...a),
  warn: (...a) => write('WARN', ...a),
  error: (...a) => write('ERROR', ...a),
  setLogTtl,
  LOG_FILE,
  redact // экспортируем для использования в других модулях
};
