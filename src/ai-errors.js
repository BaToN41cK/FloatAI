function isNetworkError(message) {
  const value = String(message || '');
  return /net::ERR_(?!ABORTED)/.test(value) || value.includes('fetch failed') || /HTTP (500|502|503|504)/.test(value);
}

function isRateLimitError(message) {
  const value = String(message || '');
  return value.includes('429') || value.includes('rate_limited');
}

// Z.ai отклоняет запрос на перегруженную (особенно бесплатную Flash) модель:
// HTTP 429, code 1305, "该模型当前访问量过大，请您稍后再试".
// Это серверная перегрузка модели, а не проблема ключа/баланса.
function isZaiOverload(message) {
  const value = String(message || '');
  return /1305|访问量过大|当前访问量|access[ _-]?(volume|overflow)|too (many|high) (users|traffic|volume)|traffic currently/i.test(value);
}

function friendlyError(message) {
  const value = String(message || '');
  if (value.includes('ERR_PROXY_CONNECTION_FAILED')) return 'Прокси не отвечает — проверь HTTPS_PROXY в настройках';
  if (value.includes('ERR_TUNNEL_CONNECTION_FAILED')) return 'Прокси не смог выйти в интернет — проверь сеть и прокси';
  if (isNetworkError(value)) return 'Нет соединения с интернетом — проверь сеть и попробуй снова';
  if (value.includes('401')) return 'Неверный API-ключ — проверь ключ выбранного провайдера в настройках';
  if (value.includes('tier_not_allowed') || value.includes('403')) return 'Эта модель недоступна на твоём тарифе — выбери другую модель';
  if (isZaiOverload(value)) return 'Модель Z.ai сейчас перегружена (лимит бесплатной версии). Подожди немного и попробуй снова или выбери другую бесплатную модель (GLM-4.5-Flash)';
  if (isRateLimitError(value)) return 'Провайдер ограничил запросы. Проверь лимиты и баланс API-ключа';
  return value;
}

module.exports = { isNetworkError, isRateLimitError, isZaiOverload, friendlyError };
