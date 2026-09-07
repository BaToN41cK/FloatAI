// Electron main process — чат с Mistral AI; OCR в renderer; сессии
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, ipcMain, globalShortcut, screen, session, clipboard, desktopCapturer, nativeImage, dialog, shell } = require('electron');

// --- Dev-версия не должна делить userData с упакованной (иначе конфликт кэша и
// single-instance лока: «Unable to move the cache: Отказано в доступе»).
// ВАЖНО: до require('./src/settings'), который фиксирует путь settings.json. ---
if (!app.isPackaged) app.setPath('userData', app.getPath('userData') + '-dev');

// --- Один экземпляр + кэш (стабильность и антивирус) ---
// Лок обязательно берём ДО whenReady, иначе два запуска могут упасть на
// «Unable to move the cache». Кэш Chromium держим в userData и ограничиваем
// по размеру — меньше шансов, что антивирус залочит/повредит его.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
} else {
  app.on('second-instance', () => {
    if (chatWindow) {
      if (chatWindow.isMinimized()) chatWindow.restore();
      chatWindow.show(); chatWindow.focus();
    } else { createChatWindow(); }
  });

  const CACHE_DIR = path.join(app.getPath('userData'), 'Cache');
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (_) {}
  app.setPath('cache', CACHE_DIR);
}

const { Client, isSimplePrompt } = require('./src/client');
const personality = require('./src/personality');
const { doFetch } = require('./src/electron-fetch');
const settings = require('./src/settings');
const log = require('./src/logger');
const { getDiagnostics } = require('./src/diagnostics');
const { isNetworkError, isRateLimitError, friendlyError } = require('./src/ai-errors');
const { Cooldown } = require('./src/cooldown');
const secretKeys = require('./src/secret-keys');
const { enabledTools } = require('./src/plugins');

// --- Защита от EPIPE: если stdout/stderr — «мёртвая труба» (запуск через .vbs со
// скрытым окном, закрытый терминал, редирект в файл от умершего процесса), любая
// консольная запись кидает EPIPE и роняет приложение диалогом
// «A JavaScript error occurred in the main process». Глушим ошибки этих стримов.
for (const stream of [process.stdout, process.stderr]) {
  if (stream && typeof stream.on === 'function') {
    stream.on('error', () => { /* EPIPE/EBADF при записи в консоль игнорируем */ });
  }
}

// --- Глобальная обработка ошибок: приложение не падает молча.
// Пишем ТОЛЬКО в файл лога (console может быть мёртв — см. EPIPE выше),
// и сами обработчики никогда не бросают исключений. ---
process.on('uncaughtException', (e) => { try { log.error('[fatal] uncaughtException:', e.stack || e.message); } catch (_) {} });
process.on('unhandledRejection', (e) => { try { log.error('[fatal] unhandledRejection:', (e && e.stack) || String(e)); } catch (_) {} });

// --- Автообновления (работает только в упакованном виде, через electron-builder) ---
if (app.isPackaged) {
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-downloaded', (info) => {
      log.info(`[update] загружена версия ${info.version} — установится при выходе`);
      if (chatWindow) chatWindow.webContents.send('app:update-ready', { version: info.version });
    });
    autoUpdater.on('error', (e) => log.warn('[update]', e.message));
    autoUpdater.checkForUpdatesAndNotify().catch((e) => log.warn('[update]', e.message));
  } catch (e) {
    log.warn('[update] electron-updater недоступен:', e.message);
  }
}

// --- Настройки из UI: применяем заблокированные сайты и TTL логов ---
const { setBlockedSites, setSearchMode, setSearchApiKey } = require('./src/web-tools');
const { getProvider } = require('./src/providers');
const loaded = settings.load();
setBlockedSites(loaded.blockedSites);
setSearchMode(loaded.searchMode || 'ddg');
  setSearchApiKey(loaded.searchApiKey || '');
log.setLogTtl(loaded.logTtlDays);

// Встроенный VPN-прокси (Xray): свои серверы зашиты обфусцированно в src/proxy/builtin.js.
// Пользовательский прокси (поле «Прокси») имеет приоритет — он применяется ниже через proxy-server.
const proxyManager = require('./src/proxy/xray-manager');
const BUILTIN_PROXY_PORT = 18108; // не 10808/10809 — чтобы не конфликтовать с Happ/v2rayN пользователя

async function applyBuiltinProxy(mode) {
  if (mode !== 'builtin') {
    await proxyManager.stop();
    if (chatWindow) await chatWindow.webContents.session.setProxy({ mode: 'direct' }).catch(() => {});
    return;
  }
  try {
    const started = await proxyManager.ensureStarted();
    if (started && chatWindow) {
      await chatWindow.webContents.session.setProxy({ proxyRules: `socks5://127.0.0.1:${BUILTIN_PROXY_PORT}` });
    }
  } catch (e) {
    log.warn('[proxy] встроенный прокси недоступен:', e.message);
  }
}


