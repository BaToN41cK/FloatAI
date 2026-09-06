const PROVIDERS = {
  mistral: {
    label: 'Mistral',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'ministral-3b-latest', 'ministral-8b-latest', 'codestral-latest', 'devstral-small-latest', 'open-mistral-nemo'],
    chatUrl: 'https://api.mistral.ai/v1/chat/completions',
    supportsTools: true,
    maxOutputTokens: 8192
  },
  openai: {
    label: 'OpenAI',
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'o3', 'o3-mini', 'o4-mini'],
    chatUrl: 'https://api.openai.com/v1/chat/completions',
    supportsTools: true
  },
  anthropic: {
    label: 'Anthropic',
    models: ['claude-opus-4-1', 'claude-sonnet-4-20250514', 'claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
    chatUrl: 'https://api.anthropic.com/v1/messages',
    supportsTools: false,
    maxOutputTokens: 8192
  },
  google: {
    label: 'Google',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'],
    chatUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    supportsTools: false
  },
  gigachat: {
    label: 'GigaChat',
    models: ['GigaChat-2-Max', 'GigaChat-2-Pro', 'GigaChat-2', 'GigaChat-Pro', 'GigaChat', 'GigaChat-Lite'],
    chatUrl: 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
    supportsTools: false,
    compatible: false
  },
  yandex: {
    label: 'YandexGPT / Алиса',
    models: ['yandexgpt-5-pro', 'yandexgpt-5-lite', 'yandexgpt-4-pro', 'yandexgpt', 'yandexgpt-lite'],
    chatUrl: 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
    supportsTools: false,
    compatible: false
  },
  custom: {
    label: 'Свой OpenAI-совместимый',
    models: ['custom-model', 'llama-3.3-70b', 'qwen2.5-72b-instruct', 'deepseek-chat', 'command-r-plus', 'mixtral-8x7b'],
    chatUrl: '',
    supportsTools: true,
    compatible: true
  },
  ollama: {
    label: 'Ollama (локально)',
    models: ['llama3.2', 'llama3.1', 'qwen2.5', 'deepseek-r1', 'mistral', 'phi4'],
    chatUrl: 'http://127.0.0.1:11434/v1/chat/completions',
    supportsTools: false,
    local: true
  },
  lmstudio: {
    label: 'LM Studio (локально)',
    models: ['local-model', 'llama-3.2', 'qwen2.5', 'deepseek-r1', 'mistral-small', 'gemma-3'],
    chatUrl: 'http://127.0.0.1:1234/v1/chat/completions',
    supportsTools: false,
    local: true
  },
  cohere: {
    label: 'Cohere',
    models: ['command-a-03-2025', 'command-r-plus-08-2024', 'command-r-08-2024', 'command-r7b-12-2024', 'command-r-03-2024'],
    chatUrl: 'https://api.cohere.ai/compatibility/v1/chat/completions',
    supportsTools: true,
    maxOutputTokens: 8192,
    freeModels: ['command-a-03-2025', 'command-r-plus-08-2024', 'command-r-08-2024', 'command-r7b-12-2024', 'command-r-03-2024']
  },
  cerebras: {
    label: 'Cerebras',
    // Актуальный публичный каталог Cerebras (Llama-модели выведены из обращения)
    models: ['gpt-oss-120b', 'qwen-3.8-27b'],
    chatUrl: 'https://api.cerebras.ai/v1/chat/completions',
    supportsTools: true
  },
  auto: {
    label: 'Auto (локально, без интернета)',
    models: ['qwen2.5:7b', 'llama3.1:8b', 'qwen2.5:3b', 'llama3.2:3b', 'deepseek-r1:8b'],
    chatUrl: 'http://127.0.0.1:11434/v1/chat/completions',
    supportsTools: false,
    local: true
  },
  zai: {
    label: 'Z.ai',
    models: ['GLM-5.3-Flash', 'GLM-5.3', 'GLM-5.2', 'GLM-5.1', 'GLM-5', 'GLM-4.7', 'GLM-4.7-FlashX', 'GLM-4.7-Flash', 'GLM-4.5-Flash', 'GLM-4.6V-Flash'],
    freeModels: ['GLM-4.7-Flash', 'GLM-4.5-Flash', 'GLM-4.6V-Flash'],
    chatUrl: 'https://api.z.ai/api/paas/v4/chat/completions',
    supportsTools: true
  },
  openrouter: {
    label: 'OpenRouter',
    models: [
      // Бесплатные модели
      'nvidia/nemotron-3.5-lightning:free',
      'poolside/laguna-s-2.1:free',
      'inclusionai/ling-3.0-flash-fin:free',
      'minimax/minimax-m3:free',
      'google/gemma-4-31b-it:free',
      // Платные модели
      'openai/gpt-6-astra:batch',
      'openai/gpt-6-astra',
      'qwen/qwen3.8-max-0902',
      'google/gemini-3.8-flash',
      'anthropic/claude-fable-5.1',
      'qwen/qwen3.8-flash'
    ],
    freeModels: [
      'nvidia/nemotron-3.5-lightning:free',
      'poolside/laguna-s-2.1:free',
      'inclusionai/ling-3.0-flash-fin:free',
      'minimax/minimax-m3:free',
      'google/gemma-4-31b-it:free'
    ],
    chatUrl: 'https://openrouter.ai/api/v1/chat/completions',
    supportsTools: true,
    maxOutputTokens: 8192
  }
};

function providerForModel(model) {
  const value = String(model || '').toLowerCase();
  // OpenRouter: формат provider/model (например nvidia/nemotron-3.5-lightning:free)
  if (/^[\w-]+\/[\w-]+(:\w+)?$/.test(value) && !value.startsWith('openai/gpt-4') && !value.startsWith('openai/gpt-3')) return 'openrouter';
  if (value.startsWith('gpt-') || value.startsWith('o1') || value.startsWith('o3')) return 'openai';
  if (value.startsWith('claude-')) return 'anthropic';
  if (value.startsWith('gemini-')) return 'google';
  if (value.startsWith('gigachat') || value.startsWith('giga')) return 'gigachat';
  if (value.startsWith('yandexgpt') || value.includes('alice') || value.includes('алиса')) return 'yandex';
  if (value.startsWith('llama') || value.startsWith('qwen') || value.startsWith('deepseek') || value === 'mistral') return 'ollama';
  if (value.startsWith('glm-')) return 'zai';
  return 'mistral';
}

function getProvider(provider, model) {
  const key = PROVIDERS[provider] ? provider : providerForModel(model);
  return { id: key, ...PROVIDERS[key] };
}

function modelPricing(providerId, model) {
  const provider = PROVIDERS[providerId];
  if (!provider) return 'unknown';
  if (provider.local) return 'free';
  if (provider.freeModels?.includes(model)) return 'free';
  if (providerId === 'custom') return 'unknown';
  // Cerebras: бесплатный API-тариф на все модели каталога
  if (providerId === 'cerebras') return 'free';
  // OpenRouter: модели с суффиксом :free бесплатны
  if (providerId === 'openrouter' && model.endsWith(':free')) return 'free';
  return 'paid';
}

module.exports = { PROVIDERS, providerForModel, getProvider, modelPricing };
