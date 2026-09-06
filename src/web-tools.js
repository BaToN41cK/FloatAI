// Веб-инструменты: поиск (DuckDuckGo / Tavily / Google CSE / Brave) и чтение страниц.
// Весь трафик идёт через doFetch (в Electron — net.fetch, уважает прокси из настроек).
const dns = require('dns').promises;
const log = require('./logger');
const { doFetch } = require('./electron-fetch');
const { t } = require('./i18n');

// --- Провайдеры поиска ---
//  'ddg'    — DuckDuckGo, бесплатный, без ключа, HTML-парсинг
//  'tavily' — tavily.ai, бесплатный ключ, 1000 запросов/мес
//  'google' — Google Custom Search JSON API, бесплатный ключ, 100/день
//  'brave'  — brave.com/search/api, ключ, 2000/мес
let SEARCH_MODE = 'ddg';
let SEARCH_API_KEY = '';

function setSearchMode(mode) {
  SEARCH_MODE = String(mode || 'ddg');
  log.info('[web] режим поиска: ' + SEARCH_MODE);
}

function setSearchApiKey(key) {
  SEARCH_API_KEY = String(key || '').trim();
}

const FETCH_TIMEOUT = 15000; // мс
const SEARCH_TTL = 10 * 60 * 1000;
const searchCache = new Map();
const SEARCH_CACHE_MAX = 200;

let BLOCKED_SITES = ''
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

function setBlockedSites(str) {
  BLOCKED_SITES = String(str || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  log.info('[web] чёрный список обновлён: ' + (BLOCKED_SITES.join(', ') || '(пусто)'));
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const MAX_SNIPPETS = 6;
const PAGE_LIMIT = 4000;

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}
const stripTags = (s) => decodeEntities(String(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

// --- Защита от SSRF ---
function normalizeHost(h) {
  let host = String(h).toLowerCase().replace(/^\[|\]$/g, '');
  const whole = /^(0x[0-9a-f]+|\d+)$/i.exec(host);
  if (whole) {
    const n = whole[1].startsWith('0x') ? parseInt(whole[1], 16) : parseInt(whole[1], 10);
    if (!isNaN(n) && n <= 0xffffffff) {
      host = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    }
    return host;
  }
  if (/^(\d+|0x[0-9a-f]+)(\.(\d+|0x[0-9a-f]+)){1,3}$/i.test(host)) {
    const parts = host.split('.').map(p => p.startsWith('0x') ? parseInt(p, 16) : (p.length > 1 && p.startsWith('0') ? parseInt(p, 8) : parseInt(p, 10)));
    if (parts.length === 4 && parts.every(n => !isNaN(n) && n >= 0 && n <= 255)) {
      host = parts.join('.');
    }
  }
  return host;
}

function isPrivateIp(ip) {
  if (ip.includes(':')) {
    const l = ip.toLowerCase();
    if (l.startsWith('::ffff:')) {
      const mapped = l.slice(7);
      if (mapped.includes(':')) {
        const groups = mapped.split(':').filter(Boolean);
        const last2 = groups.slice(-2).map(g => parseInt(g, 16));
        if (last2.length === 2 && last2.every(n => !isNaN(n))) {
          const ip4 = [(last2[0] >> 8) & 255, last2[0] & 255, (last2[1] >> 8) & 255, last2[1] & 255].join('.');
          return isPrivateIp(ip4);
        }
      }
      return isPrivateIp(mapped);
    }
    if (l === '::1' || l === '::') return true;
    if (l.startsWith('fe8') || l.startsWith('fe9') || l.startsWith('fea') || l.startsWith('feb')) return true;
    if (l.startsWith('fc') || l.startsWith('fd')) return true;
    if (l.startsWith('ff')) return true;
    return false;
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;
  const n = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
  const r = (a, b) => ((n >>> 0) & ((0xffffffff << (32 - a)) >>> 0)) === ((b << (32 - a)) >>> 0);
  return r(8, 10) || r(8, 127) || r(8, 0) || r(8, 6) || r(7, 169) || r(7, 172) || r(7, 192);
}

function isBlockedSite(url) {
  try {
    const host = normalizeHost(new URL(url).hostname);
    return BLOCKED_SITES.some(s => host === s || host.endsWith('.' + s));
  } catch (_) { return false; }
}

async function isSafeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1') return false;
    const [ip] = await dns.resolve4(url.hostname).catch(() => []);
    if (ip && isPrivateIp(normalizeHost(ip))) return false;
    return true;
  } catch (_) { return false; }
}

// --- Поисковые провайдеры ---

// 1. DuckDuckGo (бесплатный, без ключа) — HTML-парсинг
async function ddgHtmlSearch(query) {
  const q = encodeURIComponent(String(query).slice(0, 400));
  const res = await doFetch('https://html.duckduckgo.com/html/?q=' + q + '&kl=wt-wt', {
    headers: { 'User-Agent': UA, 'Accept': 'text/html' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT)
  });
  if (!res.ok) throw new Error('DuckDuckGo недоступен (HTTP ' + res.status + ')');
  const html = await res.text();
  const rawResults = [];
  // Каждый результат — блок с <a class="result__a"> для ссылки и <a class="result__snippet"> для сниппета
  const linkRegex = /<a class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let linkMatch, snippetMatch;
  const links = []; const snippets = [];
  while ((linkMatch = linkRegex.exec(html)) !== null) links.push(linkMatch);
  while ((snippetMatch = snippetRegex.exec(html)) !== null) snippets.push(snippetMatch);
  const count = Math.min(MAX_SNIPPETS, Math.min(links.length, snippets.length));
  for (let i = 0; i < count; i++) {
    const url = decodeEntities(String(links[i][1] || '').trim());
    if (!url || !url.startsWith('http') || isBlockedSite(url)) continue;
    const title = stripTags(links[i][2] || '').slice(0, 200);
    const snippet = stripTags(snippets[i][1] || '').slice(0, 300);
    rawResults.push({ url, title, snippet });
  }
  return rawResults;
}

// 2. Tavily Search (бесплатный ключ tavily-python, 1000/мес)
async function tavilySearch(query) {
  const key = SEARCH_API_KEY;
  const res = await doFetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ query: String(query).slice(0, 400), search_depth: 'basic', max_results: MAX_SNIPPETS }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT)
  });
  if (!res.ok) throw new Error('Tavily API недоступен (HTTP ' + res.status + ')');
  const data = await res.json();
  const results = (data.results && Array.isArray(data.results)) ? data.results : [];
  return results.slice(0, MAX_SNIPPETS).map(r => ({
    url: String(r.url || ''),
    title: String(r.title || '').slice(0, 200),
    snippet: String(r.content || r.snippet || '').slice(0, 300)
  }));
}

