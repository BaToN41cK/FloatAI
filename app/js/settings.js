// Панель настроек (Ctrl+O), сессии (диалоги) и диагностика.
import { $, applyTheme, applyFontSize } from './ui.js';
import { updateModelOptions, MODEL_OPTIONS, FREE_MODELS, detectProvider } from './models.js';
import { applyLang, t } from './i18n.js';
import { store } from './store.js';

const MAX_PERSONALITY_CHARS = 5000;
let _lastSettings = null;

const PROVIDER_INFO = {
  auto: { title: 'Auto', desc: 'Работает из коробки без API-ключа', badges: [{ type: 'recommended', text: 'Recommended' }, { type: 'free', text: 'Free' }], needsKey: false },
  openrouter: { title: 'OpenRouter', desc: 'Единый доступ к 200+ моделям от разных провайдеров', badges: [], needsKey: true, signupUrl: 'https://openrouter.ai/keys' },
  unorouter: { title: 'UnoRouter', desc: 'Единый OpenAI-совместимый шлюз: один ключ — модели разных провайдеров, есть бесплатные', badges: [{ type: 'free', text: 'Free Models' }], needsKey: true, signupUrl: 'https://unorouter.com/token' },
  openai: { title: 'OpenAI', desc: 'GPT-4.1, GPT-4o, o3 — мощные модели для кодинга', badges: [{ type: 'paid', text: 'Paid' }], needsKey: true, signupUrl: 'https://platform.openai.com/api-keys' },
  anthropic: { title: 'Anthropic', desc: 'Claude 4 — продвинутое рассуждение и безопасность', badges: [{ type: 'paid', text: 'Paid' }], needsKey: true, signupUrl: 'https://console.anthropic.com/settings/keys' },
  google: { title: 'Google', desc: 'Gemini 2.5 — мультимодальные модели от Google', badges: [], needsKey: true, signupUrl: 'https://aistudio.google.com/apikey' },
  mistral: { title: 'Mistral', desc: 'Mistral Large, Codestral — быстрые европейские модели', badges: [], needsKey: true, signupUrl: 'https://console.mistral.ai/api-keys/' },
  zai: { title: 'Z.ai', desc: 'GLM-5 — новейшая мультимодальная модель с бесплатным тарифом', badges: [{ type: 'free', text: 'Free Models' }], needsKey: true, signupUrl: 'https://api.z.ai' },
  cohere: { title: 'Cohere', desc: 'Command A — модель с контекстом 128K, бесплатный тариф', badges: [{ type: 'free', text: 'Free' }], needsKey: true, signupUrl: 'https://dashboard.cohere.com/api-keys' },
  cerebras: { title: 'Cerebras', desc: 'Сверхбыстрый вывод. Бесплатный API-тариф', badges: [{ type: 'free', text: 'Free' }], needsKey: true, signupUrl: 'https://cloud.cerebras.ai/api-keys' },
  gigachat: { title: 'GigaChat', desc: 'Модели Сбера для русскоязычных задач', badges: [], needsKey: true, signupUrl: 'https://developers.sber.ru/' },
  yandex: { title: 'YandexGPT / Алиса', desc: 'YandexGPT 5 — модели Яндекса для русского языка', badges: [], needsKey: true, signupUrl: 'https://yandex.cloud/ru/services/yandexgpt' },
  ollama: { title: 'Ollama (локально)', desc: 'Запускает модели локально на вашем компьютере', badges: [{ type: 'local', text: 'Local' }, { type: 'free', text: 'Free' }], needsKey: false },
  lmstudio: { title: 'LM Studio (локально)', desc: 'Локальный сервер моделей через LM Studio', badges: [{ type: 'local', text: 'Local' }, { type: 'free', text: 'Free' }], needsKey: false },
  custom: { title: 'Свой OpenAI-совместимый', desc: 'Подключите любой OpenAI-совместимый API', badges: [], needsKey: true },
};