// Поддержка прокси (обход сброса больших запросов провайдером):
const PROXY = loaded.proxy;
if (PROXY) {
  const hostPort = PROXY.replace(/^https?:\/\//, '').replace(/\/$/, '');
  app.commandLine.appendSwitch('proxy-server', hostPort);
  app.commandLine.appendSwitch('no-proxy-server-addr-exclusions');
  console.log(`[net] трафик через прокси ${hostPort}`);
}

let chatWindow = null;
let mistral = null;
const rateLimitCooldowns = new Map();
const SENSITIVE_TEXT = /(sk-[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|Bearer\s+[A-Za-z0-9._-]{20,}|(?:парол|password|secret|token|api[_ -]?key)\s*[:=]\s*\S+)/i;

async function confirmAction(title, message) {
  if (!chatWindow) return false;
  const result = await dialog.showMessageBox(chatWindow, { type: 'warning', buttons: ['Отмена', 'Разрешить'], defaultId: 0, cancelId: 0, title, message, noLink: true });
  return result.response === 1;
}

function providerCooldown(provider) {
  if (!rateLimitCooldowns.has(provider)) rateLimitCooldowns.set(provider, new Cooldown(60 * 1000));
  return rateLimitCooldowns.get(provider);
}

const WIN_WIDTH = 600;
const WIN_HEIGHT = 500;
// Прозрачность окна. Здесь задаётся «основа»:
//  1.0 — полностью непрозрачное (читаемое) окно, как ты крутил колесо вверх.
// Можно изменить Ctrl+колесом (от 0.25 до 1.0).
const WIN_OPACITY = 1.0;
const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')); } catch (_) { return {}; }
}
function saveWindowState() {
  if (!chatWindow) return;
  try {
    // Запоминаем позицию, размер и прозрачность окна
    const st = { bounds: chatWindow.getBounds(), opacity: chatWindow.getOpacity() };
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(st));
  } catch (e) { log.warn('[win] не сохранил состояние:', e.message); }
}

function moveToTopRight() {
  if (!chatWindow) return;
  const { workArea } = screen.getPrimaryDisplay();
  const bounds = chatWindow.getBounds();
  chatWindow.setPosition(workArea.x + workArea.width - bounds.width - 12, workArea.y + 12);
}

// Окно всегда открывается в правом верхнем углу экрана.
// Размер берётся из сохранённого состояния (если было), позиция — фиксированная.
function createChatWindow() {
  const state = loadWindowState();
  const { workArea } = screen.getPrimaryDisplay();
  const x = workArea.x + workArea.width - WIN_WIDTH - 12;
  const y = workArea.y + 12;
  let width = WIN_WIDTH, height = WIN_HEIGHT;
  if (state.bounds) { width = Math.max(480, state.bounds.width); height = Math.max(360, state.bounds.height); }

  chatWindow = new BrowserWindow({
    width, height, x, y,
    frame: false, transparent: true, resizable: true, movable: true,
    alwaysOnTop: true, skipTaskbar: true, opacity: state.opacity ?? loaded.opacity ?? WIN_OPACITY,
    minWidth: 480, minHeight: 360,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  chatWindow.loadFile(path.join(__dirname, 'app', 'chat.html'));
  // Встроенный прокси: настраиваем сессию окна (socks5 на локальный Xray)
  applyBuiltinProxy(settings.load().proxyMode).catch(() => {});
  // --- Ссылки не должны «уносить» оверлей-панель на сайт ---
  // target=_blank (window.open) -> системный браузер, панель остаётся чатом.
  chatWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      confirmAction('Открыть ссылку?', `Открыть внешний адрес в браузере?\n\n${url}`).then((allowed) => {
        if (allowed) shell.openExternal(url).catch(e => log.warn('[win] не открыл ссылку в браузере:', e.message));
      });
    }
    return { action: 'deny' }; // новое окно не создаём
  });
  // Обычный переход (клик по <a>, редирект) тоже наружу: возвращаем чат на место.
  chatWindow.webContents.on('will-navigate', (e, url) => {
    const local = url.startsWith('file:');
    if (!local) {
      e.preventDefault();
      if (/^https?:\/\//i.test(url)) {
        confirmAction('Открыть ссылку?', `Открыть внешний адрес в браузере?\n\n${url}`).then((allowed) => {
          if (allowed) shell.openExternal(url).catch(err => log.warn('[win] не открыл ссылку в браузере:', err.message));
        });
      }
      // Мгновенно возвращаем интерфейс чата, чтобы панель не зависла «на сайте»
      chatWindow.webContents.loadFile(path.join(__dirname, 'app', 'chat.html')).catch(() => {});
    }
  });
  // Случайный зум (Ctrl+= / Ctrl+Shift+= приближают, Chromium запоминает уровень)
  // сбрасываем при каждом запуске: интерфейс всегда стартует на 100%.
  // Сам зум во время сессии остаётся доступен (Ctrl+0 — вернуть 100%).
  chatWindow.webContents.setZoomLevel(0);
  // Скрытое окно не должно замедлять стриминг/OCR (Chromium троттлит фоновые вкладки)
  chatWindow.webContents.setBackgroundThrottling(false);
  chatWindow.on('closed', () => { chatWindow = null; });

  // Защита от захвата экрана (SetWindowDisplayAffinity WDA_EXCLUDEFROMCAPTURE):
  // прячет окно из трансляции «весь экран» (например демонстрация в VK),
  // но оставляет его видимым у пользователя на мониторе.
  // Повторно применяем ПОсле показа/фокуса, т.к. DWM может сбросить флаг
  // при первом появлении окна. Требует Windows 10 (build 19041/2004+) или 11.
  const applyContentProtection = () => {
    try {
      if (chatWindow) {
        chatWindow.setContentProtection(true); // возвращает void — статус см. в логах ОС
        log.info('[win] защита от захвата экрана запрошена (WDA_EXCLUDEFROMCAPTURE)');
      }
    } catch (e) {
      log.warn('[win] не удалось включить защиту от захвата:', e.message);
    }
  };
  applyContentProtection();
  chatWindow.on('show', applyContentProtection);
  chatWindow.on('focus', applyContentProtection);

  // Таймер сохранения позиции/размера/прозрачности
  let saveTimer = null;
  const onMove = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveWindowState, 400); };
  chatWindow.on('move', onMove);
  chatWindow.on('resize', onMove);

  // Изменение прозрачности колесиком (приходит из renderer)
  ipcMain.on('win:opacity', (_e, delta) => {
    if (!chatWindow) return;
    const next = Math.max(0.25, Math.min(1, chatWindow.getOpacity() + delta));
    chatWindow.setOpacity(next);
    settings.save({ opacity: next });
    chatWindow.webContents.send('win:opacity-changed', next);
    saveWindowState();
  });
}

