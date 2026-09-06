// Панель настроек (Ctrl+O), сессии (диалоги) и диагностика.
import { $, applyTheme, applyFontSize } from './ui.js';
import { updateModelOptions, MODEL_OPTIONS, FREE_MODELS, detectProvider } from './models.js';
import { applyLang, t } from './i18n.js';
import { store } from './store.js';

const MAX_PERSONALITY_CHARS = 5000;
let _lastSettings = null;

const PROVIDER_INFO = {
  auto: { title: 'Auto', desc: 'Работает из коробки без API-ключа', badges: [{ type: 'recommended', text: 'Recommended' }, { type: 'free', text: 'Free' }], needsKey: false },
  openrouter: { title: 'OpenRouter', desc: 'Единый доступ к 200+ моделям от разных провайдеров', badges: [], needsKey: true, signupUrl: 'https://openrouter.ai/keys' },
  openai: { title: 'OpenAI', desc: 'GPT-4.1, GPT-4o, o3 — мощные модели для кодинга', badges: [{ type: 'paid', text: 'Paid' }], needsKey: true, signupUrl: 'https://platform.openai.com/api-keys' },
  anthropic: { title: 'Anthropic', desc: 'Claude 4 — продвинутое рассуждение и безопасность', badges: [{ type: 'paid', text: 'Paid' }], needsKey: true, signupUrl: 'https://console.anthropic.com/settings/keys' },
  google: { title: 'Google', desc: 'Gemini 2.5 — мультимодальные модели от Google', badges: [], needsKey: true, signupUrl: 'https://aistudio.google.com/apikey' },
  mistral: { title: 'Mistral', desc: 'Mistral Large, Codestral — быстрые европейские модели', badges: [], needsKey: true, signupUrl: 'https://console.mistral.ai/api-keys/' },
  zai: { title: 'Z.ai', desc: 'GLM-5 — новейшая мультимодальная модель с бесплатным тарифом', badges: [{ type: 'free', text: 'Free Models' }], needsKey: true, signupUrl: 'https://api.z.ai' },
  cohere: { title: 'Cohere', desc: 'Command A — модель с контекстом 128K, бесплатный тариф', badges: [{ type: 'free', text: 'Free' }], needsKey: true, signupUrl: 'https://dashboard.cohere.com/api-keys' },
  cerebras: { title: 'Cerebras', desc: 'Сверхбыстрый вывод. Бесплатный API-тариф', badges: [{ type: 'free', text: 'Free' }], needsKey: true, signupUrl: 'https://cloud.cerebras.ai/api-keys' },
  gigachat: { title: 'GigaChat', desc: 'Модели Сбера для русскоязычных задач', badges: [], needsKey: true, signupUrl: 'https://developers.sber.ru/' },
  yandex: { title: 'YandexGPT / Алиса', desc: 'YandexGPT 5 — модели Яндекса для русского языка', badges: [], needsKey: true, signupUrl: 'https://yandex.cloud/ru/services/yandexgpt' },
  ollama: { title: 'Ollama (локально)', desc: 'Запускает модели локально на вашем компьютере', badges: [{ type: 'local', text: 'Local' }, { type: 'free', text: 'Free' }], needsKey: false },
  lmstudio: { title: 'LM Studio (локально)', desc: 'Локальный сервер моделей через LM Studio', badges: [{ type: 'local', text: 'Local' }, { type: 'free', text: 'Free' }], needsKey: false },
  custom: { title: 'Свой OpenAI-совместимый', desc: 'Подключите любой OpenAI-совместимый API', badges: [], needsKey: true },
};

const MODEL_INFO = {
  'command-a-03-2025': { desc: 'Быстрая и эффективная модель с большим контекстом', context: '128K', input: 'Free', output: 'Free' },
  'GLM-5.3-Flash': { desc: 'Новейшая мультимодальная модель из серии GLM-5', context: '128K', input: 'Free', output: 'Free' },
  'GLM-4.5-Flash': { desc: 'Быстрая и бесплатная модель Z.ai', context: '128K', input: 'Free', output: 'Free' },
  'gpt-4.1': { desc: 'Самая мощная модель OpenAI для кодинга', context: '1M', input: 'Paid', output: 'Paid' },
  'gpt-4o': { desc: 'Баланс скорости и качества. Универсальная модель', context: '128K', input: 'Paid', output: 'Paid' },
  'claude-opus-4-1': { desc: 'Самая мощная модель Anthropic для сложных задач', context: '200K', input: 'Paid', output: 'Paid' },
  'claude-sonnet-4-20250514': { desc: 'Быстрая и умная модель Anthropic', context: '200K', input: 'Paid', output: 'Paid' },
  'gemini-2.5-pro': { desc: 'Самая мощная модель Google с длинным контекстом', context: '1M', input: 'Paid', output: 'Paid' },
  'gemini-2.5-flash': { desc: 'Быстрая модель Google для повседневных задач', context: '1M', input: 'Paid', output: 'Paid' },
  'poolside/laguna-s-2.1:free': { desc: 'Модель для кода от Poolside. Бесплатно', context: '32K', input: 'Free', output: 'Free' },
  'nvidia/nemotron-3.5-lightning:free': { desc: 'Быстрая модель NVIDIA для кодинга', context: '128K', input: 'Free', output: 'Free' },
  'mistral-large-latest': { desc: 'Самая мощная модель Mistral', context: '128K', input: 'Paid', output: 'Paid' },
  'mistral-small-latest': { desc: 'Быстрая и бесплатная модель Mistral', context: '32K', input: 'Free', output: 'Free' },
  'llama3.2': { desc: 'Модель Meta Llama 3.2 для диалогов и кодинга', context: '128K', input: 'Free', output: 'Free' },
  'qwen2.5': { desc: 'Модель Qwen 2.5 от Alibaba для кодинга', context: '32K', input: 'Free', output: 'Free' },
};

