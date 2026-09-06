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
  // Auto: работает из коробки — облачная модель через служебный ключ (вне репозитория);
  // без служебного ключа — локальная модель ~8B (Ollama), офлайн
  provider: 'auto',
  model: 'command-a-03-2025',
  apiKey: '',
  // Голосовой ввод (Whisper через Groq) — по умолчанию выключен,
  // пользователь решает сам, включать ли распознавание речи.
  speechEnabled: true,
  voiceApiKey: '',
  searchMode: 'ddg',
  searchApiKey: '',
  // Ключи по провайдерам: вставил один раз — при переключении провайдера
  // подставляется сам (на диск пишутся зашифрованными через safeStorage)
  providerKeys: {},
  // Последняя выбранная модель для каждого провайдера (как в Cline)
  providerModels: {},
  // Голосовой ввод по умолчанию выключен: включается галочкой в «Прочее»
  voiceEnabled: false,
  proxy: '',
  autostart: true,
  blockedSites: '',
  logTtlDays: 7,
  theme: 'dark',
  debug: false
  ,opacity: 1,
  customEndpoint: '',
  fontSize: 13,
  // Reasoning Effort (Глубокое мышление):
  // "low" = выключено (быстрые ответы), "high-high" = включено (глубокое мышление)
  // Как в Cline: при вкл галочке = "High-High", при выкл = "Low"
  reasoningEffort: 'low',
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
  // Расшифровываем карту ключей по провайдерам (на диске — зашифрованные)
  const providerKeys = {};
  for (const [k, v] of Object.entries(saved.providerKeys || {})) providerKeys[k] = decryptApiKey(v);

  // Миграция: deepThink (boolean) → reasoningEffort (string)
  // deepThink: true → "high-high", deepThink: false → "low"
  let reasoningEffort = saved.reasoningEffort;
  if (!reasoningEffort && 'deepThink' in saved) {
    reasoningEffort = saved.deepThink ? 'high-high' : 'low';
  }

  // Восстанавливаем последнюю модель для текущего провайдера (как в Cline)
  const providerModels = { ...(saved.providerModels || {}) };
  const currentProviderModel = providerModels[saved.provider];
  const activeModel = currentProviderModel || fixedModel || DEFAULTS.model;

  cache = {
    ...DEFAULTS, ...saved,
    model: activeModel,
    plugins: { ...DEFAULTS.plugins, ...(saved.plugins || {}) },
    providerKeys: { ...DEFAULTS.providerKeys, ...providerKeys },
    providerModels: providerModels,
    reasoningEffort: reasoningEffort || DEFAULTS.reasoningEffort,
    apiKey: decryptApiKey(saved.apiKeyEncrypted || ''),
    voiceApiKey: decryptApiKey(saved.voiceApiKeyEncrypted || '') || require('./secret-keys').groq(),
    searchMode: saved.searchMode || 'ddg',
    searchApiKey: decryptApiKey(saved.searchApiKeyEncrypted || '')
  };
  // Удаляем устаревшее поле из кэша
  delete cache.deepThink;
  // Миграция старых настроек: mistral по умолчанию без ключа -> Auto
  if (!cache.apiKey && (cache.provider === 'mistral' && saved.provider === undefined)) {
    cache.provider = 'auto';
    cache.model = 'command-a-03-2025';
  }
  // Миграция Auto: у Auto больше нет выбора моделей — всегда Cohere command-a-03-2025
  if (cache.provider === 'auto' && /^(qwen2\.5:|llama3\.[12]:|deepseek-r1:)/.test(String(cache.model))) {
    cache.model = 'command-a-03-2025';
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

  // Ключи по провайдерам: сохраняем в поле текущего провайдера и шифруем каждый
  next.providerKeys = { ...(current.providerKeys || {}), ...(partial.providerKeys || {}) };
  if (partial.provider && Object.prototype.hasOwnProperty.call(partial, 'apiKey')) {
    next.providerKeys[partial.provider] = String(partial.apiKey || '');
  }
  // Также сохраняем ключ из общего поля apiKey для текущего провайдера
  if (partial.provider && partial.apiKey) {
    next.providerKeys[partial.provider] = String(partial.apiKey);
  }
  const encProviderKeys = {};
  for (const [k, v] of Object.entries(next.providerKeys)) {
    if (!v) continue;
    encProviderKeys[k] = encryptApiKey(v) || String(v); // без safeStorage (dev) — как есть
  }
  diskNext.providerKeys = encProviderKeys;

  // Сохраняем последнюю выбранную модель для каждого провайдера (как в Cline)
  next.providerModels = { ...(current.providerModels || {}), ...(partial.providerModels || {}) };
  if (partial.provider && partial.model) {
    next.providerModels[partial.provider] = partial.model;
  }
  diskNext.providerModels = next.providerModels;
  // Голосовой ключ Groq и ключ Brave Search API шифруем так же, как основной API-ключ
  for (const plainKey of ['voiceApiKey', 'searchApiKey']) {
    if (next[plainKey]) {
      try {
        if (safeStorage && safeStorage.isEncryptionAvailable()) {
          diskNext[plainKey + 'Encrypted'] = safeStorage.encryptString(String(next[plainKey])).toString('base64');
        }
      } catch (_) {}
    }
    delete diskNext[plainKey];
  }
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
