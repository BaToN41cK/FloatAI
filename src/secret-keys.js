// Скрытые ключи для режима «Auto». НЕ хранятся в репозитории — исходники не
// должны содержать секретов. Порядок поиска:
//   1) переменные окружения пользователя (setx COHERE_API_KEY ..., требуют перезапуск)
//   2) локальный файл logs/secrets.json — logs/ целиком в .gitignore,
//      поэтому ключи не попадают на GitHub даже случайно.
// Формат logs/secrets.json: { "cohere": "...", "cerebras": "..." }
const fs = require('fs');
const path = require('path');

const SECRETS_FILE = path.join(__dirname, '..', 'logs', 'secrets.json');

function fromFile(name) {
  try {
    const data = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8'));
    return String(data[name] || '').trim();
  } catch (_) { return ''; }
}

function cohere() {
  return String(process.env.COHERE_API_KEY || '').trim() || fromFile('cohere');
}

function cerebras() {
  return String(process.env.CEREBRAS_API_KEY || '').trim() || fromFile('cerebras');
}

function groq() {
  return String(process.env.GROQ_API_KEY || '').trim() || fromFile('groq');
}

module.exports = { cohere, cerebras, groq };
