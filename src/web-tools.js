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

// Достать конечный URL из редиректора DuckDuckGo Lite ("//duckduckgo.com/l/?uddg=<target>")
function extractRedirectUrl(url) {
  const uddg = /[?&]uddg=([^&]+)/.exec(String(url || ''));
  if (!uddg) return url;
  try { return decodeURIComponent(uddg[1]); } catch (_) { return null; }
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

// 1b. DuckDuckGo Lite (старый интерфейс) — не капчит там, где основной начал отдавать 202
async function ddgLiteSearch(query) {
  const q = encodeURIComponent(String(query).slice(0, 400));
  const res = await doFetch('https://lite.duckduckgo.com/lite/?q=' + q, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ru,en;q=0.8' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT)
  });
  if (!res.ok) throw new Error('DuckDuckGo Lite недоступен (HTTP ' + res.status + ')');
  const html = await res.text();
  const rawResults = [];
  // Каждый результат: <a ... class='result-link'>Title</a> ... <td class='result-snippet'>snippet</td>
  const blockRegex = /<a[^>]*href="([^"]+)"[^>]*class='result-link'[^>]*>([\s\S]*?)<\/a>[\s\S]*?<td class='result-snippet'>([\s\S]*?)<\/td>/gi;
  let m;
  while ((m = blockRegex.exec(html)) !== null) {
    let url = extractRedirectUrl(decodeEntities(String(m[1] || '').trim()));
    if (!url) continue;
    if (!url.startsWith('http') || isBlockedSite(url)) continue;
    const title = stripTags(m[2] || '').slice(0, 200);
    const snippet = stripTags(m[3] || '').slice(0, 300);
    rawResults.push({ url, title, snippet });
  }
  return rawResults.slice(0, MAX_SNIPPETS);
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

// Ключ дедупликации: хост + путь + значимые параметры запроса.
// YouTube (/watch?v=aaa и ?v=bbb), Twitch и другие площадки дают много ссылок
// с одного хоста — схлопывать только по hostname нельзя.
function dedupKey(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const params = [...u.searchParams.entries()]
      .filter(([k]) => !String(k).toLowerCase().startsWith('utm_'))
      .map(([k, v]) => String(k).toLowerCase() + '=' + v)
      .sort()
      .join('&');
    return host + u.pathname.replace(/\/$/, '') + (params ? '?' + params : '');
  } catch (_) { return String(url); }
}

// Финализация: фильтрация, дедупликация, формирование ответа
function finalizeSearch(query, rawResults) {
  const seen = new Set();
  const filtered = rawResults.filter(r => {
    if (!r.url || !r.url.startsWith('http') || isBlockedSite(r.url)) return false;
    const key = dedupKey(r.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_SNIPPETS);

  if (!filtered.length) {
    return { query, results: [], answer: t('web.noResults') || 'Ничего не найдено по запросу: ' + query };
  }
  const sources = filtered.map((r, i) => (i+1) + '. [' + r.title + '](' + r.url + ') \u2014 ' + r.snippet).join('\n');
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
      try {
        rawResults = await ddgHtmlSearch(query);
      } catch (e) {
        log.warn('[web] DDG не сработал (' + e.message + ') — пробую Lite');
      }
      // Основной html-интерфейс может вернуть анти-бот 202 с пустой выдачей
      if (!rawResults.length) {
        try { rawResults = await ddgLiteSearch(query); }
        catch (e2) { log.warn('[web] DDG Lite тоже не сработал:', e2.message); }
      }
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

// --- YouTube: видео, каналы и поиск внутри YouTube ---
function isYouTubeUrl(u) {
  try {
    const h = new URL(u).hostname.replace(/^www\./, '');
    return h === 'youtube.com' || h === 'm.youtube.com' || h === 'youtu.be' || h === 'music.youtube.com';
  } catch (_) { return false; }
}

// Извлечь встроенный JSON (ytInitialData / ytInitialPlayerResponse) из HTML:
// идём по скобочному балансу с учётом строк — регэкс тут ненадёжен
function extractEmbeddedJson(html, marker) {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = html.indexOf('{', idx);
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < html.length && i - start < 2000000; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else {
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) { try { return JSON.parse(html.slice(start, i + 1)); } catch (_) { return null; } }
      }
    }
  }
  return null;
}

