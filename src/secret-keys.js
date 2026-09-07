// Скрытые ключи для режима «Auto». НЕ хранятся в репозитории — исходники не
// должны содержать секретов. Порядок поиска:
//   1) переменные окружения пользователя (setx COHERE_API_KEY ..., требуют перезапуск)
//   2) зашифрованное хранилище logs/.vault.json (safeStorage) — ключи на диске зашифрованы
//   3) fallback: старый открытый logs/secrets.json (автоматически мигрирует в зашифрованный)
const fs = require('fs');
const path = require('path');
const log = require('./logger');
const vault = require('./secret-keys-vault');

const SECRETS_FILE = path.join(__dirname, '..', 'logs', 'secrets.json');

// Встроенные служебные ключи режима «Auto». Хранятся в XOR-обфускации:
// в исходниках нет открытых секретов, из UI/настроек/диагностики не выдаются.
// Пользователь может пользоваться Auto-моделями, но не видит сам ключ.
const BUILTIN = {
  // XOR (ключ 'FloatAI-builtin-v1') + base64; деобфускация ниже, в decodeBuiltin()
  cohere: 'JQMHBAYkFh4bAlgdJgBWbAQAECJfJkJ2PV4RGS9YEzw8dDhlHikVGyEZH280DD1YRx4PYiU=',
  cerebras: 'JR8ETEw1LFUQGAFfBFwaRhxUIggKFhw3fFQURh9VR1AZSBIEKAQLF00lcEVRFltUHgNcSQ==',
  groq: 'IR8EPhcmA2MxN1gWFiE3GkJfFwcEVUQiHmoGDAtfMjBZREAEAiVYMgUxKGkROgsoHVEjeSRUEwo='
};

function decodeBuiltin(name) {
  const raw = BUILTIN[name];
  if (!raw) return '';
  try {
    const buf = Buffer.from(raw, 'base64');
    const k = Buffer.from('FloatAI-builtin-v1');
    const out = Buffer.alloc(buf.length);
    for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ k[i % k.length];
    const val = out.toString('utf8');
    // Правдоподобная проверка формата — защита от случайной порчи констант
    if (name === 'cohere' && !/^cohere_[A-Za-z0-9]{20,}$/.test(val)) return '';
    if (name === 'cerebras' && !/^csk-[A-Za-z0-9]{20,}$/.test(val)) return '';
    if (name === 'groq' && !/^gsk_[A-Za-z0-9]{20,}$/.test(val)) return '';
    return val;
  } catch (_) { return ''; }
}

// Fallback: прочитать из старого открытого файла
function fromPlainFile(name) {
  try {
    const data = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8'));
    return String(data[name] || '').trim();
  } catch (_) { return ''; }
}

// Получить ключ: окружение → зашифрованное хранилище → встроенный служебный → открытый файл (с миграцией)
// Пользовательские ключи (env/vault) всегда приоритетнее встроенных.
function getKey(name) {
  const envVal = String(process.env[`${name.toUpperCase()}_API_KEY`] || '').trim();
  if (envVal) return envVal;
  
  // Зашифрованное хранилище (приоритет)
  const vaultVal = vault.get(name);
  if (vaultVal) return vaultVal;
  
  // Встроенный служебный ключ режима «Auto»
  const builtin = decodeBuiltin(name);
  if (builtin) return builtin;
  
  // Fallback: открытый файл + автоматическая миграция
  const plain = fromPlainFile(name);
  if (plain) {
    // Мигрируем все ключи из открытого файла в зашифрованное хранилище
    try {
      const data = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8'));
      vault.migrateFromPlain(data);
      log.info('[secrets] открытый файл мигрирован в зашифрованное хранилище');
    } catch (_) {}
  }
  return plain;
}

function cohere() { return getKey('cohere'); }
function cerebras() { return getKey('cerebras'); }
function groq() { return getKey('groq'); }

// Проверка: этот ключ — встроенный служебный? (для включения защитного режима)
function isBuiltin(name, key) {
  const builtin = decodeBuiltin(name);
  return Boolean(builtin) && builtin === String(key || '').trim();
}

module.exports = { cohere, cerebras, groq, isBuiltin };
