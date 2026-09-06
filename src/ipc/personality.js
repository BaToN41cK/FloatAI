// IPC handlers для персональности: чтение, валидация, сохранение, сброс.
const personality = require('../personality');

function register(ipcMain, deps) {
  const getMistral = deps && deps.getMistral;

  ipcMain.handle('personality:get', () => personality.getPersonalityText());
  ipcMain.handle('personality:validate', (_e, text) => personality.validatePersonality(text));
  ipcMain.handle('personality:save', (_e, text) => {
    const result = personality.savePersonality(text);
    const m = getMistral && getMistral();
    if (m) m.systemPrompt = personality.corePrompt();
    return result;
  });
  ipcMain.handle('personality:reset', () => {
    const result = personality.resetPersonality();
    const m = getMistral && getMistral();
    if (m) m.systemPrompt = personality.corePrompt();
    return result;
  });
}

module.exports = { register };