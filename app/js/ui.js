// UI-хелперы и состояние стриминга (общие для всех модулей renderer).
// Никакой специфики фич — только базовая работа с DOM и markdown.

export const $ = (id) => document.getElementById(id);

const messages = $('messages');
const statusBar = $('statusBar');

if (window.marked) window.marked.setOptions({ breaks: true, gfm: true });

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function renderMarkdown(el, text) {
  el.classList.add('md');
  try { el.innerHTML = window.marked ? window.marked.parse(text) : escapeHtml(text); }
  catch (_) { el.innerHTML = escapeHtml(text); }
}

export function scrollDown() { messages.scrollTop = messages.scrollHeight; }

export function setStatus(text) { statusBar.textContent = text || ''; }
export function getStatus() { return statusBar.textContent; }

export function setApiDot(state) {
  const dot = $('apiDot');
  if (!dot) return;
  dot.classList.remove('ok', 'fail');
  if (state) dot.classList.add(state);
}

export function addMsg(text, cls) {
  const div = document.createElement('div');
  div.className = 'msg ' + cls;
  if ((cls === 'assistant' || cls === 'user') && text) {
    const inner = document.createElement('div');
    inner.className = cls === 'assistant' ? 'md' : '';
    div.appendChild(inner);
    if (cls === 'assistant') renderMarkdown(inner, text);
    else inner.textContent = text;
  } else {
    div.textContent = text;
  }
  messages.appendChild(div);
  scrollDown();
  return div;
}

export function addOcrDetails(ocrText) {
  const details = document.createElement('details');
  details.className = 'details';
  const sum = document.createElement('summary');
  sum.textContent = '📄 Распознанный текст (может содержать ошибки OCR)';
  const body = document.createElement('div');
  body.className = 'ocr-text';
  body.textContent = ocrText;
  details.appendChild(sum);
  details.appendChild(body);
  messages.appendChild(details);
  scrollDown();
  return details;
}

export function applyTheme(theme) {
  document.body.dataset.theme = theme === 'light' ? 'light' : 'dark';
}

export function applyFontSize(size) {
  document.documentElement.style.setProperty('--chat-font-size', `${Number(size) || 13}px`);
}

export function greetingText() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Доброе утро, Серёжа! ☀️ Чем могу помочь?';
  if (h >= 12 && h < 18) return 'Добрый день, Серёжа! Чем займёмся?';
  if (h >= 18 && h < 23) return 'Добрый вечер, Серёжа! Чем помочь?';
  return 'Не спится, Серёжа? Могу составить компанию 🐾';
}

// --- Состояние стриминга: markdown пересобираем не на каждый токен, а раз в кадр ---
let streaming = false;
let activeReplyDiv = null;   // текущий ответ Неко
let activeRawMd = '';        // сырой markdown текущего ответа
let renderFrame = 0;         // id requestAnimationFrame для троттлинга
let streamMd = null;         // элемент, ждущий отрисовки

export const stream = {
  isStreaming() { return streaming; },
  setStreaming(on) { streaming = on; $('btnSend').disabled = on; scrollDown(); },
  // Начало нового ответа: создаём блок-заглушку
  beginReply() { activeRawMd = ''; activeReplyDiv = addMsg('печатает…', 'assistant'); return activeReplyDiv; },
  appendChunk(chunk) {
    if (!activeReplyDiv) return;
    // Первый реальный чанк: сбрасываем предварительный peek-ответ (его подставили),
    // чтобы финальный стриминг начался с чистого блока.
    const isFirst = activeRawMd === '';
    activeRawMd += chunk;
    const md = activeReplyDiv.querySelector('.md');
    if (isFirst || md.textContent === 'печатает…') md.textContent = '';
    md.classList.remove('md');
    md.textContent = activeRawMd;
    streamMd = md;
    if (!renderFrame) {
      renderFrame = requestAnimationFrame(() => {
        renderFrame = 0;
        if (streamMd) renderMarkdown(streamMd, streamMd.textContent);
      });
    }
    $('tokenStatus').textContent = `токены: ~${Math.ceil(activeRawMd.length / 3)}`;
    scrollDown();
  },
  commitReply() {
    if (renderFrame) { cancelAnimationFrame(renderFrame); renderFrame = 0; }
    if (streamMd) { renderMarkdown(streamMd, streamMd.textContent); streamMd = null; }
    activeReplyDiv = null;
    activeRawMd = '';
    $('tokenStatus').textContent = '';
  },
  failReply() {
    if (renderFrame) { cancelAnimationFrame(renderFrame); renderFrame = 0; }
    streamMd = null;
    if (activeReplyDiv) activeReplyDiv.remove();
    activeReplyDiv = null;
    activeRawMd = '';
    $('tokenStatus').textContent = '';
  }
};