function toggleChat() {
  if (chatWindow && chatWindow.isVisible()) { saveWindowState(); chatWindow.hide(); }
  else {
    if (!chatWindow) createChatWindow();
    else { moveToTopRight(); chatWindow.show(); chatWindow.focus(); }
    resetIdleTimer();
  }
}

// Автозапуск при входе в Windows (переключается в настройках UI, Ctrl+,)
function applyAutostart(enabled) {
  if (enabled) {
    app.setLoginItemSettings({ openAtLogin: true, path: process.execPath, args: [__dirname] });
  } else if (app.getLoginItemSettings().openAtLogin) {
    app.setLoginItemSettings({ openAtLogin: false });
  }
}
applyAutostart(settings.load().autostart);

app.whenReady().then(() => {
  // Голосовой ввод: явно разрешаем доступ к микрофону в renderer
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media' || permission === 'audioCapture');
  });

  const runtimeSettings = settings.reload();
  // Auto: работает из коробки — всегда облачная Cohere command-a-03-2025 через
  // служебный ключ (env / logs/secrets.json, вне репозитория). Модель и ключ
  // пользователем не выбираются. Без служебного ключа — локальная ~8B (Ollama).
  // Остальные провайдеры: своя модель + свой API-ключ (обязателен).
  const resolveAuto = (s) => {
    const key = secretKeys.cohere();
    return key ? { provider: 'cohere', model: 'command-a-03-2025', apiKey: key, apiKeyFromUser: false } : null;
  };
  let autoMode = false; // работает ли сейчас служебный Auto-режим
  if (runtimeSettings.provider === 'auto') {
    autoMode = true;
    const auto = resolveAuto(runtimeSettings);
    if (auto) {
      Object.assign(runtimeSettings, auto);
      log.info('[ai] Auto: модель Cohere command-a-03-2025 (ключ вне репозитория)');
    } else {
      runtimeSettings.model = 'qwen2.5:7b';
      log.info('[ai] служебный ключ недоступен — Auto работает локально (qwen2.5:7b через Ollama)');
    }
  } else {
    const noKey = !runtimeSettings.apiKey;
    const providerCfg = getProvider(runtimeSettings.provider, runtimeSettings.model);
    if (noKey && !providerCfg.local && runtimeSettings.provider !== 'custom') {
      autoMode = true;
      runtimeSettings.provider = 'auto';
      const auto = resolveAuto(runtimeSettings);
      if (auto) Object.assign(runtimeSettings, auto);
      else runtimeSettings.model = 'qwen2.5:7b';
      log.info('[ai] ключ не задан — включён Auto');
    }
  }
  mistral = new Client({ ...runtimeSettings, onWebStatus: text => {
    if (chatWindow) chatWindow.webContents.send('chat:web-status', text);
  }, onFirstToken: () => {
    // Ответ начал приходить — снимаем статус «печатает/думает»
    if (chatWindow) chatWindow.webContents.send('chat:first-token');
  }, onPeek: (text) => {
    // Мгновенный предварительный ответ на простую фразу
    if (text && chatWindow) chatWindow.webContents.send('chat:peek', text);
  }, onToolPermission: async (name, args) => {
    // Галочка «Плагин: поиск / чтение страниц» = разрешение инструмента
    const allowed = enabledTools((settings.load().plugins || {}));
    if (allowed.includes(name)) {
      log.info(`[tools] автоподтверждение инструмента «${name}» (плагин включён)`);
      return true;
    }
    return confirmAction('Разрешить инструмент?', `Модель хочет вызвать инструмент «${name}», но он выключен в настройках. Разрешить разово?\n\n${args.slice(0, 500)}`);
  } });
  mistral.apiKeyFromUser = !autoMode; // false, когда работает служебный ключ Auto-режима
  // Служебный ключ (Auto): включаем защитный режим — только официальные
  // endpoints, кастомный endpoint игнорируется, действует дневная квота.
  // Свой ключ пользователя — режим не нужен, полный функционал.
  mistral.setKeyRestricted(!mistral.apiKeyFromUser && Boolean(mistral.apiKey));
  createChatWindow();
  chatWindow.show();
  chatWindow.focus();
  resetIdleTimer();

globalShortcut.register('\\', toggleChat);
  globalShortcut.register('CommandOrControl+Shift+C', toggleChat);
  globalShortcut.register('CommandOrControl+Shift+Q', () => app.quit());
  globalShortcut.register('CommandOrControl+Shift+S', () => startRegionShot());

  // Ограничиваем размер HTTP-кэша Chromium — приложение не раздувает диск
  try { session.defaultSession.setCacheSize(120 * 1024 * 1024); } catch (_) {}
});

// --- IPC: чат со стримингом (очередь с приоритетом) ---
// Простые (быстрые) вопросы встают вперёд обычных, чтобы не ждали длинную очередь.
const chatQueue = [];
let chatProcessing = false;

function enqueueChat(message) {
  const item = { message, fast: isSimplePrompt(message) };
  if (item.fast && chatQueue.length) {
    const idx = chatQueue.findIndex(i => !i.fast);
    chatQueue.splice(idx === -1 ? chatQueue.length : idx, 0, item);
  } else {
    chatQueue.push(item);
  }
  pumpChatQueue();
}

