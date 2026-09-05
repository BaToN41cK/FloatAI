// Панель настроек (Ctrl+O), сессии (диалоги) и диагностика.
import { $, applyTheme, applyFontSize } from './ui.js';
import { updateModelOptions } from './models.js';
import { applyLang, t } from './i18n.js';

const MAX_PERSONALITY_CHARS = 5000;

export function initSettings() {
  let _loadMessages = null; // main.js подключит загрузку истории (избегаем циклического импорта)

  // Точка подключения загрузки сообщений (вызывается main.js после init)
  function setLoader(fn) { _loadMessages = fn; }
  function loadMessages() { if (typeof _loadMessages === 'function') _loadMessages(); }

  // --- Счётчик символов в личности агента ---
  function updatePersonalityCounter() {
    const editor = $('personalityEditor');
    const counter = $('personalityCounter');
    if (!editor || !counter) return;
    const len = editor.value.length;
    const pct = (len / MAX_PERSONALITY_CHARS * 100).toFixed(1);
    counter.textContent = `${len.toLocaleString('ru')} / ${MAX_PERSONALITY_CHARS.toLocaleString('ru')} (${pct}%)`;
    counter.style.color = len > MAX_PERSONALITY_CHARS * 0.9 ? '#e5484d'
      : len > MAX_PERSONALITY_CHARS * 0.75 ? 'var(--accent)'
      : 'var(--muted)';
  }
  $('personalityEditor').addEventListener('input', updatePersonalityCounter);

  // --- Сессии (диалоги) ---
  function renderSessions(sessions) {
    const list = $('sessionsList');
    list.innerHTML = '';
    for (const s of sessions) {
      const item = document.createElement('div');
      item.className = 'session-item' + (s.active ? ' active' : '');
      const title = document.createElement('span');
      title.className = 'title';
      title.textContent = s.title + (s.count ? ` (${s.count})` : '');
      title.title = s.title;
      const del = document.createElement('span');
      del.className = 'del';
      del.textContent = '✕';
      del.title = 'Удалить диалог';
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.api.deleteSession(s.id);
        await refreshSessions();
        loadMessages();
      });
      item.appendChild(title);
      item.appendChild(del);
      item.addEventListener('click', async () => {
        await window.api.switchSession(s.id);
        await refreshSessions();
        loadMessages();
        $('sessionsPanel').classList.remove('open');
      });
      list.appendChild(item);
    }
  }

  async function refreshSessions() {
    const sessions = await window.api.getSessions();
    renderSessions(sessions);
  }

  $('btnSessions').addEventListener('click', async () => {
    $('infoPanel').classList.remove('open');
    $('settingsPanel').classList.remove('open');
    $('sessionsPanel').classList.toggle('open');
    if ($('sessionsPanel').classList.contains('open')) await refreshSessions();
  });
  $('sessionsClose').addEventListener('click', () => $('sessionsPanel').classList.remove('open'));
  $('btnNewSession').addEventListener('click', async () => {
    await window.api.newSession();
    await refreshSessions();
    loadMessages();
  });
  $('btnClear').addEventListener('click', async () => {
    await window.api.clearChat();
    window.__greeted = false;
    loadMessages();
  });
  $('btnInfo').addEventListener('click', () => $('infoPanel').classList.toggle('open'));
  $('infoClose').addEventListener('click', () => $('infoPanel').classList.remove('open'));

  // --- Настройки (Ctrl+,) ---
  async function openSettings() {
    $('infoPanel').classList.remove('open');
    $('sessionsPanel').classList.remove('open');
    $('settingsPanel').classList.add('open');
    $('settingsStatus').textContent = '';
    const s = await window.api.getSettings();
    $('personalityEditor').value = await window.api.getPersonality();
    $('personalityStatus').textContent = '';
    updatePersonalityCounter();
    $('setProvider').value = s.provider || 'mistral';
    updateModelOptions($('setProvider').value, s.model);
    $('setApiKey').value = s.apiKey || '';
    $('setVoiceKey').value = s.voiceApiKey || '';
    $('setCustomEndpoint').value = s.customEndpoint || '';
    $('setProxy').value = s.proxy || '';
    $('setBlocked').value = s.blockedSites || '';
    $('setAutostart').checked = !!s.autostart;
    $('setTheme').value = s.theme || 'dark';
    $('setDebug').checked = !!s.debug;
    $('setOpacity').value = Math.round((s.opacity ?? 1) * 100);
    $('setFontSize').value = s.fontSize || 13;
    $('setDeepThink').checked = !!s.deepThink;
    $('setLanguage').value = s.language || 'ru';
    $('setWebSearch').checked = s.plugins?.webSearch !== false;
    $('setFetchPage').checked = s.plugins?.fetchPage !== false;
    applyFontSize(s.fontSize || 13);
    applyLang(s.language || 'ru'); // перевести панель настроек на выбранный язык
  }
  $('btnSettings').addEventListener('click', openSettings);
  $('settingsClose').addEventListener('click', () => $('settingsPanel').classList.remove('open'));
  $('setProvider').addEventListener('change', () => updateModelOptions($('setProvider').value));
  $('btnSaveSettings').addEventListener('click', async () => {
    let res;
    try {
      const personalityResult = await window.api.savePersonality($('personalityEditor').value);
      res = await window.api.saveSettings({
        provider: $('setProvider').value,
        model: $('setModel').value.trim(),
        apiKey: $('setApiKey').value.trim(),
        voiceApiKey: $('setVoiceKey').value.trim(),
        customEndpoint: $('setCustomEndpoint').value.trim(),
        proxy: $('setProxy').value.trim(),
        blockedSites: $('setBlocked').value.trim(),
        autostart: $('setAutostart').checked,
        theme: $('setTheme').value,
        debug: $('setDebug').checked,
        opacity: Number($('setOpacity').value) / 100,
        fontSize: Number($('setFontSize').value),
        deepThink: $('setDeepThink').checked,
        language: $('setLanguage').value,
        plugins: { webSearch: $('setWebSearch').checked, fetchPage: $('setFetchPage').checked }
      });
      $('personalityStatus').textContent = personalityResult.warnings.length
        ? `Сохранено · ${personalityResult.warnings.join(' ')}`
        : 'Сохранено ✓';
    } catch (error) {
      $('settingsStatus').textContent = error.message || 'Настройки не сохранены';
      return;
    }
    applyTheme(res.theme);
    applyFontSize(res.fontSize);
    const lang = res.language || 'ru';
    applyLang(lang);
    $('settingsStatus').textContent = res.proxyRestartNeeded
      ? t(lang, 'Сохранено · прокси после перезапуска')
      : t(lang, 'Сохранено ✓');
    $('btnSaveSettings').textContent = 'Сохранено ✓';
    setTimeout(() => { $('btnSaveSettings').textContent = 'Сохранить'; }, 1800);
  });
  $('btnPersonalityReset').addEventListener('click', async () => {
    if (!window.confirm('Сбросить личность агента к нейтральной?')) return;
    const result = await window.api.resetPersonality();
    $('personalityEditor').value = result.text;
    $('personalityStatus').textContent = 'Сброшено ✓';
    updatePersonalityCounter();
  });
  // --- Отдельные проверки диагностики: результат показывается под кнопками ---
  const diagOut = () => $('diagOut');
  const runCheck = (fn, busy) => async () => {
    diagOut().textContent = busy;
    try { diagOut().textContent = await fn(); }
    catch (e) { diagOut().textContent = '🔴 ' + (e.message || 'ошибка проверки'); }
  };
  $('btnCheckProvider').addEventListener('click', runCheck(() => window.api.checkProvider(), '⏳ Проверяю провайдера…'));
  $('btnCheckNet').addEventListener('click', runCheck(() => window.api.checkNet(), '⏳ Проверяю интернет и прокси…'));
  $('btnCheckVoice').addEventListener('click', runCheck(() => window.api.checkVoice(), '⏳ Проверяю голосовой ввод…'));

  $('btnDiagnostics').addEventListener('click', async () => {
    try {
      await window.api.copyDiagnostics();
      const s = await window.api.getSettings();
      $('settingsStatus').textContent = t(s.language || 'ru', 'Диагностика скопирована');
    } catch (error) {
      $('settingsStatus').textContent = 'Не удалось скопировать диагностику';
    }
  });
  document.querySelectorAll('.settings-tab').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('.settings-tab').forEach(item => item.classList.toggle('active', item === tab));
    document.querySelectorAll('.settings-page').forEach(page => page.classList.toggle('active', page.dataset.page === tab.dataset.tab));
  }));

  return { setLoader, refreshSessions, openSettings };
}