// Собрать все videoRenderer из дерева ytInitialData
function walkVideoRenderers(node, out, limit) {
  if (!node || typeof node !== 'object' || out.length >= limit) return;
  if (Array.isArray(node)) {
    for (const v of node) { walkVideoRenderers(v, out, limit); if (out.length >= limit) return; }
    return;
  }
  const v = node.videoRenderer;
  if (v && v.title) {
    const title = v.title.runs ? v.title.runs.map(r => r.text).join('') : (v.title.simpleText || '');
    out.push({
      videoId: v.videoId || '',
      title: stripTags(title).slice(0, 160),
      views: (v.viewCountText && v.viewCountText.simpleText) || (v.shortViewCountText && v.shortViewCountText.simpleText) || '',
      date: (v.publishedTimeText && v.publishedTimeText.simpleText) || '',
      author: (v.ownerText && v.ownerText.runs && v.ownerText.runs[0] && v.ownerText.runs[0].text) || ''
    });
  }
  for (const k in node) walkVideoRenderers(node[k], out, limit);
}

async function fetchHtml(url) {
  const res = await doFetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ru,en;q=0.8' },
    redirect: 'follow', signal: AbortSignal.timeout(FETCH_TIMEOUT)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.text();
}

// Конкретное видео: oEmbed (название/канал) + описание из ytInitialPlayerResponse
async function youtubeWatch(url) {
  const parts = [];
  try {
    const res = await doFetch('https://www.youtube.com/oembed?url=' + encodeURIComponent(url) + '&format=json', {
      headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.title) parts.push('Название: ' + data.title);
      if (data.author_name) parts.push('Канал: ' + data.author_name);
    }
  } catch (_) {}
  try {
    const html = await fetchHtml(url);
    const player = extractEmbeddedJson(html, 'ytInitialPlayerResponse');
    const details = player && player.videoDetails;
    if (details) {
      if (details.viewCount) parts.push('Просмотры: ' + details.viewCount);
      if (details.lengthSeconds) parts.push('Длительность: ~' + Math.round(details.lengthSeconds / 60) + ' мин');
      if (details.author) parts.push('Канал: ' + details.author);
      if (details.shortDescription) parts.push('Описание:\n' + String(details.shortDescription).slice(0, 2500));
    }
  } catch (_) {}
  if (!parts.length) throw new Error('не удалось извлечь данные видео');
  return 'YouTube видео (' + url + ')\n\n' + parts.join('\n\n');
}

// Канал / результаты поиска внутри YouTube / плейлист: список видео из ytInitialData
async function youtubeList(url) {
  const html = await fetchHtml(url);
  const data = extractEmbeddedJson(html, 'ytInitialData');
  const videos = [];
  if (data) walkVideoRenderers(data, videos, 12);
  if (!videos.length) throw new Error('не удалось извлечь список видео');
  const lines = videos.map((v, i) =>
    (i + 1) + '. ' + v.title +
    (v.author ? ' — ' + v.author : '') +
    (v.views ? ' · ' + v.views : '') +
    (v.date ? ' · ' + v.date : '') +
    (v.videoId ? '\n   https://youtu.be/' + v.videoId : '')
  );
  return 'YouTube (' + url + ')\n\n' + lines.join('\n');
}

async function fetchYouTube(url) {
  const u = new URL(url);
  const isWatch = u.hostname.replace(/^www\./, '') === 'youtu.be' ||
    /^\/watch$/.test(u.pathname) || u.pathname.startsWith('/shorts/');
  return isWatch ? youtubeWatch(url) : youtubeList(url);
}

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

  // YouTube (видео/каналы/поиск внутри YouTube) — специальный парсинг:
  // обычная выгрузка даёт JS-болванку, из которой после stripTags ничего не остаётся
  if (isYouTubeUrl(url)) {
    try {
      const yt = await fetchYouTube(url);
      log.info('[web] YouTube: данные получены (' + new URL(url).hostname + ')');
      return yt.length > PAGE_LIMIT ? yt.slice(0, PAGE_LIMIT) + '\n…[текст обрезан]' : yt;
    } catch (e) {
      log.info('[web] YouTube-парсинг не удался (' + e.message + ') — пробую читалку');
      try {
        const yt2 = await fetchViaReader(url);
        return '(получено через прокси-читалку r.jina.ai)\n\n' + yt2.slice(0, PAGE_LIMIT);
      } catch (_) { /* ниже — общий путь */ }
    }
  }

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

module.exports = { webSearch, fetchPage, setBlockedSites, setSearchMode, setSearchApiKey, finalizeSearch, isYouTubeUrl, extractEmbeddedJson, walkVideoRenderers, extractRedirectUrl };