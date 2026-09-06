// Генерация названия сессии моделью (вместо первых 40 символов сообщения).
const { requestWithRetry } = require('./transport');
const { extractReplyText } = require('./parser');
const { t } = require('../i18n');
const log = require('../logger');

// Сгенерировать короткое название диалога по первому сообщению пользователя.
// Возвращает строку (до 60 символов) или null, если не удалось.
async function generateTitle(userMessage, { provider, model, apiKey, endpoint }) {
  try {
    const prompt = t('title.prompt', { message: userMessage.slice(0, 300) });
    const messages = [{ role: 'user', content: prompt }];
    const res = await requestWithRetry({
      provider, model, apiKey, messages,
      maxTokens: 32, stream: false, endpoint
    });
    let reply = '';
    if (res.json) {
      const data = await res.json();
      reply = extractReplyText(data, provider);
    } else {
      reply = await res.text();
    }
    if (reply && reply.trim()) {
      return reply.trim().slice(0, 60).replace(/["']/g, '');
    }
  } catch (e) {
    log.warn('[title] generation failed:', e.message);
  }
  return null;
}

module.exports = { generateTitle };
