const PLUGINS = {
  webSearch: { label: 'Поиск в интернете', description: 'Искать актуальные сведения через Brave' },
  fetchPage: { label: 'Чтение страниц', description: 'Открывать найденные страницы и извлекать текст' }
};

function enabledTools(options = {}) {
  const tools = [];
  if (options.webSearch !== false) tools.push('web_search');
  if (options.fetchPage !== false) tools.push('fetch_page');
  return tools;
}

module.exports = { PLUGINS, enabledTools };
