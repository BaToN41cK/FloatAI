// IPC handlers для настроек: загрузка, сохранение, сброс.
const settings = require('../settings');
const log = require('../logger');

function register(ipcMain, onSettingsChange) {
  ipcMain.handle('settings:load', () => {
    try {
      return { ok: true, settings: settings.load() };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('settings:save', async (_e, partial) => {
    try {
      const next = settings.save(partial);
      if (onSettingsChange) onSettingsChange(next);
      return { ok: true, settings: next };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('settings:reload', () => {
    try {
      const s = settings.reload();
      if (onSettingsChange) onSettingsChange(s);
      return { ok: true, settings: s };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
}

module.exports = { register };
