// Интерфейсные переводы: язык настроек/кнопок/подсказок.
// Агент сам подстраивается под язык пользователя — это только UI.
const T = {
  en: {
    'Модель': 'Model', 'Тема': 'Theme', 'Диагностика': 'Diagnostics', 'Прочее': 'Other',
    'Настройки': 'Settings', 'Персонализация': 'Personalization', 'Диалоги': 'Chats', '+ новый': '+ new',
    'Провайдер': 'Provider', 'API-ключ выбранного провайдера': 'API key of the selected provider',
    'Токены на один ответ (max_tokens)': 'Tokens per reply (max_tokens)',
    'Язык интерфейса': 'Interface language',
    'Поиск в интернете (выдача сайтов)': 'Web search (site results)',
    'Ключ Brave Search API': 'Brave Search API key',
    'Режим поиска': 'Search mode',
    'DuckDuckGo (бесплатный, без ключа)': 'DuckDuckGo (free, no key)',
    'Tavily (бесплатный ключ, 1000/мес)': 'Tavily (free key, 1000/month)',
    'Google CSE (бесплатный ключ, 100/день)': 'Google CSE (free key, 100/day)',
    'Brave Search (ключ, 2000/мес)': 'Brave Search (key, 2000/month)',
    'Ключ поискового API': 'Search API key',
    'DuckDuckGo работает сразу без ключа. Tavily, Google и Brave — требуют бесплатный ключ.': 'DuckDuckGo works immediately without a key. Tavily, Google and Brave require a free key.',
    'Получи бесплатно на app.tavily.com (1000 запросов/мес).': 'Get it free at app.tavily.com (1000 requests/month).',
    'Получи бесплатно на console.cloud.google.com (100 запросов/день).': 'Get it free at console.cloud.google.com (100 requests/day).',
    'Прозрачность окна': 'Window opacity', 'Размер шрифта': 'Font size',
    'Прокси (нужен перезапуск)': 'Proxy (restart required)',
    'Режим прокси (обход блокировок, без VPN)': 'Proxy mode (bypass blocks, no VPN)',
    'Встроенный прокси (наши серверы)': 'Built-in proxy (our servers)',
    'Свой прокси (Happ/v2rayN)': 'Own proxy (Happ/v2rayN)',
    'Без прокси': 'No proxy',
    'Свой прокси (нужен перезапуск)': 'Own proxy (restart required)',
    'Адрес своего AI API (для своего провайдера)': 'Custom AI API endpoint (custom provider)',
    'Чёрный список сайтов (через запятую)': 'Blocked sites (comma-separated)',
    'Глубокое размышление (думает дольше)': 'Deep thinking (takes longer)',
    'Расширенная диагностика': 'Extended diagnostics',
    'Запускать при входе в Windows': 'Start with Windows',
    'Плагин: поиск в интернете': 'Plugin: web search',
    'Плагин: чтение страниц': 'Plugin: page reading',
    'Скопировать диагностику': 'Copy diagnostics', 'Сохранить': 'Save', 'Сохранено ✓': 'Saved ✓',
    'Сохранено · прокси после перезапуска': 'Saved · proxy after restart',
    'Диагностика скопирована': 'Diagnostics copied',
    // Personality presets & diagnostics cards
    'Быстрые пресеты': 'Quick presets', 'Своя личность': 'Custom personality', 'Сбросить': 'Reset',
    'Проверить': 'Test', 'Интернет и прокси': 'Internet & proxy', 'Голосовой ввод': 'Voice input',
    'API-ключ и ответ модели': 'API key and model response',
    'Соединение, прокси и DNS': 'Connection, proxy and DNS',
    'Микрофон и распознавание речи': 'Microphone and speech recognition',
    'Нажми «Проверить» — результат появится здесь': 'Click “Test” — results will appear here',
    'Пресет применён — нажмите «Сохранить»': 'Preset applied — press “Save”',
    'Тёмная': 'Dark', 'Светлая': 'Light',
    'Сколько токенов модель может потратить на один ответ. Больше = длиннее и подробнее ответ.': 'How many tokens the model may spend on one reply. More = longer and more detailed.',
    'На каком языке показываются подписи и кнопки этого окна.': 'Language of labels and buttons in this window.',
    'Ключ даёт доступ, но не определяет модель. Модель выбирается отдельно.': 'The key grants access but does not pick the model. The model is chosen separately.',
    'Auto: разбор выдачи без ключа. Brave: стабильный официальный API — вставь свой ключ ниже.': 'Auto: parses results without a key. Brave: stable official API — paste your key below.',
    'Получи бесплатно на brave.com/search/api (2000 запросов/мес).': 'Get it free at brave.com/search/api (2000 requests/month).',
    'Happ/v2rayN: socks5://127.0.0.1:10808 (порт SOCKS) или http://127.0.0.1:10809 (порт HTTP).': 'Happ/v2rayN: socks5://127.0.0.1:10808 (SOCKS port) or http://127.0.0.1:10809 (HTTP port).',
    'Спроси что-нибудь…': 'Ask something…',
    'Голосовое сообщение: речь → текст (можно отредактировать перед отправкой)': 'Voice message: speech → text (editable before sending)',
    'Отправить': 'Send',
    // Ollama model manager
    'Скачанные модели': 'Downloaded models',
    'Скачать': 'Download',
    'Удалить': 'Delete',
    'Название модели (например, qwen2.5:7b)': 'Model name (e.g., qwen2.5:7b)',
    '⏳ Скачиваю...': '⏳ Downloading...',
    'Ollama не запущена': 'Ollama is not running',
    // Web tools
    'Веб-инструменты выключены': 'Web tools are disabled',
    'Ошибка: не указан query': 'Error: query is not specified',
    'Ошибка: не указан url': 'Error: URL is not specified',
    'Ошибка: этот адрес открывать нельзя': 'Error: this URL cannot be opened',
    'Ошибка: этот сайт заблокирован': 'Error: this site is blocked',
    'Ошибка инструмента': 'Tool error',
    // Web Speech
    'Распознавание речи: облако (если есть ключ) или браузер': 'Speech recognition: cloud (if key exists) or browser',
    // Search mode
    'Режим поиска': 'Search mode',
    'Авто (без ключа)': 'Auto (no key)',
    'Brave Search API': 'Brave Search API',
    // Cline-like API Settings
    'API Provider': 'API Provider',
    'Model': 'Model',
    'Reasoning Effort': 'Reasoning Effort',
    'API Key': 'API Key',
    'Context': 'Context',
    'Input': 'Input',
    'Output': 'Output',
    'Recommended': 'Recommended',
    'Free': 'Free',
    'Paid': 'Paid',
    'Local': 'Local',
    'Free Models': 'Free Models',
    'Low': 'Low',
    'Medium': 'Medium',
    'High-High': 'High-High',
    'Ключ даёт доступ к провайдеру. Модель выбирается отдельно.': 'The key grants access to the provider. The model is chosen separately.',
    '<b>Low</b> — короткие ответы с нужной информацией. <b>Medium</b> — информативно с пояснениями и уточняющими вопросами. <b>High</b> — максимально продуманный развёрнутый ответ с использованием ИИ-агента из персонализации.': '<b>Low</b> — short answers with needed info. <b>Medium</b> — informative with explanations and clarifying questions. <b>High</b> — maximally thoughtful detailed response using AI agent from personalization.',
    'Подключите провайдера для доступа к моделям': 'Connect a provider to access models',
  }
};