async function pumpChatQueue() {
  if (chatProcessing || !mistral) return;
  chatProcessing = true;
  try {
    while (chatQueue.length) await deliverMessage(chatQueue.shift().message);
  } catch (e) {
    log.error('[chat] ошибка очереди:', e && e.message);
  } finally {
    chatProcessing = false;
  }
}

async function deliverMessage(message) {
  const provider = mistral?.provider || 'unknown';
  const cooldown = providerCooldown(provider);
  if (cooldown.active()) {
    const seconds = Math.ceil(cooldown.remaining() / 1000);
    if (chatWindow) chatWindow.webContents.send('chat:error', {
      text: `Провайдер временно ограничил запросы. Подожди ещё ${seconds} сек.`,
      network: false
    });
    return;
  }
  const run = async () => {
    let chunkSent = false; // начал ли уже приходить ответ
    await mistral.chatStream(message, (chunk) => {
      chunkSent = true;
      if (chatWindow) chatWindow.webContents.send('chat:chunk', chunk);
    });
    if (chatWindow) chatWindow.webContents.send('chat:done');
    return chunkSent;
  };
  try {
    // Глубокое размышление: даём модели ~2 сек «подумать» до старта стрима,
    // чтобы она не начинала писать с наскока и не переписывала начало ответа.
    if (mistral.deepThink) await new Promise((r) => setTimeout(r, 2000));
    await run();
  } catch (err) {
    // Auto-фолбэк цепочкой: Cohere (скрытый ключ) недоступен -> Cerebras
    // (скрытый ключ) -> локальная модель. Сохранённые настройки не меняются.
    const secretCerebras = mistral && !mistral.apiKeyFromUser && secretKeys.cerebras();
    if (isNetworkError(err.message) && secretCerebras && mistral.provider === 'cohere') {
      const previousProvider = mistral.provider;
      const previousModel = mistral.model;
      const previousKey = mistral.apiKey;
      try {
        if (chatWindow) chatWindow.webContents.send('chat:web-status', 'основной провайдер недоступен, пробую резервный…');
        mistral.setModel('gpt-oss-120b', 'cerebras');
        mistral.setApiKey(secretCerebras);
        await run();
        mistral.setModel(previousModel, previousProvider);
        mistral.setApiKey(previousKey);
        return;
      } catch (fallbackError) {
        mistral.setApiKey(previousKey);
        mistral.setModel(previousModel, previousProvider);
        log.warn('[chat] резервный провайдер тоже недоступен:', fallbackError.message);
      }
    }
    // Если облачный провайдер недоступен по сети, один раз пробуем локальную
    // модель, не меняя сохранённые настройки пользователя.
    if (isNetworkError(err.message) && mistral && !getProvider(mistral.provider, mistral.model).local) {
      const previousProvider = mistral.provider;
      const previousModel = mistral.model;
      try {
        if (chatWindow) chatWindow.webContents.send('chat:web-status', 'текущий провайдер недоступен, пробую локальную модель…');
        mistral.setModel('qwen2.5:7b', 'auto');
        await run();
        mistral.setModel(previousModel, previousProvider);
        return;
      } catch (fallbackError) {
        mistral.setModel(previousModel, previousProvider);
        log.warn('[chat] локальный fallback тоже недоступен:', fallbackError.message);
      }
    }
    // Авто-повтор ОДИН раз, если это сетевой сбой и ответ ещё не начал стримиться
    if (/net::ERR_(?!ABORTED)/.test(err.message)) {
      log.warn('[chat] сетевой сбой, повторяю запрос ещё раз:', err.message);
      try { await run(); return; } catch (err2) { err = err2; }
    }
    if (isRateLimitError(err.message)) providerCooldown(provider).start();
    log.error('[chat]', err.message);
    if (chatWindow) {
      chatWindow.webContents.send('chat:error', {
        text: friendlyError(err.message),
        network: isNetworkError(err.message) // true = красная точка, false = остаёмся зелёными
      });
    }
  }
}

ipcMain.on('chat:send', (_e, message) => { enqueueChat(message); });
ipcMain.handle('security:check-sensitive', (_e, text) => ({ sensitive: SENSITIVE_TEXT.test(String(text || '')) }));
ipcMain.handle('security:confirm-sensitive', (_e, text) => {
  if (!SENSITIVE_TEXT.test(String(text || ''))) return true;
  return confirmAction('Возможный секрет', 'В сообщении похожи на API-ключ, пароль или токен. Отправить этот текст провайдеру AI?');
});
ipcMain.handle('chat:stop', () => { mistral.stop(); return true; });
ipcMain.handle('chat:getHistory', () => mistral.getHistory());
ipcMain.handle('chat:clear', () => { mistral.resetHistory(); return true; });
function diagPayload() {
  const s = settings.load();
  return {
    provider: mistral.provider,
    model: mistral.model,
    apiKey: mistral.apiKey,
    logFile: log.LOG_FILE,
    endpoint: mistral.customEndpoint || undefined,
    plugins: mistral.plugins,
    encryptionAvailable: settings.isEncryptionAvailable(),
    extended: !!s.debug,
    extra: {
      deepThink: mistral.deepThink,
      maxTokens: mistral.maxTokens,
      language: s.language || 'ru',
      proxy: s.proxy || '(не задан)',
      voiceKeyConfigured: Boolean(s.voiceApiKey),
      autostart: s.autostart
    }
  };
}
// Живые проверки для диагностики: интернет/прокси, доступность API провайдера, голосовой ключ
// --- Отдельные проверки диагностики: результаты кэшируются, чтобы
// «Скопировать диагностику» собирала всё, что уже проверяли кнопками ---
const lastChecks = { net: null, provider: null, voice: null };

