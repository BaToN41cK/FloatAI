const { t } = require('./i18n');
const { webSearch, fetchPage } = require('./web-tools');
const log = require('./logger');

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Поиск в интернете (как поисковик). Возвращает заголовки, ссылки и краткие описания страниц. Используй, когда нужны актуальные данные: цены, новости, погода, existence/названия песен, фильмов, игр и т.п.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Поисковый запрос' } },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fetch_page',
      description: 'Скачать текст веб-страницы по URL и вернуть его содержимое (первые ~4000 символов). Используй после web_search, если сниппета не хватило.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'Полный URL страницы (http/https)' } },
        required: ['url']
      }
    }
  }
];

async function runTool(name, argsJson, onStatus, onPermission) {
  if (typeof onPermission === 'function' && !(await onPermission(name, argsJson))) {
    return t('web.blocked');
  }
  let args = {};
  try { args = JSON.parse(argsJson || '{}'); } catch (_) {}
  try {
    if (name === 'web_search') {
      if (!args.query) return t('web.error.noQuery');
      if (onStatus) onStatus(`ищу в интернете: ${args.query}`);
      log.info(`[web] поиск: ${args.query}`);
      return await webSearch(args.query);
    }
    if (name === 'fetch_page') {
      if (!args.url) return t('web.error.noUrl');
      if (onStatus) onStatus('открываю страницу из результатов поиска…');
      log.info(`[web] страница: ${args.url}`);
      return await fetchPage(args.url);
    }
    return t('web.error.unknown', { name });
  } catch (e) {
    log.warn('[web]', name, e.message);
    return t('web.error.tool', { name, error: e.message });
  }
}

module.exports = { TOOLS, runTool };