// 中文
T.zh = {
  'Модель': '模型', 'Тема': '主题', 'Диагностика': '诊断', 'Прочее': '其他',
  'Настройки': '设置', 'Персонализация': '个性化', 'Диалоги': '对话', '+ новый': '+ 新建',
  'Провайдер': '提供商', 'API-ключ выбранного провайдера': '所选提供商的 API 密钥',
  'Токены на один ответ (max_tokens)': '单次回复的令牌数 (max_tokens)',
  'Язык интерфейса': '界面语言',
  'Ключ Groq для распознавания речи (бесплатный)': '语音识别的 Groq 密钥（免费）',
  'Прозрачность окна': '窗口透明度', 'Размер шрифта': '字体大小',
  'Прокси (нужен перезапуск)': '代理（需重启）',
  'Адрес своего AI API (для своего провайдера)': '自定义 AI API 地址',
  'Чёрный список сайтов (через запятую)': '黑名单网站（逗号分隔）',
  'Глубокое размышление (думает дольше)': '深度思考（耗时更长）',
  'Расширенная диагностика': '扩展诊断',
  'Запускать при входе в Windows': '开机自启',
  'Плагин: поиск в интернете': '插件：联网搜索',
  'Плагин: чтение страниц': '插件：网页阅读',
  'Скопировать диагностику': '复制诊断信息', 'Сохранить': '保存', 'Сохранено ✓': '已保存 ✓',
  'Сохранено · прокси после перезапуска': '已保存 · 代理需重启生效',
  'Диагностика скопирована': '诊断信息已复制',
  // Personality presets & diagnostics cards
  'Быстрые пресеты': '快速预设', 'Своя личность': '自定义人设', 'Сбросить': '重置',
  'Проверить': '测试', 'Интернет и прокси': '网络与代理', 'Голосовой ввод': '语音输入',
  'API-ключ и ответ модели': 'API 密钥与模型响应',
  'Соединение, прокси и DNS': '连接、代理与 DNS',
  'Микрофон и распознавание речи': '麦克风与语音识别',
  'Нажми «Проверить» — результат появится здесь': '点击「测试」后结果会显示在这里',
  'Пресет применён — нажмите «Сохранить»': '已应用预设 — 请点击「保存」',
  'Тёмная': '深色', 'Светлая': '浅色',
  'Сколько токенов модель может потратить на один ответ. Больше = длиннее и подробнее ответ.': '模型单次回复可使用的令牌数。越多 = 回复越长越详细。',
  'На каком языке показываются подписи и кнопки этого окна.': '此窗口标签和按钮的显示语言。',
  'Ключ даёт доступ, но не определяет модель. Модель выбирается отдельно.': '密钥仅用于访问，模型需单独选择。',
  'Получи бесплатно на console.groq.com. Без ключа голос работает через Mistral Voxtral.': '在 console.groq.com 免费获取。无密钥时语音使用 Mistral Voxtral。',
  'Happ/v2rayN: socks5://127.0.0.1:10808 (порт SOCKS) или http://127.0.0.1:10809 (порт HTTP).': 'Happ/v2rayN：socks5://127.0.0.1:10808（SOCKS 端口）或 http://127.0.0.1:10809（HTTP 端口）。',
  'Спроси что-нибудь…': '输入问题…',
  'Голосовое сообщение: речь → текст (можно отредактировать перед отправкой)': '语音消息：语音 → 文字（发送前可编辑）',
  'Отправить': '发送',
    // Cline-like API Settings
    'API Provider': 'API 提供商',
    'Model': '模型',
    'Reasoning Effort': '推理努力',
    'API Key': 'API 密钥',
    'Context': '上下文',
    'Input': '输入',
    'Output': '输出',
    'Recommended': '推荐',
    'Free': '免费',
    'Paid': '付费',
    'Local': '本地',
    'Free Models': '免费模型',
    'Low': '低',
    'Medium': '中',
    'High-High': '高-高',
    'Ключ даёт доступ к провайдеру. Модель выбирается отдельно.': '密钥用于访问提供商。模型需单独选择。',
    '<b>Low</b> — короткие ответы с нужной информацией. <b>Medium</b> — информативно с пояснениями и уточняющими вопросами. <b>High</b> — максимально продуманный развёрнутый ответ с использованием ИИ-агента из персонализации.': '<b>Low</b> — 简短回答包含所需信息。<b>Medium</b> — 信息丰富，附带解释和澄清问题。<b>High</b> — 最周到详细的回答，使用个性化AI代理。',
    'Подключите провайдера для доступа к моделям': '连接提供商以访问模型',
    // Ollama model manager
    'Скачанные модели': '已下载的模型',
    'Скачать': '下载',
    'Удалить': '删除',
    'Название модели (например, qwen2.5:7b)': '模型名称（例如 qwen2.5:7b）',
    '⏳ Скачиваю...': '⏳ 下载中...',
    'Ollama не запущена': 'Ollama 未运行',
    // Web Speech
    'Распознавание речи: облако (если есть ключ) или браузер': '语音识别：云端（如有密钥）或浏览器',
    // Search mode
    'Режим поиска': '搜索模式',
    'Авто (без ключа)': '自动（无需密钥）',
    'Brave Search API': 'Brave Search API'
  };

