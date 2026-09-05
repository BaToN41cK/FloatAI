// Веб-инструменты: поиск (Brave Search) и чтение страниц.
// Весь трафик идёт через doFetch (в Electron — net.fetch, уважает прокси из настроек).
const dns = require('dns').promises;
const log = require('./logger');
const { doFetch } = require('./electron-fetch');

const FETCH_TIMEOUT = 15000; // мс — чтобы поиск не зависал навечно

// Кэш поиска: повторный запрос за 10 минут отвечает мгновенно
const SEARCH_TTL = 10 * 60 * 1000;
const searchCache = new Map(); // query -> { ts, result }
const SEARCH_CACHE_MAX = 200;  // ограничение размера кэша

// Чёрный список сайтов меняется из настроек UI.
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

// --- Защита от SSRF: наружу можно, во внутренние/локальные адреса — нельзя ---

// Нормализация hostname: hex/octal/decimal-кодировки IPv4 -> привычный вид
function normalizeHost(h) {
  let host = String(h).toLowerCase().replace(/^\[|\]$/g, '');
  // Целиком в hex (0x7f000001) или decimal (2130706433)
  const whole = /^(0x[0-9a-f]+|\d+)$/i.exec(host);
  if (whole) {
    const n = whole[1].startsWith('0x') ? parseInt(whole[1], 16) : parseInt(whole[1], 10);
    if (!isNaN(n) && n <= 0xffffffff) {
      host = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    }
    return host;
  }
  // Смешанная запись: 0x7f.0.01 и т.п.
  if (/^(\d+|0x[0-9a-f]+)(\.(\d+|0x[0-9a-f]+)){1,3}$/i.test(host)) {
    const parts = host.split('.').map(p => p.startsWith('0x') ? parseInt(p, 16) : (p.length > 1 && p.startsWith('0') ? parseInt(p, 8) : parseInt(p, 10)));
    if (parts.length === 4 && parts.every(n => !isNaN(n) && n >= 0 && n <= 255)) {
      host = parts.join('.');
    }
  }
  return host;
}

// Является ли IP приватным/зарезервированным (IPv4 и IPv6)
function isPrivateIp(ip) {
  if (ip.includes(':')) {
    const l = ip.toLowerCase();
    if (l.startsWith('::ffff:')) {
      // IPv4-mapped IPv6: в т.ч. hex-форма ::ffff:7f00:1 == ::ffff:127.0.0.1
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
    if (l === '::1' || l === '::') return true;                  // loopback / unspecified
    if (l.startsWith('fe8') || l.startsWith('fe9') || l.startsWith('fea') || l.startsWith('feb')) return true; // link-local
    if (l.startsWith('fc') || l.startsWith('fd')) return true;   // unique local (ULA)
    return false;
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => isNaN(n))) return true; // не распарсили — считаем опасным
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;               // this-network, private, loopback
  if (a === 169 && b === 254) return true;                          // link-local
  if (a === 172 && b >= 16 && b <= 31) return true;                 // private
  if (a === 192 && b === 168) return true;                          // private
  if (a === 100 && b >= 64 && b <= 127) return true;                // CGNAT
  if (a >= 224) return true;                                        // multicast / reserved
  return false;
}

// Является ли строка IPv4-литералом (только цифры и точки)
function isIPv4Literal(s) { return /^\d{1,3}(\.\d{1,3}){3}$/.test(s); }