async function checkNet() {
  const s = settings.load();
  const t0 = Date.now();
  try {
    const res = await doFetch('https://www.gstatic.com/generate_204', { signal: AbortSignal.timeout(8000) });
    const ok = res.status < 500;
    lastChecks.net = {
      internet: ok ? 'ok' : 'down',
      proxy: { configured: Boolean(s.proxy) },
      latencyMs: Date.now() - t0,
      checkedAt: new Date().toISOString()
    };
    return ok
      ? `🟢 Интернет: ok (${lastChecks.net.latencyMs} мс)${s.proxy ? ' · через прокси ' + s.proxy : ' · напрямую (прокси не задан)'}`
      : '🟡 Сеть есть, но ответ сервера странный (HTTP ' + res.status + ')';
  } catch (e) {
    lastChecks.net = { internet: 'down', proxy: { configured: Boolean(s.proxy) }, error: e.message, checkedAt: new Date().toISOString() };
    return `🔴 Интернет: недоступен${s.proxy ? ' (прокси ' + s.proxy + ' — запущен ли Happ?)' : ''} — ${e.message}`;
  }
}

async function checkProvider() {
  const p = getProvider(mistral.provider, mistral.model);
  const base = (p.id === 'custom' && mistral.customEndpoint) ? mistral.customEndpoint : p.chatUrl;
  const entry = { name: p.label, model: mistral.model, keyConfigured: Boolean(mistral.apiKey) };
  if (p.local) {
    entry.local = true; entry.endpoint = base;
    lastChecks.provider = entry;
    return `🟢 ${p.label}: локальный провайдер, endpoint ${base} (сервер должен быть запущен отдельно)`;
  }
  if (!base || !/^https?:/i.test(base)) {
    lastChecks.provider = entry;
    return `🟡 ${p.label}: адрес API не задан`;
  }
  const t0 = Date.now();
  try {
    await doFetch(new URL(base).origin, { signal: AbortSignal.timeout(8000) });
    entry.reachable = true; entry.latencyMs = Date.now() - t0;
    lastChecks.provider = entry;
    return `🟢 ${p.label} (${mistral.model}): сервер доступен (${entry.latencyMs} мс)${mistral.apiKey ? ' · ключ задан' : ' · ключ НЕ задан'}`;
  } catch (e) {
    entry.reachable = false; entry.error = e.message;
    lastChecks.provider = entry;
    return `🔴 ${p.label}: сервер не отвечает — ${e.message}`;
  }
}

async function checkVoice() {
  const s = settings.load();
  const builtinGroq = Boolean(secretKeys.groq());
  const entry = { keyConfigured: Boolean(s.voiceApiKey) || builtinGroq, builtinKey: builtinGroq, provider: (s.voiceApiKey || builtinGroq) ? 'Groq Whisper' : (mistral.apiKey ? 'Mistral Voxtral' : null) };
  if (!s.voiceApiKey && !builtinGroq && !mistral.apiKey) {
    lastChecks.voice = entry;
    return '🟡 Голос: нет ни ключа Groq, ни ключа Mistral — распознавание речи работать не будет';
  }
  const url = (s.voiceApiKey || builtinGroq) ? 'https://api.groq.com' : 'https://api.mistral.ai';
  const label = (s.voiceApiKey || builtinGroq) ? 'Groq Whisper' : 'Mistral Voxtral';
  try {
    await doFetch(url, { signal: AbortSignal.timeout(8000) });
    entry.reachable = true;
    lastChecks.voice = entry;
    return `🟢 Голос: ${label} доступен${s.voiceApiKey ? ' (ключ пользователя)' : builtinGroq ? ' (служебный ключ)' : ''}`;
  } catch (e) {
    entry.reachable = false; entry.error = e.message;
    lastChecks.voice = entry;
    return `🔴 Голос: ${label} недоступен — ${e.message}`;
  }
}

ipcMain.handle('diagnostics:check-net', () => checkNet());
ipcMain.handle('diagnostics:check-provider', () => checkProvider());
ipcMain.handle('diagnostics:check-voice', () => checkVoice());
ipcMain.handle('diagnostics:get', () => getDiagnostics(diagPayload()));
ipcMain.handle('diagnostics:copy', async () => {
  const data = getDiagnostics(diagPayload());
  // Собираем ВСЕ проверки: уже выполненные кнопками — берём из кэша,
  // невыполненные — прогоняем сейчас, чтобы расширенная диагностика была полной.
  try {
    const [net, provider, voice] = await Promise.all([
      lastChecks.net || checkNet(),
      lastChecks.provider || checkProvider(),
      lastChecks.voice || checkVoice()
    ]);
    data.liveChecks = { net, provider, voice };
  } catch (e) { log.warn('[diag] живые проверки не удались:', e.message); }
  clipboard.writeText(JSON.stringify(data, null, 2));
  return true;
});

// --- IPC: сессии (диалоги) ---
ipcMain.handle('chat:getSessions', () => mistral.getSessions());
ipcMain.handle('chat:newSession', () => mistral.newSession());
ipcMain.handle('chat:switchSession', (_e, id) => mistral.switchSession(id));
ipcMain.handle('chat:deleteSession', (_e, id) => mistral.deleteSession(id));

