// Загрузка и умная выборка personality.md — используется как system prompt.
// Файл кэшируется после первой загрузки (не читаем диск на каждое сообщение),
// а по теме вопроса отбираются только релевантные секции — чтобы не слать весь
// файл (~7К токенов) на каждый запрос: ответ быстрее и дешевле, характер целее.

const fs = require('fs');
const path = require('path');

const PERSONALITY_FILE = path.join(__dirname, '..', 'config', 'personality.md');
const DEFAULT_PERSONALITY = 'Ты — полезный ассистент. Отвечай на языке пользователя.';
const MAX_PERSONALITY_CHARS = 5000;

// Верхний порог размера выбранной личности (символов), чтобы system prompt
// никогда не разрастался до больших размеров, даже при «горячей» теме.
const SELECTION_MAX_CHARS = 5000;

let _cache = null; // { full, sections: [{ name, text }] }
let _corePrompt = null; // стабильный system prompt, собирается один раз при старте

// Разбиение файла на секции по заголовкам '## '. Заголовки '###' остаются внутри
// родительской секции, чтобы выборка не рвала структуру.
function parseSections(text) {
  const lines = text.split('\n');
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      const name = line.replace(/^##\s+/, '').trim();
      current = { name, text: line };
      sections.push(current);
    } else if (current) {
      current.text += '\n' + line;
    }
  }
  return sections;
}

function load() {
  if (_cache) return _cache;
  try {
    const text = fs.readFileSync(PERSONALITY_FILE, 'utf-8').trim();
    if (text) _cache = { full: text, sections: parseSections(text) };
  } catch (e) {
    console.warn('[personality] personality.md не найден, используется дефолтный характер');
  }
  if (!_cache) _cache = { full: DEFAULT_PERSONALITY, sections: [] };
  return _cache;
}

// Принудительно перечитать файл (не используется в рантайме, но удобно в тестах)
function reload() { _cache = null; _corePrompt = null; return load().full; }

function validatePersonality(text) {
  const value = String(text || '').trim();
  const warnings = [];
  if (!value) return { ok: false, errors: ['Личность не может быть пустой'], warnings };
  if (value.length > MAX_PERSONALITY_CHARS) return { ok: false, errors: [`Личность слишком большая (максимум ${MAX_PERSONALITY_CHARS} символов)`], warnings };
  if (!/^#|^##/m.test(value)) warnings.push('Добавь заголовок Markdown, чтобы структуру было проще читать.');
  if (/api[_ -]?key|парол|password|секрет|token\s*[:=]/i.test(value)) warnings.push('Проверь, что в личности нет API-ключей, паролей или токенов.');
  return { ok: true, errors: [], warnings };
}

function getPersonalityText() {
  try { return fs.readFileSync(PERSONALITY_FILE, 'utf-8'); } catch (_) { return DEFAULT_PERSONALITY; }
}

function savePersonality(text) {
  const check = validatePersonality(text);
  if (!check.ok) throw new Error(check.errors.join('; '));
  fs.mkdirSync(path.dirname(PERSONALITY_FILE), { recursive: true });
  fs.writeFileSync(PERSONALITY_FILE, String(text).trim() + '\n', 'utf-8');
  reload();
  return { text: getPersonalityText(), ...check };
}

function resetPersonality() {
  fs.mkdirSync(path.dirname(PERSONALITY_FILE), { recursive: true });
  fs.writeFileSync(PERSONALITY_FILE, DEFAULT_PERSONALITY + '\n', 'utf-8');
  reload();
  return { text: getPersonalityText(), ok: true, errors: [], warnings: [] };
}

// Заголовки секций, которые включаются ВСЕГДА — это «скелет» личности Неко.
const ALWAYS_SECTIONS = new Set(['Личность', 'Приоритеты инструкций', 'Контекст о Сергее', 'Формат и принципы']);

// Ключевые слова секций: если вопрос их содержит, секция актуальна.
// Чем больше совпадений — тем выше приоритет секции.
const SECTION_KEYWORDS = {
  'Интересы': ['аниме', 'anime', 'манга', 'manga', 'музыка', 'music', 'песн', 'песн', 'саундтрек', 'фильм', 'фильма', 'игр', 'игре', 'игру', 'книг', 'скриншот', 'скрин', 'screenshot', 'ocr', 'картинк', 'изображен', 'фото'],
  'Работа с инструментами': ['в интернете', 'поиск', 'найди', 'найти', 'погод', 'новост', 'ссылк', 'url', 'tldr', 'сайт', 'страниц', 'документац', 'код', 'кода', 'ошибк', 'error', 'баг', 'bug', 'javascript', 'python', 'typescript', 'html', 'css', 'задач', 'задани', 'домашк', 'учись', 'php', 'go ', 'rust', 'sql'],
  'Состояния и динамическая память': ['как дела', 'как ты', 'устал', 'грустно', 'плохо', 'хорошо день', 'утомлен', 'настроени', 'спать', 'сон'],
  'Проверка роли': ['кто ты', 'ты кто', 'неко', 'характер', 'себя вести', 'правила'],
  'Контекст о Сергее': ['серёж', 'сергей', 'сережа', 'меня зовут', 'мой любим']
};

// Строка, по которой ищем совпадения: вопрос + последнее сообщение истории.
function queryKey(text) { return String(text || '').toLowerCase(); }

// Умная выборка ОТКЛЮЧЕНА: личность всегда полная и постоянная (см. corePrompt).
// Функция оставлена для совместимости — всегда возвращает весь файл.
function selectPersonality(question, historyTail) {
  return load().full;
}

// Полная версия личности (для совместимости / когда нужен весь файл)
function loadPersonality() { return load().full; }

// Стабильный «системный промпт» — читается ОДИН раз при старте и содержит ВЕСЬ
// файл личности целиком. Никакой выборки секций под запрос: Неко всегда помнит
// всё (характер, интересы, контекст о Сергее, правила) в каждом сообщении.
// Это и есть «постоянная память» — личность никогда не вызывается «по требованию»,
// она просто всегда есть в диалоге.
function corePrompt() {
  if (_corePrompt) return _corePrompt;
  _corePrompt = load().full;
  return _corePrompt;
}

module.exports = { loadPersonality, selectPersonality, corePrompt, reload, getPersonalityText, savePersonality, resetPersonality, validatePersonality };