function getModelInfo(modelName) {
  if (MODEL_INFO[modelName]) return MODEL_INFO[modelName];
  if (FREE_MODELS.has(modelName) || modelName.endsWith(':free')) {
    return { desc: 'Модель с бесплатным доступом', context: '32K', input: 'Free', output: 'Free' };
  }
  return { desc: 'Выбранная модель', context: '—', input: '—', output: '—' };
}

export function initSettings() {
  let _loadMessages = null; // main.js подключит загрузку истории (избегаем циклического импорта)

  // Точка подключения загрузки сообщений (вызывается main.js после init)
  function setLoader(fn) { _loadMessages = fn; }
  function loadMessages() { if (typeof _loadMessages === 'function') _loadMessages(); }

  // --- Обновить карточку провайдера (Cline-style) ---
  function updateProviderCard(provider) {
    const info = PROVIDER_INFO[provider] || PROVIDER_INFO.auto;
    $('providerTitle').textContent = info.title;
    $('providerDesc').textContent = info.desc;

    const badgesEl = $('providerBadges');
    badgesEl.innerHTML = '';
    for (const badge of info.badges) {
      const span = document.createElement('span');
      span.className = `badge badge-${badge.type}`;
      span.textContent = badge.text;
      badgesEl.appendChild(span);
    }

    const apiKeyLabel = $('apiKeyLabel');
    const apiKeyInput = $('setApiKey');
    const apiKeyHint = $('apiKeyHint');
    const billingRow = $('billingRow');
    const subscriptionLink = $('subscriptionLink');

    if (info.needsKey) {
      if (apiKeyLabel) apiKeyLabel.style.display = '';
      if (apiKeyInput) apiKeyInput.style.display = '';
      if (apiKeyHint) apiKeyHint.style.display = '';
      if (billingRow) billingRow.style.display = '';
      if (subscriptionLink) {
        subscriptionLink.style.display = info.signupUrl ? '' : 'none';
        subscriptionLink.onclick = () => { if (info.signupUrl) window.api.openExternal(info.signupUrl); };
      }
    } else {
      if (apiKeyLabel) apiKeyLabel.style.display = 'none';
      if (apiKeyInput) apiKeyInput.style.display = 'none';
      if (apiKeyHint) apiKeyHint.style.display = 'none';
      if (billingRow) billingRow.style.display = 'none';
    }
    updateOllamaVisibility();
  }

  // --- Обновить карточку модели (Cline-style) ---
  function updateModelCard(modelName) {
    const info = getModelInfo(modelName);
    $('modelTitle').textContent = modelName;
    $('modelDesc').textContent = info.desc;
    $('modelContext').textContent = info.context;
    $('modelInputPrice').textContent = info.input;
    $('modelOutputPrice').textContent = info.output;

    const badgesEl = $('modelBadges');
    badgesEl.innerHTML = '';
    const isFree = FREE_MODELS.has(modelName) || modelName.endsWith(':free');
    const provider = $('setProvider').value;
    const models = MODEL_OPTIONS[provider] || [];
    if (models[0] === modelName) {
      const recSpan = document.createElement('span');
      recSpan.className = 'badge badge-recommended';
      recSpan.textContent = 'Recommended';
      badgesEl.appendChild(recSpan);
    }
    const span = document.createElement('span');
    span.className = `badge ${isFree ? 'badge-free' : 'badge-paid'}`;
    span.textContent = isFree ? 'FREE' : 'PAID';
    badgesEl.appendChild(span);
  }

  // --- Reasoning Effort ---
  function updateReasoningEffortUI(value) {
    const labels = ['Low', 'Medium', 'High-High'];
    const el = $('reasoningEffortValue');
    if (el) el.textContent = labels[value] || 'Low';
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
    $('setProvider').value = s.provider || 'auto';
    updateModelOptions($('setProvider').value, s.model);
    updateProviderCard($('setProvider').value);
    // Ключ подставляется per-провайдер: каждый провайдер помнит свой ключ
    _lastSettings = s;
    $('setApiKey').value = (s.providerKeys && s.providerKeys[$('setProvider').value]) || s.apiKey || '';
    $('setCustomEndpoint').value = s.customEndpoint || '';
    $('setProxy').value = s.proxy || '';
    $('setBlocked').value = s.blockedSites || '';
    $('setAutostart').checked = s.autostart !== false;
    $('setTheme').value = s.theme || 'dark';
    $('setDebug').checked = !!s.debug;
    $('setOpacity').value = Math.round((s.opacity ?? 1) * 100);
    $('setFontSize').value = s.fontSize || 13;
    // Reasoning Effort: миграция с deepThink (boolean) → reasoningEffort (string)
    // deepThink: true → "high-high", deepThink: false → "low"
    const effort = s.reasoningEffort || (s.deepThink ? 'high-high' : 'low');
    $('setDeepThink').checked = (effort === 'high-high' || effort === 'high');
    $('setLanguage').value = s.language || 'ru';
    $('setWebSearch').checked = s.plugins?.webSearch !== false;
    $('setSearchMode').value = s.searchMode || 'ddg';
    updateSearchModeVisibility();
    $('setFetchPage').checked = s.plugins?.fetchPage !== false;
    applyFontSize(s.fontSize || 13);
    applyLang(s.language || 'ru'); // перевести панель настроек на выбранный язык
  }
  $('btnSettings').addEventListener('click', openSettings);
  $('settingsClose').addEventListener('click', () => $('settingsPanel').classList.remove('open'));
  $('setSearchMode').addEventListener('change', updateSearchModeVisibility);
  $('setProvider').addEventListener('change', () => {
    const newProvider = $('setProvider').value;
    const s = _lastSettings || {};

    // Сохраняем текущую модель для предыдущего провайдера (как в Cline)
    const prevProvider = s.provider;
    if (prevProvider && prevProvider !== newProvider && s.providerModels) {
      s.providerModels[prevProvider] = $('setModel').value;
    }

    // Обновляем список моделей для нового провайдера
    updateModelOptions(newProvider);
    updateProviderCard($('setProvider').value);

    // Восстанавливаем последнюю выбранную модель для этого провайдера
    const savedModel = s.providerModels && s.providerModels[newProvider];
    if (savedModel && MODEL_OPTIONS[newProvider] && MODEL_OPTIONS[newProvider].includes(savedModel)) {
      $('setModel').value = savedModel;
    }

    // Переключили провайдера — подставляем его сохранённый ключ
    $('setApiKey').value = (s.providerKeys && s.providerKeys[newProvider]) || '';
  });
  $('btnSaveSettings').addEventListener('click', async () => {
    let res;
    try {
      const personalityResult = await window.api.savePersonality($('personalityEditor').value);
      const effortLabels = ['low', 'medium', 'high-high'];
      const reasoningEffort = effortLabels[parseInt($('reasoningEffortSlider').value)] || 'low';

      res = await window.api.saveSettings({
        provider: $('setProvider').value,
        // Auto: модель и ключ встроены — сохраняем плейсхолдеры, а не значения полей
        model: $('setProvider').value === 'auto' ? 'command-a-03-2025' : $('setModel').value.trim(),
        apiKey: $('setProvider').value === 'auto' ? '' : $('setApiKey').value.trim(),
        voiceEnabled: $('setVoiceEnabled').checked,
        customEndpoint: $('setCustomEndpoint').value.trim(),
        proxy: $('setProxy').value.trim(),
        blockedSites: $('setBlocked').value.trim(),
        autostart: $('setAutostart').checked,
        theme: $('setTheme').value,
        debug: $('setDebug').checked,
        opacity: Number($('setOpacity').value) / 100,
        fontSize: Number($('setFontSize').value),
        // Reasoning Effort вместо deepThink: "low" | "high" | "high-high"
        reasoningEffort: reasoningEffort,
        deepThink: reasoningEffort !== 'low',
        // Сохраняем последнюю модель для каждого провайдера
        providerModels: {
          ...((_lastSettings && _lastSettings.providerModels) || {}),
          [$('setProvider').value]: $('setProvider').value === 'auto' ? 'command-a-03-2025' : $('setModel').value.trim()
        },
        language: $('setLanguage').value,
        plugins: { webSearch: $('setWebSearch').checked, fetchPage: $('setFetchPage').checked },

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

// Глобальный слушатель: main присылает обновлённый список сессий
// (например, после того как модель сгенерировала название нового диалога).
// Дёргаем refreshSessions через объект настроек — он у нас singleton-стиль,
// но безопаснее всего просто вызвать getSessions и обновить DOM напрямую.
window.api.onSessionsUpdated((list) => {
  const listEl = $('sessionsList');
  if (!listEl) return;
  // Лёгкое обновление без полного перерендера панели: пересоберём элементы.
  // (Полный refresh делает refreshSessions() — но он доступен только через initSettings,
  //  поэтому используем простую перерисовку списка.)
  listEl.innerHTML = '';
  for (const s of list) {
    const item = document.createElement('div');
    item.className = 'session-item' + (s.active ? ' active' : '');
    item.textContent = s.title;
    item.dataset.id = s.id;
    item.addEventListener('click', () => window.api.switchSession(s.id).then(() => window.location.reload()));
    listEl.appendChild(item);
  }
});