// --- IPC: настройки (UI, Ctrl+O) ---
// Применяем на лету: модель, blocked-sites, автозапуск, TTL логов.
// Прокси требует перезапуска (задаётся при старте Chromium) — сообщаем об этом.
ipcMain.handle('settings:get', () => settings.load());
ipcMain.handle('personality:get', () => personality.getPersonalityText());
ipcMain.handle('personality:validate', (_e, text) => personality.validatePersonality(text));
ipcMain.handle('personality:save', (_e, text) => {
  const result = personality.savePersonality(text);
  if (mistral) mistral.systemPrompt = personality.corePrompt();
  return result;
});
ipcMain.handle('personality:reset', () => {
  const result = personality.resetPersonality();
  if (mistral) mistral.systemPrompt = personality.corePrompt();
  return result;
});
ipcMain.handle('settings:set', (_e, partial) => {
  const saved = settings.save(partial || {});
  const isAuto = saved.provider === 'auto';
  if ('model' in (partial || {}) || 'provider' in (partial || {})) {
    if (isAuto) {
      // Auto: модель и ключ не выбираются — служебная Cohere (или локальная без ключа)
      const auto = secretKeys.cohere();
      if (auto) {
        mistral.setModel('command-a-03-2025', 'cohere');
        mistral.setApiKey(auto);
        mistral.apiKeyFromUser = false;
        mistral.setKeyRestricted(true); // служебный ключ: только официальные endpoints + квота
      } else {
        mistral.setModel('qwen2.5:7b', 'auto');
        mistral.setKeyRestricted(false); // локальный режим — без ограничений
      }
    } else {
      mistral.setModel(saved.model, saved.provider);
    }
    rateLimitCooldowns.delete(saved.provider);
  }
  if ('reasoningEffort' in (partial || {}) || 'deepThink' in (partial || {}) || 'language' in (partial || {})) {
    // Миграция: deepThink boolean → reasoningEffort string
    const effort = saved.reasoningEffort || (saved.deepThink ? 'high-high' : 'low');
    mistral.setOptions({ reasoningEffort: effort, deepThink: effort !== 'low', language: saved.language });
  }
  if ('apiKey' in (partial || {}) && !isAuto) {
    // Ключ запоминается per-провайдер: при переключении подставится сам
    const perProviderKey = (saved.providerKeys && saved.providerKeys[saved.provider]) || saved.apiKey || '';
    mistral.setApiKey(perProviderKey);
    mistral.apiKeyFromUser = Boolean(perProviderKey);
    // Свой ключ пользователя — снимаем ограничения служебного режима
    mistral.setKeyRestricted(false);
  }
  if ('plugins' in (partial || {})) mistral.setPlugins(saved.plugins);
  if ('customEndpoint' in (partial || {})) mistral.customEndpoint = saved.customEndpoint;
  if ('blockedSites' in (partial || {})) setBlockedSites(saved.blockedSites);
  if ('proxyMode' in (partial || {}) || 'proxy' in (partial || {})) {
    applyBuiltinProxy(saved.proxyMode).catch(e => log.warn('[proxy] не переключил режим:', e.message));
  }
  if ('searchMode' in (partial || {})) setSearchMode(partial.searchMode);
    if ('searchApiKey' in (partial || {})) setSearchApiKey(partial.searchApiKey);
  if ('autostart' in (partial || {})) applyAutostart(saved.autostart);
  if ('logTtlDays' in (partial || {})) log.setLogTtl(saved.logTtlDays);
  if ('opacity' in (partial || {}) && chatWindow) {
    const opacity = Math.max(0.25, Math.min(1, Number(saved.opacity) || WIN_OPACITY));
    chatWindow.setOpacity(opacity);
    saveWindowState();
  }
  const proxyChanged = 'proxy' in (partial || {}) && (partial.proxy || '') !== (loaded.proxy || '');
  return { ...saved, proxyRestartNeeded: proxyChanged };
});
ipcMain.handle('app:quit', () => { proxyManager.stop(); app.quit(); });
app.on('before-quit', () => { proxyManager.stop(); });

// --- Авто-скрытие: если окном не пользуются 10 минут — прячем (хоткей \ вернёт) ---
const IDLE_HIDE_MS = 10 * 60 * 1000;
let idleTimer = null;
function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (chatWindow && chatWindow.isVisible()) {
      chatWindow.hide();
      log.info('[win] авто-скрытие: окно не использовалось 10 минут (вернуть: \\)');
    }
  }, IDLE_HIDE_MS);
}
// --- Проверка связи: Wi-Fi есть/нет, прокси-сервер жив/мертв ---
// Результат: 'ok' (интернет через прокси доступен) | 'down' (прокси/сеть не работают)
async function checkConnectivity() {
  try {
    // doFetch — единый net.fetch, ходит через прокси из настроек приложения
    const res = await doFetch('https://www.gstatic.com/generate_204', { signal: AbortSignal.timeout(8000) });
    return res.status < 500 ? 'ok' : 'down';
  } catch (_) { return 'down'; }
}
ipcMain.handle('net:check', () => checkConnectivity());

