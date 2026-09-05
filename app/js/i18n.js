// Интерфейсные переводы: язык настроек/кнопок/подсказок.
// Неко сама подстраивается под язык пользователя — это только UI.
const T = {
  en: {
    'Модель': 'Model', 'Тема': 'Theme', 'Диагностика': 'Diagnostics', 'Прочее': 'Other',
    'Настройки': 'Settings', 'Персонализация': 'Personalization', 'Диалоги': 'Chats', '+ новый': '+ new',
    'Провайдер': 'Provider', 'API-ключ выбранного провайдера': 'API key of the selected provider',
    'Токены на один ответ (max_tokens)': 'Tokens per reply (max_tokens)',
    'Язык интерфейса': 'Interface language',
    'Ключ Groq для распознавания речи (бесплатный)': 'Groq key for speech recognition (free)',
    'Прозрачность окна': 'Window opacity', 'Размер шрифта': 'Font size',
    'Прокси (нужен перезапуск)': 'Proxy (restart required)',
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
    'Тёмная': 'Dark', 'Светлая': 'Light',
    'Сколько токенов модель может потратить на один ответ. Больше = длиннее и подробнее ответ.': 'How many tokens the model may spend on one reply. More = longer and more detailed.',
    'На каком языке показываются подписи и кнопки этого окна.': 'Language of labels and buttons in this window.',
    'Ключ даёт доступ, но не определяет модель. Модель выбирается отдельно.': 'The key grants access but does not pick the model. The model is chosen separately.',
    'Получи бесплатно на console.groq.com. Без ключа голос работает через Mistral Voxtral.': 'Get it free at console.groq.com. Without it, voice uses Mistral Voxtral.',
    'Happ/v2rayN: socks5://127.0.0.1:10808 (порт SOCKS) или http://127.0.0.1:10809 (порт HTTP).': 'Happ/v2rayN: socks5://127.0.0.1:10808 (SOCKS port) or http://127.0.0.1:10809 (HTTP port).',
    'Спроси что-нибудь…': 'Ask something…',
    'Голосовое сообщение: речь → текст (можно отредактировать перед отправкой)': 'Voice message: speech → text (editable before sending)',
    'Отправить': 'Send'
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
  'Тёмная': '深色', 'Светлая': '浅色',
  'Сколько токенов модель может потратить на один ответ. Больше = длиннее и подробнее ответ.': '模型单次回复可使用的令牌数。越多 = 回复越长越详细。',
  'На каком языке показываются подписи и кнопки этого окна.': '此窗口标签和按钮的显示语言。',
  'Ключ даёт доступ, но не определяет модель. Модель выбирается отдельно.': '密钥仅用于访问，模型需单独选择。',
  'Получи бесплатно на console.groq.com. Без ключа голос работает через Mistral Voxtral.': '在 console.groq.com 免费获取。无密钥时语音使用 Mistral Voxtral。',
  'Happ/v2rayN: socks5://127.0.0.1:10808 (порт SOCKS) или http://127.0.0.1:10809 (порт HTTP).': 'Happ/v2rayN：socks5://127.0.0.1:10808（SOCKS 端口）或 http://127.0.0.1:10809（HTTP 端口）。',
  'Спроси что-нибудь…': '输入问题…',
  'Голосовое сообщение: речь → текст (можно отредактировать перед отправкой)': '语音消息：语音 → 文字（发送前可编辑）',
  'Отправить': '发送'
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
  document.querySelectorAll('.settings-nav button, .panel-btn, .info-panel > b, #btnMic, #btnSend')
    .forEach(el => translateText(el, dict));
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