export const LANG_NAMES = { ru: 'Русский', en: 'English', zh: '中文', de: 'Deutsch', es: 'Español', fr: 'Français' };

// Deutsch
T.de = {
  'Модель': 'Modell', 'Тема': 'Design', 'Диагностика': 'Diagnose', 'Прочее': 'Sonstiges',
  'Настройки': 'Einstellungen', 'Персонализация': 'Personalisierung', 'Диалоги': 'Chats', '+ новый': '+ neu',
  'Провайдер': 'Anbieter', 'API-ключ выбранного провайдера': 'API-Schlüssel des Anbieters',
  'Токены на один ответ (max_tokens)': 'Tokens pro Antwort (max_tokens)',
  'Язык интерфейса': 'Sprache der Oberfläche',
  'Ключ Groq для распознавания речи (бесплатный)': 'Groq-Schlüssel für Spracherkennung (kostenlos)',
  'Прозрачность окна': 'Fenstertransparenz', 'Размер шрифта': 'Schriftgröße',
  'Прокси (нужен перезапуск)': 'Proxy (Neustart nötig)',
  'Адрес своего AI API (для своего провайдера)': 'Eigene AI-API-Adresse',
  'Чёрный список сайтов (через запятую)': 'Sperrliste (mit Komma)',
  'Глубокое размышление (думает дольше)': 'Tiefes Nachdenken (dauert länger)',
  'Расширенная диагностика': 'Erweiterte Diagnose',
  'Запускать при входе в Windows': 'Mit Windows starten',
  'Плагин: поиск в интернете': 'Plugin: Internetsuche',
  'Плагин: чтение страниц': 'Plugin: Seitenlesen',
  'Скопировать диагностику': 'Diagnose kopieren', 'Сохранить': 'Speichern', 'Сохранено ✓': 'Gespeichert ✓',
  'Сохранено · прокси после перезапуска': 'Gespeichert · Proxy nach Neustart',
  'Диагностика скопирована': 'Diagnose kopiert',
  'Тёмная': 'Dunkel', 'Светлая': 'Hell',
  'Сколько токенов модель может потратить на один ответ. Больше = длиннее и подробнее ответ.': 'Wie viele Tokens das Modell pro Antwort verbrauchen darf. Mehr = ausführlicher.',
  'На каком языке показываются подписи и кнопки этого окна.': 'Sprache der Beschriftungen und Schaltflächen.',
  'Ключ даёт доступ, но не определяет модель. Модель выбирается отдельно.': 'Der Schlüssel gewährt Zugang, wählt aber kein Modell.',
  'Получи бесплатно на console.groq.com. Без ключа голос работает через Mistral Voxtral.': 'Kostenlos auf console.groq.com. Ohne Schlüssel: Mistral Voxtral.',
  'Happ/v2rayN: socks5://127.0.0.1:10808 (порт SOCKS) или http://127.0.0.1:10809 (порт HTTP).': 'Happ/v2rayN: socks5://127.0.0.1:10808 (SOCKS) oder http://127.0.0.1:10809 (HTTP).',
  'Спроси что-нибудь…': 'Frag etwas…',
  'Голосовое сообщение: речь → текст (можно отредактировать перед отправкой)': 'Sprachnachricht: Sprache → Text (vor dem Senden editierbar)',
  'Отправить': 'Senden'
};