// Скачивание бинарного файла (модели распознавания и т.п.) через МАИН-процесс:
// doFetch = net.fetch, который уважает прокси из настроек — в отличие от
// обычного браузерного fetch в renderer (HuggingFace в РФ без прокси недоступен).
ipcMain.handle('net:download', async (_e, url) => {
  const res = await doFetch(String(url), { redirect: 'follow', signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
});

// --- Менеджер локальных моделей Ollama: список / скачивание / удаление ---
const OLLAMA_BASE = 'http://127.0.0.1:11434';
ipcMain.handle('ollama:list', async () => {
  try {
    const res = await doFetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { ok: true, models: (data.models || []).map(m => ({ name: m.name, size: m.size || 0 })) };
  } catch (_) {
    return { ok: false, error: 'Ollama не запущена (нужен http://127.0.0.1:11434)', models: [] };
  }
});
ipcMain.on('ollama:pull', (_e, name) => {
  const model = String(name || '').trim();
  if (!model || !chatWindow) return;
  (async () => {
    try {
      const res = await doFetch(`${OLLAMA_BASE}/api/pull`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, stream: true }),
        signal: AbortSignal.timeout(60 * 60 * 1000) // скачивание может быть долгим
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          let j;
          try { j = JSON.parse(line); } catch (_) { continue; }
          if (j.error) throw new Error(j.error);
          if (chatWindow) chatWindow.webContents.send('ollama:event', {
            model,
            status: j.status || '',
            total: j.total || 0,
            completed: j.completed || 0,
            done: j.status === 'success' || !!j.done
          });
        }
      }
      if (chatWindow) chatWindow.webContents.send('ollama:event', { model, done: true, status: 'готово' });
    } catch (e) {
      if (chatWindow) chatWindow.webContents.send('ollama:event', { model, done: true, error: e.message });
    }
  })();
});
ipcMain.on('ollama:delete', async (_e, name) => {
  const model = String(name || '').trim();
  try {
    await doFetch(`${OLLAMA_BASE}/api/delete`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model }),
      signal: AbortSignal.timeout(10000)
    });
  } catch (_) {}
  if (chatWindow) chatWindow.webContents.send('ollama:event', { model, done: true, deleted: true });
});

ipcMain.on('win:activity', resetIdleTimer);

ipcMain.handle('voice:mode', () => {
  const s = settings.load();
  const cloud = Boolean(s.voiceApiKey || (mistral && mistral.apiKeyFromUser && mistral.provider === 'mistral'));
  return cloud ? 'cloud' : 'local';
});

// --- Голос: аудиозапись из renderer -> Whisper (Groq, бесплатно) или Voxtral ---
// Распознавание речи включается пользователем в настройках (speechEnabled).
ipcMain.handle('voice:transcribe', async (_e, { b64, mime = 'audio/webm' } = {}) => {
  try {
    const s = settings.load();
    if (!s.voiceEnabled) return { ok: false, error: 'Голосовой ввод выключен в настройках («Прочее»)' };
    if (!b64) throw new Error('Пустая аудиозапись');
    const audio = Buffer.from(String(b64), 'base64');
    if (!audio.length) throw new Error('Пустая аудиозапись');

    const form = new FormData();
    // Groq/Whisper требует корректное расширение файла: mime вида
    // 'audio/webm;codecs=opus' нельзя подставлять в имя как есть —
    // иначе API отвечает 400 «file must be one of the following types».
    const raw = String(mime).toLowerCase();
    let ext = 'webm';
    if (raw.includes('ogg') || raw.includes('opus')) ext = 'ogg';
    else if (raw.includes('mp4') || raw.includes('m4a')) ext = raw.includes('m4a') ? 'm4a' : 'mp4';
    else if (raw.includes('mpeg') || raw.includes('mp3')) ext = 'mp3';
    else if (raw.includes('wav')) ext = 'wav';
    form.append('file', new Blob([audio], { type: mime }), `voice.${ext}`);

    let url, headers, label;
    const builtinGroq = secretKeys.groq();
    if (s.voiceApiKey) {
      // Ключ пользователя — приоритет
      form.append('model', 'whisper-large-v3');
      url = 'https://api.groq.com/openai/v1/audio/transcriptions';
      headers = { 'Authorization': `Bearer ${s.voiceApiKey}` };
      label = 'Whisper (Groq)';
    } else if (builtinGroq) {
      // Встроенный служебный ключ Groq — голос работает из коробки, бесплатно
      form.append('model', 'whisper-large-v3');
      url = 'https://api.groq.com/openai/v1/audio/transcriptions';
      headers = { 'Authorization': `Bearer ${builtinGroq}` };
      label = 'Whisper (Groq, служебный)';
    } else if (mistral.apiKeyFromUser && mistral.provider === 'mistral') {
      // Запасной путь: Voxtral от Mistral — только с НАСТОЯЩИМ ключом Mistral
      // (служебный ключ Auto-режима (Cohere) для Voxtral не подходит — был 401)
      form.append('model', 'voxtral-mini-latest');
      url = 'https://api.mistral.ai/v1/audio/transcriptions';
      headers = { 'Authorization': `Bearer ${mistral.apiKey}` };
      label = 'Voxtral (Mistral)';
    } else {
      return { ok: false, error: 'Нужен ключ распознавания речи: GROQ_API_KEY (переменная окружения или logs/secrets.json) либо свой ключ Mistral с провайдером Mistral.' };
    }

    const res = await doFetch(url, { method: 'POST', headers, body: form });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${label} API ${res.status}: ${body.slice(0, 250)}`);
    }
    const data = await res.json();
    return { ok: true, text: String(data.text || '').trim() };
  } catch (err) {
    log.error('[voice]', err.message);
    return { ok: false, error: friendlyError(err.message) };
  }
});

// --- IPC: текст со скриншота (OCR в renderer) -> Mistral ---
ipcMain.handle('chat:ocr-text', async (_e, { question, text, confidence = 100 }) => {
  try {
    const clean = (text || '').trim();
    if (!clean) throw new Error('Пустой текст со скриншота');
    log.info(`[ocr] текст: ${clean.length} символов, уверенность ${Math.round(confidence)}%`);

    const base = question
      ? `Вопрос пользователя: ${question}\n\n[Текст со скриншота, распознан автоматически]:\n${clean}`
      : `[Текст со скриншота, распознан автоматически]:\n${clean}`;
    const prompt = `${base}\n\nЭто машинное распознавание (OCR, уверенность ${Math.round(confidence)}%): текст может содержать ошибки, искажённые или склеенные слова.
- Если текст связный и понятен — отвечай по делу (например, реши задание из скриншота).
- Если текст выглядит как бессмыслица, обрывки слов или явно искажён — НЕ придумывай ответ. Скажи, что скриншот распознался плохо, и попроси прислать скрин крупнее/чётче.
- Если для ответа не хватает контекста (обрезан текст, видно не всё) — так и скажи.`;

    let full = '';
    await mistral.chatStream(prompt, (chunk) => { full += chunk; });
    return { ok: true, reply: full, text: clean };
  } catch (err) {
    log.error('[ocr-text]', err.message, err.cause ? String(err.cause) : '');
    return { ok: false, error: err.message };
  }
});

// --- Скриншот области (Ctrl+Shift+S): оверлей выбора -> кроп -> авто-OCR ---
// Прячем окно чата, снимаем экран, показываем оверлей с выделением мышью,
// кропим картинку и отправляем в чат на распознавание (как Ctrl+V, но сразу).
let shotSelector = null;

async function startRegionShot() {
  try {
    if (shotSelector) return; // уже идёт выбор
    if (chatWindow && chatWindow.isVisible()) chatWindow.hide();
    await new Promise(r => setTimeout(r, 250)); // дать окну спрятаться

    const display = screen.getPrimaryDisplay();
    const { scaleFactor, size } = display;
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: size.width * scaleFactor, height: size.height * scaleFactor }
    });
    if (!sources.length) { if (chatWindow) chatWindow.show(); return; }
    const dataUrl = sources[0].thumbnail.toDataURL();

    shotSelector = new BrowserWindow({
      x: display.bounds.x, y: display.bounds.y,
      width: size.width, height: size.height,
      frame: false, transparent: true, resizable: false, movable: false,
      alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    shotSelector.setFullScreen(true);
    shotSelector.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
      <html><body style="margin:0;overflow:hidden;cursor:crosshair">
      <img id="bg" src="${dataUrl}" style="position:fixed;top:0;left:0;width:100vw;height:100vh">
      <div id="sel" style="position:fixed;display:none;border:2px solid #7c5cff;background:rgba(124,92,255,0.12)"></div>
      <div id="tip" style="position:fixed;top:12px;left:50%;transform:translateX(-50%);color:#fff;background:rgba(0,0,0,0.65);padding:6px 14px;border-radius:8px;font:14px sans-serif">Выдели область мышью · Esc — отмена</div>
      <script>
        const { ipcRenderer } = require('electron');
        let sx = 0, sy = 0, drag = false;
        const sel = document.getElementById('sel');
        addEventListener('keydown', e => { if (e.key === 'Escape') ipcRenderer.send('screenshot:cancel'); });
        addEventListener('mousedown', e => { drag = true; sx = e.clientX; sy = e.clientY; sel.style.display = 'block'; sel.style.left = sx + 'px'; sel.style.top = sy + 'px'; sel.style.width = '0'; sel.style.height = '0'; });
        addEventListener('mousemove', e => { if (!drag) return; sel.style.left = Math.min(sx, e.clientX) + 'px'; sel.style.top = Math.min(sy, e.clientY) + 'px'; sel.style.width = Math.abs(e.clientX - sx) + 'px'; sel.style.height = Math.abs(e.clientY - sy) + 'px'; });
        addEventListener('mouseup', e => {
          if (!drag) return; drag = false;
          const r = { x: Math.min(sx, e.clientX), y: Math.min(sy, e.clientY), width: Math.abs(e.clientX - sx), height: Math.abs(e.clientY - sy) };
          sel.style.display = 'none';
          if (r.width > 8 && r.height > 8) ipcRenderer.send('screenshot:select', r); else ipcRenderer.send('screenshot:cancel');
        });
      </script></body></html>`));
  } catch (e) {
    log.warn('[shot] не удалось начать скриншот:', e.message);
    if (shotSelector) { shotSelector.close(); shotSelector = null; }
    if (chatWindow) chatWindow.show();
  }
}

