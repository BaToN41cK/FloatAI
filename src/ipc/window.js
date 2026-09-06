// IPC handlers для управления окном: прозрачность, активность, авто-скрытие.
const log = require('../logger');

let idleTimer = null;
const IDLE_HIDE_MS = 10 * 60 * 1000;

function resetIdleTimer(getChatWindow) {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const chatWindow = getChatWindow();
    if (chatWindow && chatWindow.isVisible()) {
      chatWindow.hide();
      log.info('[win] авто-скрытие: окно не использовалось 10 минут (вернуть: \\\\)');
    }
  }, IDLE_HIDE_MS);
}

function clearIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
}

function register(ipcMain, getChatWindow, getSettings) {
  // Изменение прозрачности колесиком
  ipcMain.on('win:opacity', (_e, delta) => {
    const chatWindow = getChatWindow();
    if (!chatWindow) return;
    const next = Math.max(0.25, Math.min(1, chatWindow.getOpacity() + delta));
    chatWindow.setOpacity(next);
    getSettings().save({ opacity: next });
    chatWindow.webContents.send('win:opacity-changed', next);
    // Сохраняем состояние
    const fs = require('fs');
    const path = require('path');
    const { app } = require('electron');
    const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');
    try {
      const st = { bounds: chatWindow.getBounds(), opacity: next };
      fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
      fs.writeFileSync(STATE_FILE, JSON.stringify(st));
    } catch (_) {}
  });

  // Активность пользователя — сброс таймера авто-скрытия
  ipcMain.on('win:activity', () => resetIdleTimer(getChatWindow));
}

module.exports = { register, resetIdleTimer, clearIdleTimer, IDLE_HIDE_MS };