// Español
T.es = {
  'Модель': 'Modelo', 'Тема': 'Tema', 'Диагностика': 'Diagnóstico', 'Прочее': 'Otros',
  'Настройки': 'Ajustes', 'Персонализация': 'Personalización', 'Диалоги': 'Chats', '+ новый': '+ nuevo',
  'Провайдер': 'Proveedor', 'API-ключ выбранного провайдера': 'Clave API del proveedor',
  'Токены на один ответ (max_tokens)': 'Tokens por respuesta (max_tokens)',
  'Язык интерфейса': 'Idioma de la interfaz',
  'Ключ Groq для распознавания речи (бесплатный)': 'Clave Groq para voz (gratis)',
  'Прозрачность окна': 'Opacidad de la ventana', 'Размер шрифта': 'Tamaño de fuente',
  'Прокси (нужен перезапуск)': 'Proxy (requiere reinicio)',
  'Адрес своего AI API (для своего провайдера)': 'Dirección propia de AI API',
  'Чёрный список сайтов (через запятую)': 'Sitios bloqueados (separados por coma)',
  'Глубокое размышление (думает дольше)': 'Pensamiento profundo (tarda más)',
  'Расширенная диагностика': 'Diagnóstico ampliado',
  'Запускать при входе в Windows': 'Iniciar con Windows',
  'Плагин: поиск в интернете': 'Plugin: búsqueda web',
  'Плагин: чтение страниц': 'Plugin: lectura de páginas',
  'Скопировать диагностику': 'Copiar diagnóstico', 'Сохранить': 'Guardar', 'Сохранено ✓': 'Guardado ✓',
  'Сохранено · прокси после перезапуска': 'Guardado · proxy tras reinicio',
  'Диагностика скопирована': 'Diagnóstico copiado',
  'Тёмная': 'Oscura', 'Светлая': 'Clara',
  'Сколько токенов модель может потратить на один ответ. Больше = длиннее и подробнее ответ.': 'Cuántos tokens puede gastar el modelo en una respuesta. Más = más largo y detallado.',
  'На каком языке показываются подписи и кнопки этого окна.': 'Idioma de las etiquetas y botones de esta ventana.',
  'Ключ даёт доступ, но не определяет модель. Модель выбирается отдельно.': 'La clave da acceso, no elige el modelo.',
  'Получи бесплатно на console.groq.com. Без ключа голос работает через Mistral Voxtral.': 'Consíguela gratis en console.groq.com. Sin ella, voz usa Mistral Voxtral.',
  'Happ/v2rayN: socks5://127.0.0.1:10808 (порт SOCKS) или http://127.0.0.1:10809 (порт HTTP).': 'Happ/v2rayN: socks5://127.0.0.1:10808 (SOCKS) o http://127.0.0.1:10809 (HTTP).',
  'Спроси что-нибудь…': 'Pregunta algo…',
  'Голосовое сообщение: речь → текст (можно отредактировать перед отправкой)': 'Mensaje de voz: voz → texto (editable antes de enviar)',
  'Отправить': 'Enviar'
};

