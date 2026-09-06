// IPC handlers для сессий (диалогов): список, создание, переключение, удаление.
function register(ipcMain, deps) {
  const getMistral = deps && deps.getMistral;

  ipcMain.handle('chat:getSessions', () => {
    const m = getMistral && getMistral();
    return m && m.getSessions ? m.getSessions() : [];
  });

  ipcMain.handle('chat:newSession', () => {
    const m = getMistral && getMistral();
    return m && m.newSession ? m.newSession() : null;
  });

  ipcMain.handle('chat:switchSession', (_e, id) => {
    const m = getMistral && getMistral();
    if (m && m.switchSession) return m.switchSession(id);
    return null;
  });

  ipcMain.handle('chat:deleteSession', (_e, id) => {
    const m = getMistral && getMistral();
    if (m && m.deleteSession) return m.deleteSession(id);
    return false;
  });
}

module.exports = { register };