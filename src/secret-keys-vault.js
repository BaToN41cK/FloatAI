// Зашифрованное хранилище секретов: ключи на диске шифруются через Windows safeStorage.
// Заменяет открытый logs/secrets.json на зашифрованный вариант.
const fs = require('fs');
const path = require('path');
const log = require('./logger');

let safeStorage = null;
try { safeStorage = require('electron').safeStorage; } catch (_) {}

const VAULT_FILE = path.join(__dirname, '..', 'logs', '.vault.json');

function isAvailable() {
  return !!(safeStorage && safeStorage.isEncryptionAvailable());
}

function encrypt(value) {
  if (!isAvailable()) return null;
  try { return safeStorage.encryptString(String(value)).toString('base64'); } catch (_) { return null; }
}

function decrypt(value) {
  if (!value) return '';
  if (!isAvailable()) return '';
  try { return safeStorage.decryptString(Buffer.from(value, 'base64')); } catch (_) { return ''; }
}

function load() {
  try {
    const raw = fs.readFileSync(VAULT_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const out = {};
    for (const [k, v] of Object.entries(data)) {
      const d = decrypt(v);
      if (d) out[k] = d;
    }
    return out;
  } catch (_) { return {}; }
}

function save(secrets) {
  const enc = {};
  for (const [k, v] of Object.entries(secrets)) {
    if (!v) continue;
    const e = encrypt(v);
    if (e) enc[k] = e;
  }
  try {
    fs.mkdirSync(path.dirname(VAULT_FILE), { recursive: true });
    fs.writeFileSync(VAULT_FILE, JSON.stringify(enc, null, 2));
  } catch (e) { log.warn('[vault] save failed:', e.message); }
}

// Миграция: прочитать старый открытый secrets.json, зашифровать, удалить открытый.
function migrateFromPlain(plainSecrets) {
  if (!isAvailable()) return false;
  save(plainSecrets);
  // Удаляем открытый файл после успешной миграции
  try {
    const plainFile = path.join(__dirname, '..', 'logs', 'secrets.json');
    if (fs.existsSync(plainFile)) fs.unlinkSync(plainFile);
    return true;
  } catch (_) { return false; }
}

// Получить ключ: сначала из окружения, потом из зашифрованного хранилища.
function get(name) {
  const envVal = String(process.env[`${name.toUpperCase()}_API_KEY`] || '').trim();
  if (envVal) return envVal;
  return load()[name] || '';
}

module.exports = { get, load, save, migrateFromPlain, isAvailable };
