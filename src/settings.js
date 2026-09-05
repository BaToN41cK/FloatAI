// Настройки приложения: хранятся в userData/settings.json.
// Пользователь меняет их через UI (Ctrl+,), main-процесс применяет на лету.
const fs = require('fs');
const path = require('path');
const log = require('./logger');

let safeStorage = null;
try { safeStorage = require('electron').safeStorage; } catch (_) {}

function decryptApiKey(value) {
  if (!value) return '';
  try {
    if (safeStorage && safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(Buffer.from(value, 'base64'));
  } catch (_) {}
  return String(value);
}

function encryptApiKey(value) {
  if (!value) return '';
  try {
    if (safeStorage && safeStorage.isEncryptionAvailable()) return safeStorage.encryptString(String(value)).toString('base64');
  } catch (_) {}
  return '';
}

let SETTINGS_FILE = null;
try {
  const { app } = require('electron');
  SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
} catch (_) {
  // вне Electron (тесты) — рядом с проектом
  SETTINGS_FILE = path.join(__dirname, '..', 'logs', 'settings.json');
}

const DEFAULTS = {
  // Auto: без ключа и настройки — локальная модель ~8B (через Ollama), работает офлайн
  provider: 'auto',
  model: 'qwen2.5:7b',
  apiKey: '',
  // Голосовой ввод (Whisper через Groq) — по умолчанию выключен,
  // пользователь решает сам, включать ли распознавание речи.
  speechEnabled: true,
  voiceApiKey: '',
  proxy: '',
  autostart: true,
  blockedSites: '',
  logTtlDays: 7,
  theme: 'dark',
  debug: false
  ,opacity: 1,
  customEndpoint: '',
  fontSize: 13,
  // Глубокое размышление выключено по умолчанию: модель отвечает быстро
  // и коротко; внутренний лимит ответа задаётся клиентом.
  deepThink: false,
  language: 'ru',
  plugins: { webSearch: true, fetchPage: true }
};

let cache = null;

function load() {
  if (cache) return cache;
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')); } catch (_) {}
  // speechEnabled удалена из настроек — голос работает всегда, старое значение игнорируем
  delete saved.speechEnabled;
  // maxTokens больше не является пользовательской настройкой.
  delete saved.maxTokens;
  const savedModel = saved.model === 'mistral-medium-latest' ? 'mistral-small-latest' : saved.model;
  // Миграция выведенных из обращения моделей Cerebras (Llama убрали с публичного API)
  const cerebrasLegacy = /^(llama-3\.3-70b|llama-4-scout-17b-16e-instruct|qwen-3-32b|qwen-3-235b-a22b-instruct-2507)$/;
  const fixedModel = cerebrasLegacy.test(String(savedModel)) ? 'gpt-oss-120b' : savedModel;
  cache = {
    ...DEFAULTS, ...saved,
    model: fixedModel || DEFAULTS.model,
    plugins: { ...DEFAULTS.plugins, ...(saved.plugins || {}) },
    apiKey: decryptApiKey(saved.apiKeyEncrypted || ''),
    voiceApiKey: decryptApiKey(saved.voiceApiKeyEncrypted || '')
  };
  // Миграция старых настроек: mistral по умолчанию без ключа -> Auto (локально)
  if (!cache.apiKey && (cache.provider === 'mistral' && saved.provider === undefined)) {
    cache.provider = 'auto';
    cache.model = 'qwen2.5:7b';
  }
  return cache;
}

function save(partial) {
  const current = load();
  const next = { ...current, ...partial };
  next.apiKey = String(next.apiKey || '');
  if (Object.prototype.hasOwnProperty.call(partial, 'apiKey') && partial.apiKey && (!safeStorage || !safeStorage.isEncryptionAvailable())) {
    throw new Error('Безопасное хранилище Windows недоступно: API-ключ не сохранён');
  }
  const encryptedKey = encryptApiKey(next.apiKey);
  const diskNext = { ...next };
  if (encryptedKey) diskNext.apiKeyEncrypted = encryptedKey;
  delete diskNext.apiKey;
  // Голосовой ключ Groq шифруем так же, как основной API-ключ
  if (next.voiceApiKey) {
    try {
      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        diskNext.voiceApiKeyEncrypted = safeStorage.encryptString(String(next.voiceApiKey)).toString('base64');
      }
    } catch (_) {}
  }
  delete diskNext.voiceApiKey;
  cache = next;
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(diskNext, null, 2));
  } catch (e) { log.warn('[settings] не сохранил:', e.message); }
  return next;
}

function reload() {
  cache = null;
  return load();
}

function isEncryptionAvailable() { return !!(safeStorage && safeStorage.isEncryptionAvailable()); }

module.exports = { load, reload, save, DEFAULTS, isEncryptionAvailable };
