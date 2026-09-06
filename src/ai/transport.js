// Транспортный слой: вызов AI-провайдера со стримингом и повторами.
const { doFetch } = require('../electron-fetch');
const { getProvider } = require('../providers');
const { isZaiOverload, isNetworkError } = require('../ai-errors');
const log = require('../logger');

const RETRY_CODES = new Set([408, 429, 500, 502, 503, 504]);
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 1200;
const RETRY_MAX_MS = 4000;
const REQUEST_TIMEOUT_MS = 120000;
const DEEP_REQUEST_TIMEOUT_MS = 180000;
const ZAI_OVERLOAD_RETRY_DELAYS = [2000, 5000];

// Сделать запрос к провайдеру. Возвращает { body, headers } или бросает ошибку.
async function callProvider({ provider, model, apiKey, messages, maxTokens, stream, signal, endpoint }) {
  const p = getProvider(provider);
  const url = endpoint || (p && p.endpoint) || `https://api.mistral.ai/v1/chat/completions`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
  const body = {
    model,
    messages,
    max_tokens: maxTokens,
    stream: !!stream,
    temperature: 0.7
  };
  const res = await doFetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal
  });
  return { res, url };
}

// Парсинг SSE-потока. Возвращает генератор токенов.
async function* parseSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const obj = JSON.parse(data);
        const token = obj.choices && obj.choices[0] && obj.choices[0].delta && obj.choices[0].delta.content;
        if (token) yield token;
      } catch (_) {}
    }
  }
}

// Вызов с повторами и таймаутом
async function requestWithRetry({ provider, model, apiKey, messages, maxTokens, stream, signal, endpoint, deepThink }) {
  const timeout = deepThink ? DEEP_REQUEST_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
  let lastErr;
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const combinedSignal = signal || controller.signal;
      const { res } = await callProvider({ provider, model, apiKey, messages, maxTokens, stream, signal: combinedSignal, endpoint });
      clearTimeout(timer);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw Object.assign(new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`), { status: res.status });
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (e.name === 'AbortError') throw e;
      if (isZaiOverload(e)) {
        const delay = ZAI_OVERLOAD_RETRY_DELAYS[attempt] || ZAI_OVERLOAD_RETRY_DELAYS[ZAI_OVERLOAD_RETRY_DELAYS.length - 1];
        log.warn(`[transport] Z.ai overload, retry ${attempt + 1} after ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      if (RETRY_CODES.has(e.status) && attempt < RETRY_ATTEMPTS - 1) {
        const delay = Math.min(RETRY_BASE_MS * Math.pow(2, attempt), RETRY_MAX_MS);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

module.exports = { callProvider, parseSSE, requestWithRetry, REQUEST_TIMEOUT_MS, DEEP_REQUEST_TIMEOUT_MS };
