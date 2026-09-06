// Парсинг ответов AI-провайдеров: извлечение текста из разных форматов.

// Извлечь текст ответа из ответа OpenAI-совместимого формата
function extractReplyText(data, provider) {
  if (!data) return '';
  // OpenAI / Mistral / Groq / OpenRouter / Cerebras
  if (data.choices && data.choices[0]) {
    const msg = data.choices[0].message;
    if (msg && msg.content) return String(msg.content);
  }
  // Anthropic: content — массив блоков, склеиваем все text-блоки. Поле type
  // может быть пропущено в тестах и устаревших ответах — берём любой блок с .text.
  if (data.content && Array.isArray(data.content)) {
    return data.content
      .filter(c => c && c.text && (c.type === undefined || c.type === 'text'))
      .map(c => String(c.text))
      .join('');
  }
  // Google: candidates[0].content.parts — склеиваем все text-блоки
  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    const parts = (data.candidates[0].content && data.candidates[0].content.parts) || [];
    return parts.filter(p => p && p.text).map(p => String(p.text)).join('');
  }
  // Fallback
  if (typeof data === 'string') return data;
  return '';
}

// Нормализация текста для кэша (нижний регистр, убрать лишние пробелы)
function normalizeForCache(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

module.exports = { extractReplyText, normalizeForCache };
