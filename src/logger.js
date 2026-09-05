// Простой логгер в файл + консоль
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const LOG_FILE = path.join(LOG_DIR, `app-${new Date().toISOString().slice(0, 10)}.log`);

// Ротация логов: удаляем файлы app-*.log старше LOG_TTL (7 дней по умолчанию).
// history.json и прочие данные не трогаем — только логи.
// TTL можно менять на лету из настроек UI (setLogTtl).
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

function write(level, ...args) {
  const line = `[${ts()}] [${level}] ${args.map(a =>
    typeof a === 'string' ? redact(a) : JSON.stringify(a)
  ).join(' ')}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch (_) { /* ignore */ }
  // console может оказаться «мёртвой трубой» (EPIPE) — не даём ей уронить приложение
  try {
    if (level === 'ERROR') console.error(line.trim());
    else console.log(line.trim());
  } catch (_) { /* ignore */ }
}

function redact(value) {
  return String(value)
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,}]+/ig, '$1[REDACTED]')
    .replace(/(x-api-key\s*[:=]\s*)[^\s,}]+/ig, '$1[REDACTED]')
    .replace(/(api[_-]?key\s*[:=]\s*)[^\s,}]+/ig, '$1[REDACTED]')
    .replace(/([?&](?:api_?key|key)=)[^&\s]+/ig, '$1[REDACTED]');
}

module.exports = {
  info: (...a) => write('INFO', ...a),
  warn: (...a) => write('WARN', ...a),
  error: (...a) => write('ERROR', ...a),
  setLogTtl,
  LOG_FILE
};
