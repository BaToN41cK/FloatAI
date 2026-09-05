// Каталог моделей по провайдерам (для выпадающих списков настроек).
import { $ } from './ui.js';

export const MODEL_OPTIONS = {
  mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'ministral-3b-latest', 'ministral-8b-latest', 'codestral-latest', 'devstral-small-latest', 'open-mistral-nemo'],
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'o3', 'o3-mini', 'o4-mini'],
  anthropic: ['claude-opus-4-1', 'claude-sonnet-4-20250514', 'claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'],
  gigachat: ['GigaChat-2-Max', 'GigaChat-2-Pro', 'GigaChat-2', 'GigaChat-Pro', 'GigaChat', 'GigaChat-Lite'],
  yandex: ['yandexgpt-5-pro', 'yandexgpt-5-lite', 'yandexgpt-4-pro', 'yandexgpt', 'yandexgpt-lite'],
  custom: ['custom-model', 'llama-3.3-70b', 'qwen2.5-72b-instruct', 'deepseek-chat', 'command-r-plus', 'mixtral-8x7b'],
  ollama: ['llama3.2', 'llama3.1', 'qwen2.5', 'deepseek-r1', 'mistral', 'phi4'],
  lmstudio: ['local-model', 'llama-3.2', 'qwen2.5', 'deepseek-r1', 'mistral-small', 'gemma-3'],
  // Auto: выбор модели и ключа не нужен — работает из коробки (служебная Cohere)
  auto: ['command-a-03-2025'],
  zai: ['GLM-5.3-Flash', 'GLM-5.3', 'GLM-5.2', 'GLM-5.1', 'GLM-5', 'GLM-4.7', 'GLM-4.7-FlashX', 'GLM-4.7-Flash', 'GLM-4.5-Flash', 'GLM-4.6V-Flash'],
  openrouter: [
    'nvidia/nemotron-3.5-lightning:free',
    'poolside/laguna-s-2.1:free',
    'inclusionai/ling-3.0-flash-fin:free',
    'openai/gpt-6-astra:batch',
    'openai/gpt-6-astra',
    'qwen/qwen3.8-max-0902',
    'google/gemini-3.8-flash',
    'anthropic/claude-fable-5.1',
    'qwen/qwen3.8-flash'
  ]
};

export const FREE_MODELS = new Set([
  // Z.ai
  'GLM-4.7-Flash', 'GLM-4.5-Flash', 'GLM-4.6V-Flash',
  // Локальные модели
  'local-model', 'llama3.2', 'llama3.1', 'qwen2.5', 'deepseek-r1', 'mistral', 'phi4', 'llama-3.2', 'mistral-small', 'gemma-3',
  // Auto
  'qwen2.5:7b', 'llama3.1:8b', 'qwen2.5:3b', 'llama3.2:3b', 'deepseek-r1:8b',
  // Auto (служебная облачная модель — ключ встроен, пользователю не нужен)
  'command-a-03-2025',
  // OpenRouter бесплатные
  'nvidia/nemotron-3.5-lightning:free', 'poolside/laguna-s-2.1:free', 'inclusionai/ling-3.0-flash-fin:free'
]);

export function updateModelOptions(provider, selected) {
  const options = $('setModel');
  options.innerHTML = '';
  for (const name of MODEL_OPTIONS[provider] || MODEL_OPTIONS.mistral) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = `${name} (${FREE_MODELS.has(name) ? 'free' : 'paid'})`;
    options.appendChild(option);
  }
  options.value = (MODEL_OPTIONS[provider] || MODEL_OPTIONS.mistral).includes(selected)
    ? selected : (MODEL_OPTIONS[provider] || MODEL_OPTIONS.mistral)[0];
}

export function detectProvider(model) {
  const value = String(model || '').toLowerCase();
  // OpenRouter: формат provider/model (например nvidia/nemotron-3.5-lightning:free)
  if (/^[\w-]+\/[\w-]+(:\w+)?$/.test(value) && !value.startsWith('openai/gpt-4') && !value.startsWith('openai/gpt-3')) return 'openrouter';
  if (value.startsWith('gpt-') || value.startsWith('o1') || value.startsWith('o3')) return 'openai';
  if (value.startsWith('claude-')) return 'anthropic';
  if (value.startsWith('gemini-')) return 'google';
  if (value.startsWith('giga') || value.startsWith('gigachat')) return 'gigachat';
  if (value.startsWith('yandexgpt') || value.includes('alice') || value.includes('алиса')) return 'yandex';
  if (value.startsWith('llama') || value.startsWith('qwen') || value.startsWith('deepseek') || value === 'mistral') return 'ollama';
  if (value.startsWith('glm-')) return 'zai';
  return 'mistral';
}