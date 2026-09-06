// Компактирование истории: суммаризация отрезанных сообщений силами модели.
const { requestWithRetry } = require('./transport');
const { extractReplyText } = require('./parser');
const { t } = require('../i18n');
const log = require('../logger');

const SUMMARY_MAX = 1200; // максимальная длина сводки (символы)

// Сжать отрезанные сообщения в сводку и добавить к session.summary.
// При любой ошибке — фоллбэк на эвристику (переданную как fallbackFn).
async function compactSummary(session, dropped, { provider, model, apiKey, endpoint, fallback }) {
  try {
    const roleUser = t('compaction.role.user');
    const roleAssistant = t('compaction.role.assistant');
    const text = dropped.map(m => `${m.role === 'user' ? roleUser : roleAssistant}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n');
    const prompt = t('compaction.prompt', { text: text.slice(0, 4000) });
    const messages = [{ role: 'user', content: prompt }];
    const res = await requestWithRetry({
      provider, model, apiKey, messages,
      maxTokens: 256, stream: false, endpoint
    });
    let reply = '';
    if (res.json) {
      const data = await res.json();
      reply = extractReplyText(data, provider);
    } else {
      reply = await res.text();
    }
    if (reply && reply.trim()) {
      const summary = (session.summary ? session.summary + '\n' : '') + reply.trim();
      session.summary = summary.slice(-SUMMARY_MAX);
      return;
    }
  } catch (e) {
    log.warn('[compaction] model summary failed, using fallback:', e.message);
  }
  if (fallback) fallback(session, dropped);
}

// Эвристика: просто сохранить первые 100 символов каждого сообщения.
function appendSummary(session, dropped) {
  const summary = dropped.map(m => `[${m.role}] ${(m.content || '').slice(0, 100)}`).join(' ');
  session.summary = (session.summary ? session.summary + ' ' : '') + summary;
  if (session.summary.length > SUMMARY_MAX) session.summary = session.summary.slice(-SUMMARY_MAX);
}

module.exports = { compactSummary, appendSummary, SUMMARY_MAX };
