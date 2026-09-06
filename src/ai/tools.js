// Вызов инструментов (web_search, fetch_page) для tool-calling цикла.
const { webSearch, fetchPage } = require('../web-tools');
const log = require('../logger');

// Запустить один вызов инструмента
async function runTool(name, argsStr, onWebStatus, onToolPermission) {
  let args = {};
  try { args = JSON.parse(argsStr); } catch (_) {}
  
  if (name === 'web_search') {
    const q = args.query || args.q || '';
    if (onWebStatus) onWebStatus('🔍 ищу: ' + q);
    return await webSearch(q, { blockedSites: args.blockedSites });
  }
  if (name === 'fetch_page') {
    const url = args.url || args.link || '';
    if (onWebStatus) onWebStatus('📄 открываю: ' + url);
    return await fetchPage(url);
  }
  // Можно добавить другие инструменты здесь (run_command, read_file и т.д.)
  return `Неизвестный инструмент: ${name}`;
}

// Преобразовать tool_calls из ответа модели в массив для следующего запроса
function buildToolMessages(toolCalls) {
  return toolCalls.map(tc => ({
    id: tc.id || `call_${tc.index}`,
    type: 'function',
    function: { name: tc.name, arguments: tc.arguments }
  }));
}

// Преобразовать результаты выполнения в tool-сообщения
function buildToolResults(toolCalls) {
  return toolCalls.map(call => ({
    role: 'tool',
    tool_call_id: call.id,
    name: call.function.name,
    content: String(call.result).slice(0, 6000)
  }));
}

module.exports = { runTool, buildToolMessages, buildToolResults };
