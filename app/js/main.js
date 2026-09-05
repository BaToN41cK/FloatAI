// Точка входа renderer: оркестрирует модули (ui, models, ocr, voice, settings).
import { $, addMsg, setStatus, getStatus, setApiDot, stream, greetingText, applyTheme, applyFontSize } from './ui.js';
import { hasPendingImage, handleImageSend, initImageInputs, importScreenshot } from './ocr.js';
import { initVoice } from './voice.js';
import { initSettings } from './settings.js';
import { applyLang } from './i18n.js';

function loadMessages() {
  const messages = document.getElementById('messages');
  messages.innerHTML = '';
  window.api.getHistory().then(history => {
    for (const m of history) addMsg(m.content, m.role === 'user' ? 'user' : 'assistant');
    // Приветствие при запуске отключено по запросу пользователя
    window.__greeted = true;
    $('input').focus();
  });
}

// Слушатели стриминга — регистрируются ОДИН раз при старте
// (не внутри send: иначе обработчики накапливаются).
window.api.onChunk(chunk => stream.appendChunk(chunk));
window.api.onDone(() => {
  stream.commitReply();
  stream.setStreaming(false);
  setStatus('');
  setApiDot('ok');
  $('input').focus();
});
window.api.onError((err) => {
  const isObj = err && typeof err === 'object';
  const text = isObj ? err.text : err;
  const network = isObj ? !!err.network : true;
  stream.failReply();
  addMsg('Ошибка: ' + text, 'error');
  stream.setStreaming(false);
  setStatus('');
  setApiDot(network ? '' : 'ok');
});
window.api.onWebStatus(text => setStatus('🌐 ' + text));
window.api.onScreenshot(png => { try { importScreenshot(png); } catch (e) { console.warn(e); } });
// Мгновенный предварительный ответ (простой вопрос) — сразу вместо «печатает…»,
// чтобы интерфейс не молчал, пока модель думает полный ответ.
window.api.onPeek((peek) => {
  if (!peek) return;
  if (getStatus() === '🟡 Неко думает…') setStatus('');
  const messages = document.getElementById('messages');
  const el = messages.querySelector('.msg.assistant .md') || messages.querySelector('.msg.assistant');
  if (el) { el.textContent = peek; el.classList.add('md'); }
});
// Ответ начал приходить — снимаем статус «думает», чтобы не выглядело как зависание
window.api.onFirstToken(() => { if (getStatus() === '🟡 Неко думает…') setStatus(''); });
window.api.onUpdateReady((info) => {
  setStatus(`обновление ${info.version} готово — установится при выходе (Ctrl+Shift+Q)`);
});

async function send() {
  const input = $('input');
  const text = input.value.trim();
  if (!text && !hasPendingImage()) return;
  if (stream.isStreaming()) return;
  if (text && !(await window.api.confirmSensitive(text))) return;
  if (hasPendingImage()) { await handleImageSend(text); return; }
  input.value = '';
  addMsg(text, 'user');
  stream.beginReply();
  stream.setStreaming(true);
  setStatus('🟡 Неко думает…'); // честный статус до первого токена (снимеется via onFirstToken)
  window.api.sendChat(text);
}
$('btnSend').addEventListener('click', send);
$('input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});

// --- Индикатор связи: работает → 🟢, не работает → ⚪ ---
let netBusy = false;
async function netDot() {
  if (netBusy) return;
  netBusy = true;
  try {
    const r = await window.api.netCheck();
    if (r === 'ok') {
      setApiDot('ok');
      if (getStatus() === 'нет соединения') setStatus('');
    } else {
      setApiDot('');
      setStatus('нет соединения');
    }
  } finally { netBusy = false; }
}
window.addEventListener('online', netDot);
window.addEventListener('offline', netDot);
setInterval(netDot, 20000);
netDot();

// --- Прозрачность: Ctrl + колесо мыши ---
window.addEventListener('wheel', e => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  window.api.setOpacityBy(e.deltaY < 0 ? 0.05 : -0.05);
}, { passive: false });
window.api.onOpacityChanged(o => {
  $('setOpacity').value = Math.round(o * 100);
  setStatus(`прозрачность: ${Math.round(o * 100)}%`);
});

// --- Сигнал активности для авто-скрытия (не чаще раза в 30 сек) ---
let lastPing = 0;
function ping() {
  const now = Date.now();
  if (now - lastPing > 30000) { lastPing = now; window.api.pingActivity(); }
}
['keydown', 'click', 'wheel'].forEach(ev => window.addEventListener(ev, ping, { passive: true }));

// --- Инициализация под-модулей ---
const settings = initSettings();
settings.setLoader(loadMessages);
initImageInputs();
initVoice();

// --- Настройки (Ctrl+O) и горячие клавиши ---
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'o') { e.preventDefault(); settings.openSettings(); }
  if (e.key === 'Escape' && stream.isStreaming()) { e.preventDefault(); window.api.stopChat(); setStatus('останавливаю…'); }
  if (e.key === 'ArrowUp' && document.activeElement === $('input') && !$('input').value.trim()) {
    const history = window.api.getHistory();
    if (history && history.length) {
      const lastUser = [...history].reverse().find(item => item.role === 'user');
      if (lastUser) { e.preventDefault(); $('input').value = lastUser.content; $('input').focus(); $('input').setSelectionRange($('input').value.length, $('input').value.length); }
    }
  }
});

// --- Запуск ---
loadMessages();
$('input').focus();
window.api.getSettings().then(s => {
  applyTheme(s.theme);
  applyFontSize(s.fontSize);
  applyLang(s.language || 'ru'); // язык интерфейса (настройки/кнопки/подсказки)
  setTimeout(() => $('loadingScreen').classList.add('hidden'), 250);
});