// Français
T.fr = {
  'Модель': 'Modèle', 'Тема': 'Thème', 'Диагностика': 'Diagnostic', 'Прочее': 'Divers',
  'Настройки': 'Paramètres', 'Персонализация': 'Personnalisation', 'Диалоги': 'Discussions', '+ новый': '+ nouveau',
  'Провайдер': 'Fournisseur', 'API-ключ выбранного провайдера': 'Clé API du fournisseur',
  'Токены на один ответ (max_tokens)': 'Jetons par réponse (max_tokens)',
  'Язык интерфейса': 'Langue de l’interface',
  'Ключ Groq для распознавания речи (бесплатный)': 'Clé Groq pour la voix (gratuit)',
  'Прозрачность окна': 'Opacité de la fenêtre', 'Размер шрифта': 'Taille de police',
  'Прокси (нужен перезапуск)': 'Proxy (redémarrage requis)',
  'Адрес своего AI API (для своего провайдера)': 'Adresse AI API personnalisée',
  'Чёрный список сайтов (через запятую)': 'Sites bloqués (séparés par virgule)',
  'Глубокое размышление (думает дольше)': 'Réflexion profonde (plus long)',
  'Расширенная диагностика': 'Diagnostic étendu',
  'Запускать при входе в Windows': 'Lancer avec Windows',
  'Плагин: поиск в интернете': 'Plugin : recherche web',
  'Плагин: чтение страниц': 'Plugin : lecture de pages',
  'Скопировать диагностику': 'Copier le diagnostic', 'Сохранить': 'Enregistrer', 'Сохранено ✓': 'Enregistré ✓',
  'Сохранено · прокси после перезапуска': 'Enregistré · proxy après redémarrage',
  'Диагностика скопирована': 'Diagnostic copié',
  'Тёмная': 'Sombre', 'Светлая': 'Claire',
  'Сколько токенов модель может потратить на один ответ. Больше = длиннее и подробнее ответ.': 'Combien de jetons le modèle peut dépenser par réponse. Plus = plus long et détaillé.',
  'На каком языке показываются подписи и кнопки этого окна.': 'Langue des libellés et boutons de cette fenêtre.',
  'Ключ даёт доступ, но не определяет модель. Модель выбирается отдельно.': 'La clé donne l’accès, le modèle se choisit à part.',
  'Получи бесплатно на console.groq.com. Без ключа голос работает через Mistral Voxtral.': 'Gratuit sur console.groq.com. Sans elle, la voix utilise Mistral Voxtral.',
  'Happ/v2rayN: socks5://127.0.0.1:10808 (порт SOCKS) или http://127.0.0.1:10809 (порт HTTP).': 'Happ/v2rayN : socks5://127.0.0.1:10808 (SOCKS) ou http://127.0.0.1:10809 (HTTP).',
  'Спроси что-нибудь…': 'Pose ta question…',
  'Голосовое сообщение: речь → текст (можно отредактировать перед отправкой)': 'Message vocal : parole → texte (modifiable avant envoi)',
  'Отправить': 'Envoyer'
};

