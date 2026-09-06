// IPC handlers для настроек с применением на лету (settings:get/set, app:quit).
const settings = require('../settings');
const log = require('../logger');
const { setBlockedSites, setSearchApiKey } = require('../web-tools');
const secretKeys = require('../secret-keys');

const WIN_OPACITY = 1.0;

function register(ipcMain, deps) {
  const {
    getMistral,
    getChatWindow,
    saveWindowState,
    applyAutostart,
    onApply, // дополнительный хук для кастомной логики
    rateLimitCooldowns
  } = deps || {};

  ipcMain.handle('settings:get', () => settings.load());

  ipcMain.handle('settings:set', (_e, partial) => {
    const previous = settings.load();
    const saved = settings.save(partial || {});
    const mistral = getMistral && getMistral();
    const isAuto = saved.provider === 'auto';
    const chatWindow = getChatWindow && getChatWindow();
    const p = partial || {};

    if ('model' in p || 'provider' in p) {
      if (isAuto) {
        const auto = secretKeys.cohere();
        if (auto) {
          mistral.setModel('command-a-03-2025', 'cohere');
          mistral.setApiKey(auto);
          mistral.apiKeyFromUser = false;
        } else {
          mistral.setModel('qwen2.5:7b', 'auto');
        }
      } else if (mistral && mistral.setModel) {
        mistral.setModel(saved.model, saved.provider);
      }
      if (rateLimitCooldowns) rateLimitCooldowns.delete(saved.provider);
    }
    if ('reasoningEffort' in p || 'deepThink' in p || 'language' in p) {
      // Миграция: deepThink boolean → reasoningEffort string
      const effort = saved.reasoningEffort || (saved.deepThink ? 'high-high' : 'low');
      if (mistral && mistral.setOptions) mistral.setOptions({ reasoningEffort: effort, deepThink: effort !== 'low', language: saved.language });
    }
    if ('apiKey' in p && !isAuto && mistral && mistral.setApiKey) {
      const perProviderKey = (saved.providerKeys && saved.providerKeys[saved.provider]) || saved.apiKey || '';
      mistral.setApiKey(perProviderKey);
      mistral.apiKeyFromUser = Boolean(perProviderKey);
    }
    if ('plugins' in p && mistral && mistral.setPlugins) mistral.setPlugins(saved.plugins);
    if ('customEndpoint' in p && mistral) mistral.customEndpoint = saved.customEndpoint;
    if ('blockedSites' in p) setBlockedSites(saved.blockedSites);
    if ('searchApiKey' in p) setSearchApiKey(saved.searchApiKey);
    if ('autostart' in p) applyAutostart && applyAutostart(saved.autostart);
    if ('logTtlDays' in p) log.setLogTtl(saved.logTtlDays);
    if ('opacity' in p && chatWindow && chatWindow.isDestroyed !== undefined && !chatWindow.isDestroyed()) {
      const opacity = Math.max(0.25, Math.min(1, Number(saved.opacity) || WIN_OPACITY));
      chatWindow.setOpacity(opacity);
      saveWindowState && saveWindowState();
    }
    if (onApply) onApply(p, saved, chatWindow, previous);

    const proxyChanged = 'proxy' in p && String(p.proxy || '') !== String(previous.proxy || '');
    return { ...saved, proxyRestartNeeded: proxyChanged };
  });

  ipcMain.handle('app:quit', () => {
    const { app } = require('electron');
    app.quit();
  });
}

module.exports = { register };