const MODEL_INFO = {
  // Auto / Cohere
  'command-a-03-2025': { desc: 'Быстрая модель Cohere с большим контекстом.', context: '128K', input: 'Free', output: 'Free' },
  'command-r-plus-08-2024': { desc: 'Мощная модель Cohere для RAG.', context: '128K', input: 'Free', output: 'Free' },
  'command-r-08-2024': { desc: 'Базовая модель Cohere.', context: '128K', input: 'Free', output: 'Free' },
  'command-r7b-12-2024': { desc: 'Компактная Cohere.', context: '128K', input: 'Free', output: 'Free' },
  'command-r-03-2024': { desc: 'Старая версия Command R.', context: '128K', input: 'Free', output: 'Free' },
  // Z.ai
  'GLM-5.3-Flash': { desc: 'Новейшая мультимодальная GLM-5.', context: '128K', input: 'Free', output: 'Free' },
  'GLM-5.3': { desc: 'Полная GLM-5 для рассуждений.', context: '128K', input: 'Paid', output: 'Paid' },
  'GLM-5.2': { desc: 'GLM-5.2 улучшенная.', context: '128K', input: 'Paid', output: 'Paid' },
  'GLM-5.1': { desc: 'GLM-5.1.', context: '128K', input: 'Paid', output: 'Paid' },
  'GLM-5': { desc: 'GLM-5 базовая.', context: '128K', input: 'Paid', output: 'Paid' },
  'GLM-4.7': { desc: 'GLM-4.7.', context: '128K', input: 'Paid', output: 'Paid' },
  'GLM-4.7-FlashX': { desc: 'Сверхбыстрая FlashX.', context: '128K', input: 'Paid', output: 'Paid' },
  'GLM-4.7-Flash': { desc: 'Бесплатная Z.ai.', context: '128K', input: 'Free', output: 'Free' },
  'GLM-4.5-Flash': { desc: 'Бесплатная Z.ai.', context: '128K', input: 'Free', output: 'Free' },
  'GLM-4.6V-Flash': { desc: 'Мультимодальная.', context: '128K', input: 'Free', output: 'Free' },
  // OpenAI
  'gpt-4.1': { desc: 'Самая мощная OpenAI.', context: '1M', input: 'Paid', output: 'Paid' },
  'gpt-4.1-mini': { desc: 'Гибкая GPT-4.1.', context: '1M', input: 'Paid', output: 'Paid' },
  'gpt-4.1-nano': { desc: 'Быстрая GPT-4.1.', context: '1M', input: 'Paid', output: 'Paid' },
  'gpt-4o': { desc: 'Баланс скорости.', context: '128K', input: 'Paid', output: 'Paid' },
  'gpt-4o-mini': { desc: 'Компактная GPT-4o.', context: '128K', input: 'Paid', output: 'Paid' },
  'o3': { desc: 'Для рассуждений.', context: '200K', input: 'Paid', output: 'Paid' },
  'o3-mini': { desc: 'Компактная o3.', context: '200K', input: 'Paid', output: 'Paid' },
  'o4-mini': { desc: 'Новая компактная.', context: '200K', input: 'Paid', output: 'Paid' },
  // Anthropic
  'claude-opus-4-1': { desc: 'Самая мощная Anthropic.', context: '200K', input: 'Paid', output: 'Paid' },
  'claude-sonnet-4-20250514': { desc: 'Быстрая Anthropic.', context: '200K', input: 'Paid', output: 'Paid' },
  'claude-3-7-sonnet-latest': { desc: 'Claude 3.7.', context: '200K', input: 'Paid', output: 'Paid' },
  'claude-3-5-sonnet-latest': { desc: 'Claude 3.5.', context: '200K', input: 'Paid', output: 'Paid' },
  'claude-3-5-haiku-latest': { desc: 'Быстрая Claude.', context: '200K', input: 'Paid', output: 'Paid' },
  // Google
  'gemini-2.5-pro': { desc: 'Мощная Google.', context: '1M', input: 'Paid', output: 'Paid' },
  'gemini-2.5-flash': { desc: 'Быстрая Google.', context: '1M', input: 'Paid', output: 'Paid' },
  'gemini-2.5-flash-lite': { desc: 'Лёгкая Gemini.', context: '1M', input: 'Paid', output: 'Paid' },
  'gemini-2.0-flash': { desc: 'Gemini 2.0.', context: '1M', input: 'Paid', output: 'Paid' },
  'gemini-2.0-flash-lite': { desc: 'Лёгкая Gemini 2.0.', context: '1M', input: 'Paid', output: 'Paid' },
  // Mistral
  'mistral-large-latest': { desc: 'Мощная Mistral.', context: '128K', input: 'Paid', output: 'Paid' },
  'mistral-medium-latest': { desc: 'Баланс Mistral.', context: '32K', input: 'Paid', output: 'Paid' },
  'mistral-small-latest': { desc: 'Быстрая Mistral.', context: '32K', input: 'Free', output: 'Free' },
  'ministral-3b-latest': { desc: '3B компактная.', context: '32K', input: 'Free', output: 'Free' },
  'ministral-8b-latest': { desc: '8B компактная.', context: '32K', input: 'Free', output: 'Free' },
  'codestral-latest': { desc: 'Для кодинга.', context: '32K', input: 'Paid', output: 'Paid' },
  'devstral-small-latest': { desc: 'Для разработки.', context: '32K', input: 'Paid', output: 'Paid' },
  'open-mistral-nemo': { desc: 'Открытая Nemo.', context: '128K', input: 'Free', output: 'Free' },
  // OpenRouter
  'poolside/laguna-s-2.1:free': { desc: 'Poolside для кода.', context: '32K', input: 'Free', output: 'Free' },
  'nvidia/nemotron-3.5-lightning:free': { desc: 'NVIDIA быстрая.', context: '128K', input: 'Free', output: 'Free' },
  'inclusionai/ling-3.0-flash-fin:free': { desc: 'Финансы.', context: '32K', input: 'Free', output: 'Free' },
  'minimax/minimax-m3:free': { desc: 'MiniMax M3.', context: '32K', input: 'Free', output: 'Free' },
  'google/gemma-4-31b-it:free': { desc: 'Gemma 4 31B.', context: '128K', input: 'Free', output: 'Free' },
  'openai/gpt-6-astra:batch': { desc: 'GPT-6 batch.', context: '128K', input: 'Paid', output: 'Paid' },
  'openai/gpt-6-astra': { desc: 'GPT-6 Astra.', context: '128K', input: 'Paid', output: 'Paid' },
  'qwen/qwen3.8-max-0902': { desc: 'Qwen 3.8 Max.', context: '128K', input: 'Paid', output: 'Paid' },
  'google/gemini-3.8-flash': { desc: 'Gemini 3.8.', context: '128K', input: 'Paid', output: 'Paid' },
  'anthropic/claude-fable-5.1': { desc: 'Claude Fable.', context: '200K', input: 'Paid', output: 'Paid' },
  'qwen/qwen3.8-flash': { desc: 'Qwen 3.8 Flash.', context: '128K', input: 'Paid', output: 'Paid' },
  // UnoRouter
  'glm-5.3-flash-think-search:free': { desc: 'GLM-5.3 Flash с поиском и рассуждением.', context: '128K', input: 'Free', output: 'Free' },
  'lfm-2.5-2.6b:free': { desc: 'Компактная Liquid AI 2.6B.', context: '32K', input: 'Free', output: 'Free' },
  'muse-glimmer-30b:free': { desc: 'Muse Glimmer 30B.', context: '128K', input: 'Free', output: 'Free' },
  'glm-5.2-think-search:free': { desc: 'GLM-5.2 с поиском и рассуждением.', context: '128K', input: 'Free', output: 'Free' },
  'claude-fable-5.1': { desc: 'Claude Fable 5.1.', context: '200K', input: 'Paid', output: 'Paid' },
  'gpt-6-astra': { desc: 'GPT-6 Astra.', context: '128K', input: 'Paid', output: 'Paid' },
  'deepseek-v4-pro-0813': { desc: 'DeepSeek V4 Pro.', context: '128K', input: 'Paid', output: 'Paid' },
  'deepseek-v4-flash-0731': { desc: 'Быстрая DeepSeek V4 Flash.', context: '128K', input: 'Paid', output: 'Paid' },
  'gpt-5.6-luna': { desc: 'GPT-5.6 Luna.', context: '128K', input: 'Paid', output: 'Paid' },
  'claude-sonnet-4.6': { desc: 'Claude Sonnet 4.6.', context: '200K', input: 'Paid', output: 'Paid' },
  'claude-opus-4-6-thinking': { desc: 'Claude Opus 4.6 с рассуждением.', context: '200K', input: 'Paid', output: 'Paid' },
  // Local
  'llama3.2': { desc: 'Llama 3.2.', context: '128K', input: 'Free', output: 'Free' },
  'llama3.1': { desc: 'Llama 3.1.', context: '128K', input: 'Free', output: 'Free' },
  'qwen2.5': { desc: 'Qwen 2.5.', context: '32K', input: 'Free', output: 'Free' },
  'deepseek-r1': { desc: 'DeepSeek R1.', context: '128K', input: 'Free', output: 'Free' },
  'mistral': { desc: 'Mistral 7B.', context: '32K', input: 'Free', output: 'Free' },
  'phi4': { desc: 'Phi-4.', context: '16K', input: 'Free', output: 'Free' },
  'gemma-3': { desc: 'Gemma 3.', context: '32K', input: 'Free', output: 'Free' },
  'llama-3.2': { desc: 'Llama 3.2 (LM).', context: '128K', input: 'Free', output: 'Free' },
  'mistral-small': { desc: 'Mistral Small.', context: '32K', input: 'Free', output: 'Free' },
  'qwen2.5-72b-instruct': { desc: 'Qwen 72B.', context: '32K', input: 'Free', output: 'Free' },
  'llama-3.3-70b': { desc: 'Llama 70B.', context: '128K', input: 'Free', output: 'Free' },
  'deepseek-chat': { desc: 'DeepSeek Chat.', context: '128K', input: 'Free', output: 'Free' },
  'command-r-plus': { desc: 'Command R+.', context: '128K', input: 'Free', output: 'Free' },
  'mixtral-8x7b': { desc: 'Mixtral 8x7B.', context: '32K', input: 'Free', output: 'Free' },
  'custom-model': { desc: 'Своя модель.', context: '—', input: '—', output: '—' },
  'local-model': { desc: 'Локальная.', context: '—', input: 'Free', output: 'Free' },
  // Cerebras
  'gpt-oss-120b': { desc: 'GPT OSS 120B.', context: '128K', input: 'Free', output: 'Free' },
  'qwen-3.8-27b': { desc: 'Qwen 27B.', context: '128K', input: 'Free', output: 'Free' },
  // GigaChat
  'GigaChat-2-Max': { desc: 'GigaChat Max.', context: '32K', input: 'Paid', output: 'Paid' },
  'GigaChat-2-Pro': { desc: 'GigaChat Pro.', context: '32K', input: 'Paid', output: 'Paid' },
  'GigaChat-2': { desc: 'GigaChat 2.', context: '32K', input: 'Paid', output: 'Paid' },
  'GigaChat-Pro': { desc: 'GigaChat Pro.', context: '32K', input: 'Paid', output: 'Paid' },
  'GigaChat': { desc: 'GigaChat.', context: '32K', input: 'Free', output: 'Free' },
  'GigaChat-Lite': { desc: 'GigaChat Lite.', context: '32K', input: 'Free', output: 'Free' },
  // Yandex
  'yandexgpt-5-pro': { desc: 'YandexGPT 5 Pro.', context: '32K', input: 'Paid', output: 'Paid' },
  'yandexgpt-5-lite': { desc: 'YandexGPT 5 Lite.', context: '32K', input: 'Paid', output: 'Paid' },
  'yandexgpt-4-pro': { desc: 'YandexGPT 4 Pro.', context: '32K', input: 'Paid', output: 'Paid' },
  'yandexgpt': { desc: 'YandexGPT.', context: '32K', input: 'Paid', output: 'Paid' },
  'yandexgpt-lite': { desc: 'YandexGPT Lite.', context: '32K', input: 'Free', output: 'Free' },
};;

