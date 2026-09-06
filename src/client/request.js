const { getProvider } = require('./providers');
const { extractReplyText } = require('./ai/parser');
const { t } = require('./i18n');
const log = require('./logger');
const { generateTitle } = require('./ai/title');

const MAX_OUTPUT_TOKENS = 32768;

function buildRequest(conversation, provider, model, apiKey, customEndpoint, deepThink, maxTokens, plugins) {
  const outputTokens = Math.min(maxTokens, provider.maxOutputTokens || maxTokens);
  if (!provider.local && !apiKey) throw new Error('API-ключ не задан. Открой настройки и добавь ключ провайдера');
  
  if (provider.id === 'anthropic') {
    const system = conversation.find(m => m.role === 'system');
    const messages = conversation.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '')
    }));
    return { url: provider.chatUrl, headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: { model, max_tokens: outputTokens, system: system?.content || '', messages, stream: true } };
  }
  if (provider.id === 'google') {
    const contents = conversation.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] }));
    return { url: `${provider.chatUrl}/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`, headers: { 'content-type': 'application/json' }, body: { contents, generationConfig: { maxOutputTokens: outputTokens } } };
  }
  if (provider.id === 'gigachat' || provider.id === 'yandex') {
    throw new Error(`${provider.label} требует специальную авторизацию и endpoint; выбери поддерживаемого провайдера или настрой свой OpenAI-совместимый API`);
  }
  if (provider.id === 'custom' && !customEndpoint) {
    throw new Error('Для своего провайдера укажи endpoint в настройках');
  }
  const body = {
    model,
    messages: conversation,
    temperature: 0.7,
    max_tokens: outputTokens,
    stream: true
  };
  if (provider.id === 'zai') {
    body.thinking = { type: deepThink ? 'enabled' : 'disabled' };
  }
  if (provider.supportsTools) {
    const { TOOLS } = require('./tools');
    const { enabledTools } = require('./plugins');
    const allowed = new Set(enabledTools(plugins));
    body.tools = TOOLS.filter(tool => allowed.has(tool.function.name));
  }
  return { url: provider.id === 'custom' ? customEndpoint : provider.chatUrl, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body };
}

module.exports = { buildRequest };