// 3. Google Custom Search JSON API (бесплатный ключ, 100/день)
async function googleSearch(query) {
  const key = SEARCH_API_KEY;
  const q = encodeURIComponent(String(query).slice(0, 400));
  const res = await doFetch(
    'https://www.googleapis.com/customsearch/v1?key=' + key + '&cx=017576662512468239146:omuauf_lfve&q=' + q + '&num=' + MAX_SNIPPETS,
    { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT) }
  );
  if (!res.ok) throw new Error('Google Search API недоступен (HTTP ' + res.status + ')');
  const data = await res.json();
  const items = (data.items && Array.isArray(data.items)) ? data.items : [];
  return items.slice(0, MAX_SNIPPETS).map(r => ({
    url: String(r.link || ''),
    title: String(r.title || '').slice(0, 200),
    snippet: String(r.snippet || '').slice(0, 300)
  }));
}

// 4. Brave Search API (ключ, 2000/мес)
async function braveApiSearch(query) {
  const q = encodeURIComponent(String(query).slice(0, 400));
  const res = await doFetch('https://api.search.brave.com/res/v1/web/search?q=' + q + '&count=' + MAX_SNIPPETS, {
    headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': SEARCH_API_KEY },
    signal: AbortSignal.timeout(FETCH_TIMEOUT)
  });
  if (!res.ok) throw new Error('Brave Search API недоступен (HTTP ' + res.status + ')');
  const data = await res.json();
  const items = (data.web && Array.isArray(data.web.results)) ? data.web.results : [];
  return items.slice(0, MAX_SNIPPETS).map(r => ({
    url: String(r.url || ''),
    title: String(r.title || '').slice(0, 200),
    snippet: String(r.description || '').slice(0, 300)
  }));
}

// Резервный путь: парсинг HTML-выдачи без ключа
async function braveHtmlSearch(query) {
  const q = encodeURIComponent(String(query).slice(0, 300));
  const res = await doFetch('https://search.brave.com/search?q=' + q, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ru,en;q=0.8' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT)
  });
  if (!res.ok) throw new Error('Brave HTML поиск недоступен (HTTP ' + res.status + ')');
  const html = await res.text();

  const rawResults = [];
  const chunks = html.split(/class="result-content[ "]/).slice(1);
  for (const chunk of chunks) {
    const linkMatch = chunk.match(/href="(https?:\/\/[^ "]+)"[^>]*>\s*<span[^>]*>\s*<img/);
    if (!linkMatch) continue;
    const url = decodeEntities(linkMatch[1]);
    if (/imgs\.search\.brave\.com|search\.brave\.com/.test(url)) continue;
    const titleMatch = chunk.match(/class="title[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const title = titleMatch ? stripTags(titleMatch[1]) : '';
    const snipMatch = chunk.match(/class="description[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const snippet = snipMatch ? stripTags(snipMatch[1]).slice(0, 300) : '';
    rawResults.push({ url, title, snippet });
  }
  return rawResults.slice(0, MAX_SNIPPETS);
}