function getModelInfo(modelName) {
  if (MODEL_INFO[modelName]) return MODEL_INFO[modelName];
  if (FREE_MODELS.has(modelName) || modelName.endsWith(':free')) {
    return { desc: 'Модель с бесплатным доступом', context: '32K', input: 'Free', output: 'Free' };
  }
  return { desc: 'Выбранная модель', context: '—', input: '—', output: '—' };
}

// Модели, у которых реально есть параметр Reasoning Effort (уровень рассуждений).
const REASONING_MODELS = new Set([
  // OpenAI o-серия
  'o3', 'o3-mini', 'o4-mini',
  // Anthropic (extended thinking)
  'claude-opus-4-1', 'claude-sonnet-4-20250514', 'claude-3-7-sonnet-latest', 'anthropic/claude-fable-5.1',
  // Z.ai GLM (thinking-режим)
  'GLM-5.3', 'GLM-5.3-Flash', 'GLM-5.2', 'GLM-5.1', 'GLM-5',
  'GLM-4.7', 'GLM-4.7-FlashX', 'GLM-4.7-Flash', 'GLM-4.5-Flash',
  // Google
  'gemini-2.5-pro',
  // OpenRouter
  'qwen/qwen3.8-max-0902', 'qwen/qwen3.8-flash', 'google/gemini-3.8-flash',
  // UnoRouter (thinking/search-режимы)
  'glm-5.3-flash-think-search:free', 'glm-5.2-think-search:free', 'claude-opus-4-6-thinking',
  // Cerebras
  'gpt-oss-120b', 'qwen-3.8-27b',
  // Локальные
  'deepseek-r1',
]);

