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

// Fallback: прочитать из старого открытого файла
function fromPlainFile(name) {
  try {
    const data = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8'));
    return String(data[name] || '').trim();
  } catch (_) { return ''; }
}

// Получить ключ: окружение → зашифрованное хранилище → открытый файл (с миграцией)
function getKey(name) {
  const envVal = String(process.env[`${name.toUpperCase()}_API_KEY`] || '').trim();
  if (envVal) return envVal;
  
  // Зашифрованное хранилище (приоритет)
  const vaultVal = vault.get(name);
  if (vaultVal) return vaultVal;
  
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

module.exports = { cohere, cerebras, groq };
