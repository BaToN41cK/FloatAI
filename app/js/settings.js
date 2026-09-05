// Панель настроек (Ctrl+O), сессии (диалоги) и диагностика.
import { $, applyTheme, applyFontSize } from './ui.js';
import { updateModelOptions } from './models.js';
import { applyLang, t } from './i18n.js';
import { store } from './store.js';

const MAX_PERSONALITY_CHARS = 5000;
let _lastSettings = null; // последние загруженные настройки (для подстановки ключей)

export function initSettings() {
  let _loadMessages = null; // main.js подключит загрузку истории (избегаем циклического импорта)

  // Точка подключения загрузки сообщений (вызывается main.js после init)
  function setLoader(fn) { _loadMessages = fn; }
  function loadMessages() { if (typeof _loadMessages === 'function') _loadMessages(); }

  // --- Auto: без выбора модели и без API-ключа (работает из коробки) ---
  function updateAutoVisibility() {
    const auto = $('setProvider').value === 'auto';
    const modelLabel = $('setModel') && $('setModel').closest('label');
    const keyLabel = $('setApiKey') && $('setApiKey').closest('label');
    if (modelLabel) modelLabel.hidden = auto;
    if (keyLabel) keyLabel.hidden = auto;
    updateOllamaVisibility();
  }

  // --- Менеджер локальных моделей Ollama (виден только для провайдера Ollama) ---
  function formatSize(bytes) {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? gb.toFixed(1) + ' ГБ' : Math.max(1, Math.round(bytes / (1024 * 1024))) + ' МБ';
  }

  async function refreshOllama() {
    const list = $('ollamaList');
    if (!list) return;
    const r = await window.api.getOllamaModels();
    list.innerHTML = '';
    if (!r.ok) {
      list.textContent = r.error || 'Ollama не запущена';
      return;
    }
    if (!r.models.length) {
      list.textContent = 'Модели не скачаны — впиши имя ниже и нажми «Скачать».';
      return;
    }
    for (const m of r.models) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:2px 0';
      const name = document.createElement('span');
      name.textContent = `${m.name} (${formatSize(m.size)})`;
      name.style.flex = '1';
      const del = document.createElement('span');
      del.textContent = '✕';
      del.title = 'Удалить модель';
      del.style.cssText = 'cursor:pointer; opacity:0.6';
      del.addEventListener('click', async () => {
        if (!window.confirm(`Удалить модель ${m.name} с диска?`)) return;
        window.api.deleteOllamaModel(m.name);
      });
      row.appendChild(name);
      row.appendChild(del);
      list.appendChild(row);
      // добавляем скачанные модели в выпадающий список выбора модели
      const select = $('setModel');
      if (![...select.options].some(o => o.value === m.name)) {
        const opt = document.createElement('option');
        opt.value = m.name;
        opt.textContent = m.name;
        select.appendChild(opt);
      }
    }
  }

  let ollamaPullBusy = false;
  window.api.onOllamaEvent((e) => {
    if (!e) return;
    const status = $('ollamaStatus');
    if (e.error) {
      status.textContent = '🔴 ' + e.error;
      ollamaPullBusy = false;
      $('btnOllamaPull').disabled = false;
      return;
    }
    if (e.total && e.completed) {
      const pct = Math.min(100, Math.round(e.completed / e.total * 100));
      status.textContent = `⏳ ${e.model}: ${pct}% (${formatSize(e.completed)} из ${formatSize(e.total)})`;
    } else if (e.status) {
      status.textContent = `⏳ ${e.model}: ${e.status}`;
    }
    if (e.done) {
      ollamaPullBusy = false;
      $('btnOllamaPull').disabled = false;
      if (e.deleted) status.textContent = `🗑 ${e.model} удалена`;
      else if (!e.total) status.textContent = `✅ ${e.model} готова`;
      refreshOllama();
    }
  });

  function updateOllamaVisibility() {
    const section = $('ollamaSection');
    if (!section) return;
    const isOllama = $('setProvider').value === 'ollama';
    section.style.display = isOllama ? '' : 'none';
    if (isOllama) refreshOllama();
  }

  $('btnOllamaPull').addEventListener('click', () => {
    if (ollamaPullBusy) return;
    const name = $('ollamaModel').value.trim();
    if (!name) { $('ollamaStatus').textContent = 'Впиши имя модели, например qwen2.5:7b'; return; }
    ollamaPullBusy = true;
    $('btnOllamaPull').disabled = true;
    $('ollamaStatus').textContent = `⏳ скачиваю ${name}…`;
    window.api.pullOllamaModel(name);
  });

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
    store.state.greeted = false;
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
    updateAutoVisibility();
    // Ключ подставляется per-провайдер: каждый провайдер помнит свой ключ
    _lastSettings = s;
    $('setApiKey').value = (s.providerKeys && s.providerKeys[$('setProvider').value]) || s.apiKey || '';
    $('setBraveKey').value = s.braveApiKey || '';
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
  $('setProvider').addEventListener('change', () => {
    updateModelOptions($('setProvider').value);
    updateAutoVisibility();
    // Переключили провайдера — подставляем его сохранённый ключ
    const s = _lastSettings || {};
    $('setApiKey').value = (s.providerKeys && s.providerKeys[$('setProvider').value]) || '';
  });
  $('btnSaveSettings').addEventListener('click', async () => {
    let res;
    try {
      const personalityResult = await window.api.savePersonality($('personalityEditor').value);
      res = await window.api.saveSettings({
        provider: $('setProvider').value,
        // Auto: модель и ключ встроены — сохраняем плейсхолдеры, а не значения полей
        model: $('setProvider').value === 'auto' ? 'command-a-03-2025' : $('setModel').value.trim(),
        apiKey: $('setProvider').value === 'auto' ? '' : $('setApiKey').value.trim(),
        braveApiKey: $('setBraveKey').value.trim(),
        voiceEnabled: $('setVoiceEnabled').checked,
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
      store.state.voiceEnabled = !!res.voiceEnabled; // мгновенно показать/спрятать 🎙
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