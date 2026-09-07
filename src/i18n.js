// Централизованная локализация (i18n) для всех модулей.
// Поддерживаемые языки: ru (русский), en (английский).
const log = require('./logger');

let currentLang = 'ru';

const TRANSLATIONS = {
  ru: {
    'app.title': 'Window Helper',
    'app.loading': 'Загрузка...',
    'app.error': 'Ошибка',
    'app.ok': 'OK',
    'app.cancel': 'Отмена',
    'chat.placeholder': 'Введите сообщение...',
    'chat.send': 'Отправить',
    'chat.stop': 'Остановить',
    'chat.typing': 'Печатает...',
    'chat.thinking': 'Думает...',
    'chat.newDialog': 'Новый диалог',
    'chat.clearHistory': 'Очистить историю',
    'chat.error.network': 'Ошибка сети. Проверьте подключение.',
    'chat.error.timeout': 'Модель не ответила за отведённое время (таймаут).',
    'chat.error.empty': 'Модель вернула пустой ответ. Попробуйте переспросить.',
    'chat.error.rateLimit': 'Превышен лимит запросов. Подождите немного.',
    'settings.title': 'Настройки',
    'settings.provider': 'Провайдер',
    'settings.model': 'Модель',
    'settings.apiKey': 'API-ключ',
    'settings.language': 'Язык',
    'settings.opacity': 'Прозрачность',
    'settings.autostart': 'Автозапуск',
    'settings.voice': 'Голосовой ввод',
    'settings.deepThink': 'Глубокое размышление',
    'settings.plugins': 'Плагины',
    'settings.webSearch': 'Веб-поиск',
    'settings.proxy': 'Прокси',
    'settings.logTtl': 'Хранить логи (дней)',
    'diag.title': 'Диагностика',
    'diag.checkNet': 'Проверить сеть',
    'diag.checkProvider': 'Проверить провайдера',
    'diag.checkVoice': 'Проверить голос',
    'diag.copy': 'Скопировать диагностику',
    'voice.disabled': 'Голосовой ввод выключен в настройках',
    'voice.emptyAudio': 'Пустая аудиозапись',
    'voice.noKey': 'Нужен ключ распознавания речи.',
    'voice.cloud': 'Облачное распознавание',
    'voice.local': 'Локальное распознавание',
    'screenshot.select': 'Выдели область мышью · Esc — отмена',
    'screenshot.cancel': 'Отмена',
    'ocr.emptyText': 'Пустой текст со скриншота',
    'ollama.title': 'Менеджер моделей',
    'ollama.notRunning': 'Ollama не запущена',
    'ollama.pull': 'Скачать',
    'ollama.delete': 'Удалить',
    'ollama.downloading': 'Скачивание...',
    'ollama.ready': 'Готово',
    'ollama.error': 'Ошибка скачивания',
    'web.blocked': 'Веб-инструменты выключены в настройках.',
    'web.error.noQuery': 'Ошибка: не указан query',
    'web.error.noUrl': 'Ошибка: не указан url',
    'web.error.unsafeUrl': 'Ошибка: этот адрес открывать нельзя (только публичные http/https)',
    'web.error.blockedSite': 'Ошибка: этот сайт в чёрном списке настроек и открывать его нельзя.',
    'web.error.unknown': 'Ошибка: неизвестный инструмент {name}',
    'web.error.tool': 'Ошибка инструмента {name}: {error}',
    'web.noResults': 'Ничего не найдено. Попробуй переформулировать запрос или открыть конкретный сайт (например сайт:youtube.com название канала).',
    'web.searchAnswer': 'Вот что я нашёл:',
    'title.prompt': 'Придумай очень короткое название (3-5 слов) для диалога. Только название, без кавычек.\n\nСообщение: "{message}"',
    'title.fallback': 'Новый диалог',
    'compaction.prompt': 'Сожми фрагмент диалога в краткую сводку (3-8 предложений).\n\nФрагмент:\n{text}',
    'compaction.role.user': 'Пользователь',
    'compaction.role.assistant': 'Ассистент',
    'security.sensitiveTitle': 'Возможный секрет',
    'security.sensitiveMsg': 'В сообщении похожи на API-ключ, пароль или токен. Отправить?',
    'security.allow': 'Разрешить',
  },
  en: {
    'app.title': 'Window Helper',
    'app.loading': 'Loading...',
    'app.error': 'Error',
    'app.ok': 'OK',
    'app.cancel': 'Cancel',
    'chat.placeholder': 'Type a message...',
    'chat.send': 'Send',
    'chat.stop': 'Stop',
    'chat.typing': 'Typing...',
    'chat.thinking': 'Thinking...',
    'chat.newDialog': 'New conversation',
    'chat.clearHistory': 'Clear history',
    'chat.error.network': 'Network error. Check your connection.',
    'chat.error.timeout': 'Model did not respond in time (timeout).',
    'chat.error.empty': 'Model returned an empty response. Try again.',
    'chat.error.rateLimit': 'Rate limit exceeded. Wait a moment.',
    'settings.title': 'Settings',
    'settings.provider': 'Provider',
    'settings.model': 'Model',
    'settings.apiKey': 'API Key',
    'settings.language': 'Language',
    'settings.opacity': 'Opacity',
    'settings.autostart': 'Autostart',
    'settings.voice': 'Voice input',
    'settings.deepThink': 'Deep thinking',
    'settings.plugins': 'Plugins',
    'settings.webSearch': 'Web search',
    'settings.proxy': 'Proxy',
    'settings.logTtl': 'Keep logs (days)',
    'diag.title': 'Diagnostics',
    'diag.checkNet': 'Check network',
    'diag.checkProvider': 'Check provider',
    'diag.checkVoice': 'Check voice',
    'diag.copy': 'Copy diagnostics',
    'voice.disabled': 'Voice input is disabled in settings',
    'voice.emptyAudio': 'Empty audio',
    'voice.noKey': 'Voice recognition key required.',
    'voice.cloud': 'Cloud recognition',
    'voice.local': 'Local recognition',
    'screenshot.select': 'Select area with mouse · Esc — cancel',
    'screenshot.cancel': 'Cancel',
    'ocr.emptyText': 'Empty text from screenshot',
    'ollama.title': 'Model Manager',
    'ollama.notRunning': 'Ollama is not running',
    'ollama.pull': 'Download',
    'ollama.delete': 'Delete',
    'ollama.downloading': 'Downloading...',
    'ollama.ready': 'Ready',
    'ollama.error': 'Download error',
    'web.blocked': 'Web tools are disabled in settings.',
    'web.error.noQuery': 'Error: query is not specified',
    'web.error.noUrl': 'Error: URL is not specified',
    'web.error.unsafeUrl': 'Error: this URL cannot be opened (only public http/https)',
    'web.error.blockedSite': 'Error: this site is in the blocked list and cannot be opened.',
    'web.error.unknown': 'Error: unknown tool {name}',
    'web.error.tool': 'Tool {name} error: {error}',
    'web.noResults': 'Nothing found. Try rewording the query or opening a specific site (for example site:youtube.com channel name).',
    'web.searchAnswer': 'Here is what I found:',
    'title.prompt': 'Come up with a very short title (3-5 words) for a conversation. Only the title, no quotes.\n\nMessage: "{message}"',
    'title.fallback': 'New conversation',
    'compaction.prompt': 'Summarize the conversation fragment into a brief summary (3-8 sentences).\n\nFragment:\n{text}',
    'compaction.role.user': 'User',
    'compaction.role.assistant': 'Assistant',
    'security.sensitiveTitle': 'Possible secret',
    'security.sensitiveMsg': 'The message looks like an API key, password, or token. Send?',
    'security.allow': 'Allow',
  }
};

function setLanguage(lang) {
  if (TRANSLATIONS[lang]) {
    currentLang = lang;
    log.info(`[i18n] язык переключён на: ${lang}`);
  } else {
    log.warn(`[i18n] неизвестный язык: ${lang}, оставляем ${currentLang}`);
  }
}

function getLanguage() { return currentLang; }

function t(key, vars = {}) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.ru;
  let str = dict[key] || TRANSLATIONS.ru[key] || key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return str;
}

module.exports = { t, setLanguage, getLanguage, TRANSLATIONS };