// Определяет, поддерживает ли модель Reasoning Effort: точное совпадение
// плюс эвристики по имени (для кастомных эндпоинтов и новых моделей).
function modelSupportsReasoning(modelName) {
  if (!modelName) return false;
  if (REASONING_MODELS.has(modelName)) return true;
  const n = modelName.toLowerCase();
  return n.includes('deepseek-r1') || n.includes('gpt-oss') || n.includes('thinking') ||
    n.includes('glm-5') || n.includes('glm-4.7') || n.includes('glm-4.5') ||
    n.includes('qwen3') || /(^|\/)o[34](-|$)/.test(n) || n.endsWith(':free') && /r1|glm/.test(n);
}

export function initSettings() {
  let _loadMessages = null; // main.js подключит загрузку истории (избегаем циклического импорта)

  // Точка подключения загрузки сообщений (вызывается main.js после init)
  function setLoader(fn) { _loadMessages = fn; }
  function loadMessages() { if (typeof _loadMessages === 'function') _loadMessages(); }

  // --- Обновить карточку провайдера (Cline-style) ---
  function updateProviderCard(provider) {
    const info = PROVIDER_INFO[provider] || PROVIDER_INFO.auto;
    $('providerTitle').textContent = info.title;
    $('providerDesc').textContent = info.desc;

    const badgesEl = $('providerBadges');
    badgesEl.innerHTML = '';
    for (const badge of info.badges) {
      const span = document.createElement('span');
      span.className = `badge badge-${badge.type}`;
      span.textContent = badge.text;
      badgesEl.appendChild(span);
    }

    const apiKeyLabel = $('apiKeyLabel');
    const apiKeyInput = $('setApiKey');
    const apiKeyHint = $('apiKeyHint');

    if (info.needsKey) {
      if (apiKeyLabel) apiKeyLabel.style.display = '';
      if (apiKeyInput) apiKeyInput.style.display = '';
      if (apiKeyHint) apiKeyHint.style.display = '';
    } else {
      if (apiKeyLabel) apiKeyLabel.style.display = 'none';
      if (apiKeyInput) apiKeyInput.style.display = 'none';
      if (apiKeyHint) apiKeyHint.style.display = 'none';
    }
    updateOllamaVisibility();
  }

  // --- Обновить карточку модели (Cline-style) ---
  function updateModelCard(modelName) {
    const info = getModelInfo(modelName);
    $('modelTitle').textContent = modelName;
    $('modelDesc').textContent = info.desc;
    $('modelContext').textContent = info.context;
    $('modelInputPrice').textContent = info.input;
    $('modelOutputPrice').textContent = info.output;

    const badgesEl = $('modelBadges');
    badgesEl.innerHTML = '';
    const isFree = FREE_MODELS.has(modelName) || modelName.endsWith(':free');
    const provider = $('setProvider').value;
    const models = MODEL_OPTIONS[provider] || [];
    if (models[0] === modelName) {
      const recSpan = document.createElement('span');
      recSpan.className = 'badge badge-recommended';
      recSpan.textContent = 'Recommended';
      badgesEl.appendChild(recSpan);
    }
    const span = document.createElement('span');
    span.className = `badge ${isFree ? 'badge-free' : 'badge-paid'}`;
    span.textContent = isFree ? 'FREE' : 'PAID';
    badgesEl.appendChild(span);

    // Reasoning Effort показываем только у моделей с реальной поддержкой
    const rSec = $('reasoningSection');
    if (rSec) rSec.style.display = modelSupportsReasoning(modelName) ? '' : 'none';
  }

  // --- Reasoning Effort ---
  function updateReasoningEffortUI(value) {
    const labels = ['Low', 'Medium', 'High'];
    const el = $('reasoningEffortValue');
    if (el) el.textContent = labels[value] || 'Low';
  }

  // --- Менеджер локальных моделей Ollama (виден только для провайдера Ollama) ---
  function formatSize(bytes) {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? gb.toFixed(1) + ' ГБ' : Math.max(1, Math.round(bytes / (1024 * 1024))) + ' МБ';
  }

  async function refreshOllama() {
    const list = $('ollamaList');
    if (!list) return;
    const r = await window.api.getOllamaModels();
    list.innerHTML = '';
    if (!r.ok) {
      list.textContent = r.error || 'Ollama не запущена';
      return;
    }
    if (!r.models.length) {
      list.textContent = 'Модели не скачаны — впиши имя ниже и нажми «Скачать».';
      return;
    }
    for (const m of r.models) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:2px 0';
      const name = document.createElement('span');
      name.textContent = `${m.name} (${formatSize(m.size)})`;
      name.style.flex = '1';
      const del = document.createElement('span');
      del.textContent = '✕';
      del.title = 'Удалить модель';
      del.style.cssText = 'cursor:pointer; opacity:0.6';
      del.addEventListener('click', async () => {
        if (!window.confirm(`Удалить модель ${m.name} с диска?`)) return;
        window.api.deleteOllamaModel(m.name);
      });
      row.appendChild(name);
      row.appendChild(del);
      list.appendChild(row);
      // добавляем скачанные модели в выпадающий список выбора модели
      const select = $('setModel');
      if (![...select.options].some(o => o.value === m.name)) {
        const opt = document.createElement('option');
        opt.value = m.name;
        opt.textContent = m.name;
        select.appendChild(opt);
      }
    }
  }

  let ollamaPullBusy = false;
  window.api.onOllamaEvent((e) => {
    if (!e) return;
    const status = $('ollamaStatus');
    if (e.error) {
      status.textContent = '🔴 ' + e.error;
      ollamaPullBusy = false;
      $('btnOllamaPull').disabled = false;
      return;
    }
    if (e.total && e.completed) {
      const pct = Math.min(100, Math.round(e.completed / e.total * 100));
      status.textContent = `⏳ ${e.model}: ${pct}% (${formatSize(e.completed)} из ${formatSize(e.total)})`;
    } else if (e.status) {
      status.textContent = `⏳ ${e.model}: ${e.status}`;
    }
    if (e.done) {
      ollamaPullBusy = false;
      $('btnOllamaPull').disabled = false;
      if (e.deleted) status.textContent = `🗑 ${e.model} удалена`;
      else if (!e.total) status.textContent = `✅ ${e.model} готова`;
      refreshOllama();
    }
  });

  function updateOllamaVisibility() {
    const section = $('ollamaSection');
    if (!section) return;
    const isOllama = $('setProvider').value === 'ollama';
    section.style.display = isOllama ? '' : 'none';
    if (isOllama) refreshOllama();
  }

  $('btnOllamaPull').addEventListener('click', () => {
    if (ollamaPullBusy) return;
    const name = $('ollamaModel').value.trim();
    if (!name) { $('ollamaStatus').textContent = 'Впиши имя модели, например qwen2.5:7b'; return; }
    ollamaPullBusy = true;
    $('btnOllamaPull').disabled = true;
    $('ollamaStatus').textContent = `⏳ скачиваю ${name}…`;
    window.api.pullOllamaModel(name);
  });

  // --- Счётчик символов в личности агента ---
  function updatePersonalityCounter() {
    const editor = $('personalityEditor');
    const counter = $('personalityCounter');
    if (!editor || !counter) return;
    const len = editor.value.length;
    const pct = (len / MAX_PERSONALITY_CHARS * 100).toFixed(1);
    counter.textContent = `${len.toLocaleString('ru')} / ${MAX_PERSONALITY_CHARS.toLocaleString('ru')} (${pct}%)`;
    counter.style.color = len > MAX_PERSONALITY_CHARS * 0.9 ? '#e5484d'
      : len > MAX_PERSONALITY_CHARS * 0.75 ? 'var(--accent)'
      : 'var(--muted)';
  }
  $('personalityEditor').addEventListener('input', updatePersonalityCounter);

  // --- Сессии (диалоги) ---
  function renderSessions(sessions) {
    const list = $('sessionsList');
    list.innerHTML = '';
    for (const s of sessions) {
      const item = document.createElement('div');
      item.className = 'session-item' + (s.active ? ' active' : '');
      const title = document.createElement('span');
      title.className = 'title';
      title.textContent = s.title + (s.count ? ` (${s.count})` : '');
      title.title = s.title;
      const del = document.createElement('span');
      del.className = 'del';
      del.textContent = '✕';
      del.title = 'Удалить диалог';
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.api.deleteSession(s.id);
        await refreshSessions();
        loadMessages();
      });
      item.appendChild(title);
      item.appendChild(del);
      item.addEventListener('click', async () => {
        await window.api.switchSession(s.id);
        await refreshSessions();
        loadMessages();
        $('sessionsPanel').classList.remove('open');
      });
      list.appendChild(item);
    }
  }

  async function refreshSessions() {
    const sessions = await window.api.getSessions();
    renderSessions(sessions);
  }

  $('btnSessions').addEventListener('click', async () => {
    $('infoPanel').classList.remove('open');
    $('settingsPanel').classList.remove('open');
    $('sessionsPanel').classList.toggle('open');
    if ($('sessionsPanel').classList.contains('open')) await refreshSessions();
  });
  $('sessionsClose').addEventListener('click', () => $('sessionsPanel').classList.remove('open'));
  $('btnNewSession').addEventListener('click', async () => {
    await window.api.newSession();
    await refreshSessions();
    loadMessages();
  });
  $('btnClear').addEventListener('click', async () => {
    await window.api.clearChat();
    store.state.greeted = false;
    loadMessages();
  });
  $('btnInfo').addEventListener('click', () => $('infoPanel').classList.toggle('open'));
  $('infoClose').addEventListener('click', () => $('infoPanel').classList.remove('open'));

  // --- Настройки (Ctrl+,) ---
  async function openSettings() {
    $('infoPanel').classList.remove('open');
    $('sessionsPanel').classList.remove('open');
    $('settingsPanel').classList.add('open');
    $('settingsStatus').textContent = '';
    const s = await window.api.getSettings();
    $('personalityEditor').value = await window.api.getPersonality();
    $('personalityStatus').textContent = '';
    updatePersonalityCounter();
    $('setProvider').value = s.provider || 'auto';
    updateModelOptions($('setProvider').value, s.model);
    updateProviderCard($('setProvider').value);
    // Карточка модели всегда отражает текущую выбранную модель
    updateModelCard($('setModel').value);
    restoreReasoningEffort(s.reasoningEffort);
    // Ключ подставляется per-провайдер: каждый провайдер помнит свой ключ
    _lastSettings = s;
    $('setApiKey').value = (s.providerKeys && s.providerKeys[$('setProvider').value]) || s.apiKey || '';
    $('setCustomEndpoint').value = s.customEndpoint || '';
    $('setProxy').value = s.proxy || '';
    $('setProxyMode').value = ['off', 'builtin', 'custom'].includes(s.proxyMode) ? s.proxyMode : 'builtin';
    updateProxyModeUI();
    $('setBlocked').value = s.blockedSites || '';
    $('setAutostart').checked = s.autostart !== false;
    $('setTheme').value = s.theme || 'dark';
    applyTheme($('setTheme').value); // вернуть применённую тему, если превью переключали без сохранения
    syncThemeUI();
    $('setDebug').checked = !!s.debug;
    $('setOpacity').value = Math.round((s.opacity ?? 1) * 100);
    $('setFontSize').value = s.fontSize || 13;
    $('opacityValue').textContent = $('setOpacity').value + '%';
    $('fontSizeValue').textContent = $('setFontSize').value + 'px';

    $('setLanguage').value = s.language || 'ru';
    $('setWebSearch').checked = s.plugins?.webSearch !== false;
    $('setFetchPage').checked = s.plugins?.fetchPage !== false;
    applyFontSize(s.fontSize || 13);
    applyLang(s.language || 'ru'); // перевести панель настроек на выбранный язык
  }
  $('btnSettings').addEventListener('click', openSettings);
  $('settingsClose').addEventListener('click', () => $('settingsPanel').classList.remove('open'));

  // Model change handler
  $('setModel').addEventListener('change', () => {
    updateModelCard($('setModel').value);
  });

  // --- Режим прокси: подсказка + поле «Свой прокси» только для режима custom ---
  function updateProxyModeUI() {
    const mode = $('setProxyMode').value;
    $('proxyFieldLabel').style.display = mode === 'custom' ? '' : 'none';
    const hint = $('proxyModeHint');
    if (hint) {
      hint.textContent = {
        builtin: 'Работает сразу: приложение само поднимает локальный прокси и автоматически переключается между серверами, если один упал.',
        custom: 'Использовать свой локальный прокси (Happ, v2rayN и т.п.) — укажи адрес в поле ниже.',
        off: 'Все запросы идут напрямую, без прокси.'
      }[mode] || '';
    }
  }
  $('setProxyMode').addEventListener('change', updateProxyModeUI);

  // --- Переключатель темы + живые значения слайдеров ---
  function syncThemeUI() {
    const dark = ($('setTheme').value || 'dark') === 'dark';
    const sw = $('themeSwitch');
    sw.classList.toggle('on', dark);
    sw.setAttribute('aria-checked', String(dark));
    $('themeSwitchIcon').textContent = dark ? '🌙' : '☀️';
    $('themePreview').classList.toggle('light', !dark);
  }
  $('themeSwitch').addEventListener('click', () => {
    $('setTheme').value = $('setTheme').value === 'dark' ? 'light' : 'dark';
    syncThemeUI();
    applyTheme($('setTheme').value); // живое превью темы прямо в настройках
  });
  $('setOpacity').addEventListener('input', (e) => {
    $('opacityValue').textContent = e.target.value + '%';
  });
  $('setFontSize').addEventListener('input', (e) => {
    $('fontSizeValue').textContent = e.target.value + 'px';
  });

  // Reasoning Effort slider
  $('reasoningEffortSlider').addEventListener('input', (e) => {
    updateReasoningEffortUI(parseInt(e.target.value));
  });

  // Восстановить уровень Reasoning Effort из сохранённых настроек
  const EFFORT_LEVELS = ['low', 'medium', 'high-high'];
  function restoreReasoningEffort(value) {
    const idx = Math.max(0, EFFORT_LEVELS.indexOf(value));
    $('reasoningEffortSlider').value = idx;
    updateReasoningEffortUI(idx);
  }

  $('setProvider').addEventListener('change', () => {
    const newProvider = $('setProvider').value;
    const s = _lastSettings || {};
    const prevProvider = s.provider;
    if (prevProvider && prevProvider !== newProvider && s.providerModels) {
      s.providerModels[prevProvider] = $('setModel').value;
    }
    updateModelOptions(newProvider);
    updateProviderCard(newProvider);
    // Update model card with the currently selected or first model
    const currentModel = $('setModel').value;
    updateModelCard(currentModel);
    const savedModel = s.providerModels && s.providerModels[newProvider];
    if (savedModel && MODEL_OPTIONS[newProvider] && MODEL_OPTIONS[newProvider].includes(savedModel)) {
      $('setModel').value = savedModel;
      updateModelCard(savedModel);
    }
    $('setApiKey').value = (s.providerKeys && s.providerKeys[newProvider]) || '';
  });
  $('btnSaveSettings').addEventListener('click', async () => {
    let res;
    try {
      const personalityResult = await window.api.savePersonality($('personalityEditor').value);
      const effortLabels = ['low', 'medium', 'high-high'];
      const reasoningEffort = effortLabels[parseInt($('reasoningEffortSlider').value)] || 'low';

      res = await window.api.saveSettings({
        provider: $('setProvider').value,
        // Auto: модель и ключ встроены — сохраняем плейсхолдеры, а не значения полей
        model: $('setProvider').value === 'auto' ? 'command-a-03-2025' : $('setModel').value.trim(),
        apiKey: $('setProvider').value === 'auto' ? '' : $('setApiKey').value.trim(),
        voiceEnabled: $('setVoiceEnabled').checked,
        customEndpoint: $('setCustomEndpoint').value.trim(),
        proxy: $('setProxy').value.trim(),
        proxyMode: $('setProxyMode').value,
        blockedSites: $('setBlocked').value.trim(),
        autostart: $('setAutostart').checked,
        theme: $('setTheme').value,
        debug: $('setDebug').checked,
        opacity: Number($('setOpacity').value) / 100,
        fontSize: Number($('setFontSize').value),
        // Reasoning Effort вместо deepThink: "low" | "high" | "high-high"
        reasoningEffort: reasoningEffort,
        deepThink: reasoningEffort !== 'low',
        // Сохраняем последнюю модель для каждого провайдера
        providerModels: {
          ...((_lastSettings && _lastSettings.providerModels) || {}),
          [$('setProvider').value]: $('setProvider').value === 'auto' ? 'command-a-03-2025' : $('setModel').value.trim()
        },
        language: $('setLanguage').value,
        plugins: { webSearch: $('setWebSearch').checked, fetchPage: $('setFetchPage').checked },

      });
      store.state.voiceEnabled = !!res.voiceEnabled; // мгновенно показать/спрятать 🎙
      $('personalityStatus').textContent = personalityResult.warnings.length
        ? `Сохранено · ${personalityResult.warnings.join(' ')}`
        : 'Сохранено ✓';
    } catch (error) {
      $('settingsStatus').textContent = error.message || 'Настройки не сохранены';
      return;
    }
    applyTheme(res.theme);
    applyFontSize(res.fontSize);
    const lang = res.language || 'ru';
    applyLang(lang);
    $('settingsStatus').textContent = res.proxyRestartNeeded
      ? t(lang, 'Сохранено · прокси после перезапуска')
      : t(lang, 'Сохранено ✓');
    $('btnSaveSettings').textContent = 'Сохранено ✓';
    setTimeout(() => { $('btnSaveSettings').textContent = 'Сохранить'; }, 1800);
  });
  $('btnPersonalityReset').addEventListener('click', async () => {
    if (!window.confirm('Сбросить личность агента к нейтральной?')) return;
    const result = await window.api.resetPersonality();
    $('personalityEditor').value = result.text;
    $('personalityStatus').textContent = 'Сброшено ✓';
    updatePersonalityCounter();
  });
  // --- Отдельные проверки диагностики: карточки со статус-индикатором ---
  const diagOut = () => $('diagOut');
  const setDiagState = (cardId, state) => {
    const card = $(cardId);
    if (!card) return;
    card.classList.remove('diag-ok', 'diag-fail', 'diag-running');
    if (state) card.classList.add('diag-' + state);
  };
  const runCheck = (fn, cardId, busy) => async () => {
    setDiagState(cardId, 'running');
    diagOut().textContent = busy;
    try {
      const res = await fn();
      diagOut().textContent = res;
      setDiagState(cardId, /🔴|❌/.test(res) ? 'fail' : 'ok');
    }
    catch (e) {
      diagOut().textContent = '🔴 ' + (e.message || 'ошибка проверки');
      setDiagState(cardId, 'fail');
    }
  };
  $('btnCheckProvider').addEventListener('click', runCheck(() => window.api.checkProvider(), 'diagCardProvider', '⏳ Проверяю провайдера…'));
  $('btnCheckNet').addEventListener('click', runCheck(() => window.api.checkNet(), 'diagCardNet', '⏳ Проверяю интернет и прокси…'));
  $('btnCheckVoice').addEventListener('click', runCheck(() => window.api.checkVoice(), 'diagCardVoice', '⏳ Проверяю голосовой ввод…'));

  $('btnDiagnostics').addEventListener('click', async () => {
    try {
      await window.api.copyDiagnostics();
      const s = await window.api.getSettings();
      $('settingsStatus').textContent = t(s.language || 'ru', 'Диагностика скопирована');
    } catch (error) {
      $('settingsStatus').textContent = 'Не удалось скопировать диагностику';
    }
  });
  document.querySelectorAll('.settings-tab').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('.settings-tab').forEach(item => item.classList.toggle('active', item === tab));
    document.querySelectorAll('.settings-page').forEach(page => page.classList.toggle('active', page.dataset.page === tab.dataset.tab));
  }));

  // Первичный рендер при старте приложения: карточки провайдера и модели
  // должны сразу показывать сохранённого провайдера и модель (а не дефолт из HTML).
  (async () => {
    try {
      const s = await window.api.getSettings();
      const provider = s.provider || 'auto';
      $('setProvider').value = provider;
      updateModelOptions(provider, s.model);
      updateProviderCard(provider);
      updateModelCard($('setModel').value);
      restoreReasoningEffort(s.reasoningEffort);
    } catch { /* настройки недоступны — карточки останутся дефолтными */ }
  })();

  return { setLoader, refreshSessions, openSettings };
}

// Глобальный слушатель: main присылает обновлённый список сессий
// (например, после того как модель сгенерировала название нового диалога).
// Дёргаем refreshSessions через объект настроек — он у нас singleton-стиль,
// но безопаснее всего просто вызвать getSessions и обновить DOM напрямую.
window.api.onSessionsUpdated((list) => {
  const listEl = $('sessionsList');
  if (!listEl) return;
  // Лёгкое обновление без полного перерендера панели: пересоберём элементы.
  // (Полный refresh делает refreshSessions() — но он доступен только через initSettings,
  //  поэтому используем простую перерисовку списка.)
  listEl.innerHTML = '';
  for (const s of list) {
    const item = document.createElement('div');
    item.className = 'session-item' + (s.active ? ' active' : '');
    item.textContent = s.title;
    item.dataset.id = s.id;
    item.addEventListener('click', () => window.api.switchSession(s.id).then(() => window.location.reload()));
    listEl.appendChild(item);
  }
});