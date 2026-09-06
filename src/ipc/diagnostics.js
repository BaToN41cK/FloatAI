// IPC handlers для диагностики: проверка сети, провайдера, голоса.
const { doFetch } = require('../electron-fetch');
const { getProvider } = require('../providers');
const { getDiagnostics } = require('../diagnostics');
const log = require('../logger');

// Кэш результатов проверок (чтобы «Скопировать диагностику» собирала всё)
const lastChecks = { net: null, provider: null, voice: null };

// Проверка интернета
async function checkNet(settings, proxy) {
  const t0 = Date.now();
  try {
    const res = await doFetch('https://www.gstatic.com/generate_204', { signal: AbortSignal.timeout(8000) });
    const ok = res.status < 500;
    lastChecks.net = {
      internet: ok ? 'ok' : 'down',
      proxy: { configured: Boolean(proxy) },
      latencyMs: Date.now() - t0,
      checkedAt: new Date().toISOString()
    };
    return ok
      ? `🟢 Интернет: ok (${lastChecks.net.latencyMs} мс)${proxy ? ' · через прокси ' + proxy : ' · напрямую (прокси не задан)'}`
      : '🟡 Сеть есть, но ответ сервера странный (HTTP ' + res.status + ')';
  } catch (e) {
    lastChecks.net = { internet: 'down', proxy: { configured: Boolean(proxy) }, error: e.message, checkedAt: new Date().toISOString() };
    return `🔴 Интернет: недоступен${proxy ? ' (прокси ' + proxy + ' — запущен ли Happ?)' : ''} — ${e.message}`;
  }
}

// Проверка доступности провайдера
async function checkProvider(mistral) {
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

// Проверка голосового ввода
async function checkVoice(settings, mistral) {
  const entry = { keyConfigured: Boolean(settings.voiceApiKey), provider: settings.voiceApiKey ? 'Groq Whisper' : (mistral.apiKey ? 'Mistral Voxtral' : null) };
  if (!settings.voiceApiKey && !mistral.apiKey) {
    lastChecks.voice = entry;
    return '🟡 Голос: нет ни ключа Groq, ни ключа Mistral — распознавание речи работать не будет';
  }
  const url = settings.voiceApiKey ? 'https://api.groq.com' : 'https://api.mistral.ai';
  const label = settings.voiceApiKey ? 'Groq Whisper' : 'Mistral Voxtral';
  try {
    await doFetch(url, { signal: AbortSignal.timeout(8000) });
    entry.reachable = true;
    lastChecks.voice = entry;
    return `🟢 Голос: ${label} доступен, ключ задан`;
  } catch (e) {
    entry.reachable = false; entry.error = e.message;
    lastChecks.voice = entry;
    return `🔴 Голос: ${label} недоступен — ${e.message}`;
  }
}

function register(ipcMain, getMistral, getSettings, getProxy) {
  ipcMain.handle('diagnostics:check-net', () => checkNet(getSettings(), getProxy()));
  ipcMain.handle('diagnostics:check-provider', () => checkProvider(getMistral()));
  ipcMain.handle('diagnostics:check-voice', () => checkVoice(getSettings(), getMistral()));
  ipcMain.handle('diagnostics:get', () => {
    const m = getMistral();
    const s = getSettings();
    return getDiagnostics({
      provider: m.provider,
      model: m.model,
      apiKey: m.apiKey,
      logFile: log.LOG_FILE,
      endpoint: m.customEndpoint || undefined,
      plugins: m.plugins,
      encryptionAvailable: true,
      extended: !!s.debug,
      extra: {
        deepThink: m.deepThink,
        maxTokens: m.maxTokens,
        language: s.language || 'ru',
        proxy: s.proxy || '(не задан)',
        voiceKeyConfigured: Boolean(s.voiceApiKey),
        autostart: s.autostart
      }
    });
  });
  ipcMain.handle('diagnostics:copy', async () => {
    const m = getMistral();
    const s = getSettings();
    const proxy = getProxy();
    // Собираем ВСЕ проверки: уже выполненные — из кэша, невыполненные — прогоняем
    const [net, provider, voice] = await Promise.all([
      lastChecks.net || checkNet(s, proxy),
      lastChecks.provider || checkProvider(m),
      lastChecks.voice || checkVoice(s, m)
    ]);
    const data = getDiagnostics({
      provider: m.provider, model: m.model, apiKey: m.apiKey,
      logFile: log.LOG_FILE, endpoint: m.customEndpoint || undefined,
      plugins: m.plugins, encryptionAvailable: true, extended: !!s.debug,
      extra: { net, provider, voice }
    });
    const { clipboard } = require('electron');
    clipboard.writeText(JSON.stringify(data, null, 2));
    return data;
  });
}

module.exports = { register, checkNet, checkProvider, checkVoice, lastChecks };
