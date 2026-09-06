const log = require('./logger');
const { t } = require('./i18n');
const { doFetch } = require('./electron-fetch');
const { isZaiOverload, isNetworkError } = require('./ai-errors');
const { extractReplyText } = require('./ai/parser');
const { generateTitle } = require('./ai/title');
const { writeChain, serializeWrite } = require('./constants');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function approxTokens(s) {
  if (!s) return 0;
  const text = String(s);
  const cyr = (text.match(/[А-Яа-яЁё]/g) || []).length;
  return Math.ceil((text.length - cyr) / 4 + cyr / 2);
}

function trimHistory(history, budget) {
  const out = [];
  let used = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const t = approxTokens(String(history[i].content || ''));
    if (out.length && used + t > budget) break;
    used += t;
    out.unshift(history[i]);
  }
  return out;
}

function appendSummary(summary, dropped) {
  const add = dropped.map(m =>
    '' + m.role === 'user' ? 'Пользователь' : 'Ассистент' + ': ' + String(m.content).replace(/s+/g, ' ').slice(0, 120)
  ).join('\n' );
  const next = summary ? '' + summary + '\n' + add : add;
  return next.length > 1200 ? '…[ранее сокращено]…' + next.slice(-1200) : next;
}

function isSimplePrompt(text) {
  const value = String(text || '' ).trim().toLowerCase();
  if (!value || value.length > 160) return false;
  return /^(привет|здравствуй|добрый день|доброе утро|добрый вечер|как дела|что делаешь|спасибо|пока|хорошо|да|нет|ок|окей|hi|hello|how are you)[!?.,\s]*$/i.test(value);
}

function peekReply(text) {
  const value = String(text || '' ).trim().toLowerCase();
  if (/^(привет|здравствуй|добрый день|доброе утро|добрый вечер|hi|hello|how are you)/i.test(value)) {
    return 'Привет! 👋 Чем помочь?';
  }
  if (/^(спасибо|благадарю)/i.test(value)) {
    return 'Всегда пожалуйста! 😊';
  }
  if (/^(пока|до свидания|bye)/i.test(value)) {
    return 'До связи! 👋';
  }
  if (/(как дела|как ты|что делаешь)/i.test(value)) {
    return 'Всё нормально! Работаю 🐾 Что у тебя?';
  }
  if (/^(да|нет|ок|окей|хорошо)/i.test(value)) {
    return 'Принято!';
  }
  return null;
}

async function retryFetch(factory, abortSignal) {
  let attempt = 0;
  for (;;) {
    attempt++;
    try {
      const res = await factory();
      const RETRY_CODES = new Set([408, 429, 500, 502, 503, 504]);
      const RETRY_ATTEMPTS = 3;
      const RETRY_BASE_MS = 1200;
      const RETRY_MAX_MS = 4000;
      if (RETRY_CODES.has(res.status) && attempt < RETRY_ATTEMPTS) {
        if (abortSignal && abortSignal.aborted) return res;
        await sleep(Math.min(RETRY_MAX_MS, RETRY_BASE_MS * attempt));
        continue;
      }
      return res;
    } catch (e) {
      if (abortSignal && abortSignal.aborted) throw e;
      const isAbort = e && e.name === 'AbortError';
      const retryable = isAbort || isNetworkError(e && e.message);
      if (retryable && attempt < RETRY_ATTEMPTS) {
        await sleep(Math.min(RETRY_MAX_MS, RETRY_BASE_MS * attempt));
        continue;
      }
      throw e;
    }
  }
}

module.exports = {
  sleep,
  approxTokens,
  trimHistory,
  appendSummary,
  isSimplePrompt,
  peekReply,
  retryFetch
};