const originalText = new WeakMap();
const originalAttributes = new WeakMap();

function translateText(node, dict) {
  if (!originalText.has(node)) originalText.set(node, node.textContent);
  const source = originalText.get(node);
  node.textContent = dict && dict[source] !== undefined ? dict[source] : source;
}

function translateAttribute(node, attribute, dict) {
  let values = originalAttributes.get(node);
  if (!values) {
    values = {};
    originalAttributes.set(node, values);
  }
  if (!(attribute in values)) values[attribute] = node.getAttribute(attribute);
  const source = values[attribute];
  if (source !== null) node.setAttribute(attribute, dict && dict[source] !== undefined ? dict[source] : source);
}

// Применить язык интерфейса ко всем статичным надписям окна.
export function applyLang(lang) {
  const dict = lang === 'ru' ? null : T[lang];
  if (lang !== 'ru' && !dict) return;
  // Вкладки, кнопки панелей, заголовки, кнопки ввода
  document.querySelectorAll('.settings-nav button, .panel-btn, .info-panel > b, #btnMic, #btnSend, .diag-title, .diag-sub, .section-title')
    .forEach(el => { if (!el.children.length) translateText(el, dict); });
  // Подписи label: текстовые узлы (captions и тексты чекбоксов)
  document.querySelectorAll('.settings-form label').forEach(label => {
    label.childNodes.forEach(n => { if (n.nodeType === Node.TEXT_NODE && n.textContent.trim()) translateText(n, dict); });
  });
  // Подсказки под полями
  document.querySelectorAll('.field-hint').forEach(h => {
    translateText(h, dict);
  });
  // Плейсхолдеры и подсказки-тайтлы
  document.querySelectorAll('[placeholder]').forEach(el => {
    translateAttribute(el, 'placeholder', dict);
  });
  document.querySelectorAll('[title]').forEach(el => {
    translateAttribute(el, 'title', dict);
  });
  // Опции темы
  document.querySelectorAll('#setTheme option').forEach(o => translateText(o, dict));
}

export function t(lang, text) {
  if (lang === 'ru') return text;
  return (T[lang] && T[lang][text]) || text;
}