ipcMain.on('screenshot:select', (_e, r) => {
  const finish = (png) => {
    if (shotSelector) { shotSelector.close(); shotSelector = null; }
    if (chatWindow) { chatWindow.show(); chatWindow.focus(); }
    if (png && chatWindow) chatWindow.webContents.send('app:screenshot', png);
  };
  try {
    if (shotSelector) { shotSelector.close(); shotSelector = null; } // оверлей не должен попасть в кадр
    const display = screen.getPrimaryDisplay();
    const scaleFactor = display.scaleFactor;
    // Повторный снимок экрана с той же геометрией (за оверлеем ничего не изменилось)
    setTimeout(() => {
      desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: display.size.width * scaleFactor, height: display.size.height * scaleFactor }
      }).then(sources => {
        if (!sources.length) { finish(null); return; }
        const img = sources[0].thumbnail;
        const rect = {
          x: Math.round(r.x * scaleFactor), y: Math.round(r.y * scaleFactor),
          width: Math.round(r.width * scaleFactor), height: Math.round(r.height * scaleFactor)
        };
        finish(img.crop(rect).toDataURL());
      }).catch(e => {
        log.warn('[shot] кроп не удался:', e.message);
        finish(null);
      });
    }, 150);
  } catch (e) {
    log.warn('[shot] ошибка выбора области:', e.message);
    finish(null);
  }
});

ipcMain.on('screenshot:cancel', () => {
  if (shotSelector) { shotSelector.close(); shotSelector = null; }
  if (chatWindow) { chatWindow.show(); chatWindow.focus(); }
});

app.on('will-quit', () => {
  saveWindowState();
  globalShortcut.unregisterAll();
});

// app.quit() только по хоткею
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') { /* остаёмся */ }
});