// Полная проверка URL: схема, hostname, IP-литералы + DNS-резолв hostname
async function isSafeUrl(urlStr) {
  let u;
  try { u = new URL(urlStr); } catch (_) { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const raw = u.hostname.toLowerCase();
  if (raw === 'localhost' || raw.endsWith('.local') || raw.endsWith('.internal')) return false;
  const host = normalizeHost(raw);
  // IP-литералы проверяем напрямую...
  if (isIPv4Literal(host) || host.includes(':')) {
    if (isPrivateIp(host)) return false;
  }
  // ...а hostname — через DNS (защита от DNS-rebinding)
  try {
    const addrs = await dns.lookup(host, { all: true, verbatim: true });
    if (addrs.some(a => isPrivateIp(normalizeHost(a.address)))) return false;
  } catch (_) { return false; } // не резолвится — наружу всё равно не ходим
  return true;
}

// Запрещённые из настроек приложения домены
function isBlockedSite(urlStr) {
  let h = '';
  try { h = new URL(urlStr).hostname.toLowerCase(); } catch (_) { return true; }
  return BLOCKED_SITES.some(b => h === b || h.endsWith('.' + b));
}

// Поиск: официальный Brave Search API (если задан ключ) — стабильный JSON
// вместо хрупкого парсинга HTML-выдачи. Бесплатный тариф: 2000 запросов/мес,
// ключ: https://brave.com/search/api/. Без ключа — резервный парсинг HTML.
let BRAVE_API_KEY = '';
function setBraveApiKey(key) {
  BRAVE_API_KEY = String(key || '').trim();
  if (BRAVE_API_KEY) log.info('[web] ключ Brave Search API задан — используется официальный API');
}

// Общая финализация: SSRF-фильтр результатов + формат ответа + кэш
async function finalizeSearch(query, rawResults) {
  const results = [];
  // Параллельная SSRF-проверка: DNS-резолв результата по одному был бы медленным.
  const safetyFlags = await Promise.all(rawResults.map((r) => isSafeUrl(r.url)));
  for (let i = 0; i < rawResults.length && results.length < MAX_SNIPPETS; i++) {
    if (safetyFlags[i]) results.push(rawResults[i]);
  }

  if (!results.length) return `По запросу «${query}» ничего не найдено (или поиск не отдал результаты).`;
  log.info(`[web] поиск «${query}»: ${results.length} результатов (Brave)`);
  const answer = 'Результаты поиска:\n' + results.map((r, n) =>
    `${n + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet || '(без описания)'}`
  ).join('\n');
  searchCache.set(String(query).trim().toLowerCase(), { ts: Date.now(), result: answer });
  // ограничиваем кэш линейным проходом (без сортировки на каждый промах)
  if (searchCache.size > SEARCH_CACHE_MAX) {
    let oldestKey = null, oldestTs = Infinity;
    for (const [k, v] of searchCache) {
      if (v.ts < oldestTs) { oldestTs = v.ts; oldestKey = k; }
    }
    if (oldestKey) searchCache.delete(oldestKey);
  }
  return answer;
}

// Официальный Brave Search API: JSON, предсказуемая структура
async function braveApiSearch(query) {
  const q = encodeURIComponent(String(query).slice(0, 400));
  const res = await doFetch(`https://api.search.brave.com/res/v1/web/search?q=${q}&count=${MAX_SNIPPETS}`, {
    headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': BRAVE_API_KEY },
    signal: AbortSignal.timeout(FETCH_TIMEOUT)
  });
  if (!res.ok) throw new Error(`Brave Search API недоступен (HTTP ${res.status})`);
  const data = await res.json();
  const items = (data.web && Array.isArray(data.web.results)) ? data.web.results : [];
  return items.slice(0, MAX_SNIPPETS * 2).map(r => ({
    title: stripTags(r.title || ''),
    url: String(r.url || ''),
    snippet: stripTags(r.description || '').slice(0, 300)
  })).filter(r => r.title && r.url);
}

// Резервный путь: парсинг HTML-выдачи без ключа
async function braveHtmlSearch(query) {
  const q = encodeURIComponent(String(query).slice(0, 300));
  const res = await doFetch('https://search.brave.com/search?q=' + q, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ru,en;q=0.8' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT)
  });
  if (!res.ok) throw new Error(`поиск недоступен (HTTP ${res.status})`);
  const html = await res.text();

  const rawResults = [];
  // Веб-результаты Brave: блоки class="result-content ..." со ссылкой и заголовком внутри.
  const chunks = html.split(/class="result-content[ "]/).slice(1);
  for (const chunk of chunks) {
    if (rawResults.length >= MAX_SNIPPETS * 3) break;
    const linkMatch = chunk.match(/<a[^>]+href="(https?:\/\/[^"]+)"/);
    if (!linkMatch) continue;
    const url = decodeEntities(linkMatch[1]);
    if (/imgs\.search\.brave\.com|search\.brave\.com/.test(url)) continue;
    const titleMatch = chunk.match(/class="title[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const title = titleMatch ? stripTags(titleMatch[1]) : '';
    if (!title) continue;
    const snipMatch = chunk.match(/clamp-dynamic[^>]*>([\s\S]*?)<\/div>/);
    rawResults.push({ title, url, snippet: snipMatch ? stripTags(snipMatch[1]).slice(0, 300) : '' });
  }
  return rawResults;
}

async function webSearch(query) {
  const key = String(query).trim().toLowerCase();
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.ts < SEARCH_TTL) {
    log.info('[web] поиск из кэша: ' + query);
    return cached.result;
  }

  let rawResults;
  if (BRAVE_API_KEY) {
    try {
      rawResults = await braveApiSearch(query);
    } catch (e) {
      log.warn('[web] Brave API не сработал (' + e.message + ') — пробую HTML-выдачу');
      rawResults = null;
    }
  }
  if (!rawResults) rawResults = await braveHtmlSearch(query);
  return finalizeSearch(query, rawResults);
}

// Чтение страницы: убираем скрипты/стили/теги, оставляем текст.
// Если страница не открылась напрямую (блокировка провайдера — например YouTube
// в РФ, бот-защита, региональные ограничения) — автоматически пробуем прокси-
// читалку r.jina.ai: она не заблокирована и возвращает текст страницы, включая
// мета-данные YouTube-каналов (название, описание, дата создания — «Joined»).
async function fetchViaReader(url) {
  const res = await doFetch('https://r.jina.ai/' + url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/plain' },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT * 2)
  });
  if (!res.ok) throw new Error(`прокси-читалка недоступна (HTTP ${res.status})`);
  const text = String(await res.text()).trim();
  if (!text) throw new Error('прокси-читалка вернула пустой текст');
  return text;
}

async function fetchPage(url) {
  if (!(await isSafeUrl(url))) return 'Ошибка: этот адрес открывать нельзя (только публичные http/https)';
  if (isBlockedSite(url)) return 'Ошибка: этот сайт в чёрном списке настроек и открывать его нельзя.';

  let text = '';
  let viaReader = false;
  try {
    const res = await doFetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!res.ok) throw new Error(`страница недоступна (HTTP ${res.status})`);
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
      log.info(`[web] не текстовый контент (${contentType.split(';')[0]}) — пробую прокси-читалку`);
    }
  } catch (e) {
    log.info(`[web] прямая загрузка не удалась (${e.message}) — пробую прокси-читалку r.jina.ai`);
  }

  // Резервный путь: прокси-читалка (обходит сетевые блокировки вроде YouTube в РФ)
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
  const prefix = viaReader ? '(получено через прокси-читалку r.jina.ai — прямой доступ к сайту заблокирован)\n\n' : '';
  log.info(`[web] получено ${Math.min(text.length, PAGE_LIMIT)} символов с ${new URL(url).hostname}${viaReader ? ' (через читалку)' : ''}`);
  return prefix + text.slice(0, PAGE_LIMIT) + (text.length > PAGE_LIMIT ? '\n…[текст обрезан]' : '');
}

module.exports = { webSearch, fetchPage, setBlockedSites, setBraveApiKey };