// Финализация: фильтрация, дедупликация, формирование ответа
function finalizeSearch(query, rawResults) {
  const seen = new Set();
  const filtered = rawResults.filter(r => {
    if (!r.url || !r.url.startsWith('http') || isBlockedSite(r.url)) return false;
    try { const u = new URL(r.url); if (seen.has(u.hostname)) return false; seen.add(u.hostname); } catch (_) { return false; }
    return true;
  }).slice(0, MAX_SNIPPETS);

  if (!filtered.length) {
    return { query, results: [], answer: t('web.noResults') || 'Ничего не найдено по запросу: ' + query };
  }
  const sources = filtered.map((r, i) => (i+1) + '. [' + r.title + '](' + r.url + ') \u2014 ' + r.snippet).join('\n')('\n');
  const answer = t('web.searchAnswer') || 'Вот что я нашёл:';
  return {
    query,
    results: filtered,
    answer: answer + '\n\n' + sources,
    sourceCount: filtered.length
  };
}

async function webSearch(query) {
  const key = String(query).trim().toLowerCase();
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.ts < SEARCH_TTL) {
    log.info('[web] поиск из кэша: ' + query);
    return cached.result;
  }

  let rawResults = [];
  const mode = SEARCH_MODE;
  const hasKey = !!SEARCH_API_KEY;

  try {
    if (mode === 'ddg') {
      rawResults = await ddgHtmlSearch(query);
    } else if (mode === 'tavily') {
      if (!hasKey) throw new Error('нужен ключ Tavily');
      rawResults = await tavilySearch(query);
    } else if (mode === 'google') {
      if (!hasKey) throw new Error('нужен ключ Google Custom Search');
      rawResults = await googleSearch(query);
    } else if (mode === 'brave') {
      if (!hasKey) {
        log.warn('[web] режим Brave без ключа — переключаюсь на HTML-парсинг');
        rawResults = await braveHtmlSearch(query);
      } else {
        rawResults = await braveApiSearch(query);
      }
    } else {
      // Неизвестный режим — DuckDuckGo
      rawResults = await ddgHtmlSearch(query);
    }
  } catch (e) {
    log.warn('[web] поиск ' + mode + ' не сработал (' + e.message + ') — DuckDuckGo в резерв');
    rawResults = await ddgHtmlSearch(query);
  }

  const result = finalizeSearch(query, rawResults);

  if (searchCache.size >= SEARCH_CACHE_MAX) {
    const oldest = [...searchCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    searchCache.delete(oldest[0]);
  }
  searchCache.set(key, { ts: Date.now(), result });
  return result;
}

// Чтение страницы
async function fetchViaReader(url) {
  const res = await doFetch('https://r.jina.ai/' + url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/plain' },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT * 2)
  });
  if (!res.ok) throw new Error('прокси-читалка недоступна (HTTP ' + res.status + ')');
  const text = String(await res.text()).trim();
  if (!text) throw new Error(t('ocr.emptyText'));
  return text;
}

async function fetchPage(url) {
  if (!(await isSafeUrl(url))) return t('web.error.unsafeUrl');
  if (isBlockedSite(url)) return t('web.error.blockedSite');

  let text = '';
  let viaReader = false;
  try {
    const res = await doFetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!res.ok) throw new Error('страница недоступна (HTTP ' + res.status + ')');
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/') || contentType.includes('json') || contentType.includes('xml')) {
      const html = await res.text();
      text = stripTags(
        html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      );
    } else {
      log.info('[web] не текстовый контент (' + contentType.split(';')[0] + ') — пробую прокси-читалку');
    }
  } catch (e) {
    log.info('[web] прямая загрузка не удалась (' + e.message + ') — пробую прокси-читалку r.jina.ai');
  }

  if (!text) {
    try {
      text = await fetchViaReader(url);
      viaReader = true;
    } catch (e2) {
      log.warn('[web] прокси-читалка тоже не помогла:', e2.message);
      return 'Страница не открылась ни напрямую, ни через прокси-читалку. Попроси другой источник или точный URL.';
    }
  }

  if (!text) return 'Страница пустая или состоит только из скриптов.';
  const prefix = viaReader ? '(получено через прокси-читалку r.jina.ai)\n\n' : '';
  log.info('[web] получено ' + Math.min(text.length, PAGE_LIMIT) + ' символов с ' + new URL(url).hostname + (viaReader ? ' (через читалку)' : ''));
  return prefix + text.slice(0, PAGE_LIMIT) + (text.length > PAGE_LIMIT ? '\n…[текст обрезан]' : '');
}

module.exports = { webSearch, fetchPage, setBlockedSites, setSearchMode, setSearchApiKey };