const os = require('os');
const path = require('path');
const fs = require('fs');

function getDiagnostics({ provider, model, apiKey, logFile, endpoint, plugins, encryptionAvailable, extended, extra }) {
  const base = {
    app: 'AI Chat Overlay',
    platform: `${process.platform} ${os.release()}`,
    node: process.version,
    electron: process.versions.electron || 'не Electron',
    provider: provider || 'mistral',
    model: model || 'не выбрана',
    apiKeyConfigured: Boolean(apiKey),
    apiKeyStorage: encryptionAvailable ? 'safeStorage' : 'unavailable',
    endpoint: endpoint || 'не указан',
    plugins: plugins || {},
    logFile: logFile || path.join('logs', 'app.log'),
    generatedAt: new Date().toISOString()
  };

  // Расширенная диагностика: больше контекста для отладки (без секретов)
  if (extended) {
    let sessionStats = { sessions: 0, messagesTotal: 0, historyActive: 0 };
    try {
      const historyPath = path.join(__dirname, '..', 'logs', 'history.json');
      const data = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      if (data && Array.isArray(data.sessions)) {
        sessionStats.sessions = data.sessions.length;
        sessionStats.messagesTotal = data.sessions.reduce((n, s) => n + (s.history?.length || 0), 0);
        sessionStats.historyActive = data.sessions.find(s => s.id === data.activeId)?.history?.length || 0;
      }
    } catch (_) { /* истории ещё нет — не страшно */ }

    base.extended = {
      arch: os.arch(),
      cpuModel: (os.cpus()[0] && os.cpus()[0].model) || 'неизвестно',
      cpuCores: os.cpus().length,
      hostname: os.hostname(),
      memoryTotalGB: Math.round(os.totalmem() / 1073741824 * 10) / 10,
      memoryFreeGB: Math.round(os.freemem() / 1073741824 * 10) / 10,
      processUptimeMin: Math.round(process.uptime() / 60),
      systemUptimeH: Math.round(os.uptime() / 3600),
      pid: process.pid,
      appVersion: (() => { try { return require('electron').app.getVersion(); } catch (_) { return 'dev'; } })(),
      locale: (() => { try { return require('electron').app.getLocale(); } catch (_) { return 'dev'; } })(),
      sessionStats,
      ...(extra || {})
    };
  }
  return base;
}

module.exports = { getDiagnostics };