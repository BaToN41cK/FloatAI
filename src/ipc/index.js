// Централизованная регистрация всех IPC handlers.
// Используется в main.js для подключения всех модулей IPC.
const log = require('../logger');

function registerAll(ipcMain, deps) {
  const {
    getMistral,
    getSettings,
    getProxy,
    getChatWindow,
    confirmAction,
    onSettingsChange,
    chatWindow, // для Ollama/webContents
    saveWindowState,
    applyAutostart,
    rateLimitCooldowns,
    onSettingsApply,
    // Chat-очередь живёт в main.js (приоритет простых промптов, peek и т.д.);
    // модули IPC получают её через deps, чтобы не дублировать состояние.
    enqueueChat,
    pumpFn
  } = deps;

  // --- Settings (базовые load/save/reload) ---
  const settingsIpc = require('./settings');
  settingsIpc.register(ipcMain, onSettingsChange);

  // --- Settings apply (settings:get / settings:set / app:quit) ---
  const settingsApplyIpc = require('./settings-apply');
  settingsApplyIpc.register(ipcMain, {
    getMistral, getChatWindow, saveWindowState, applyAutostart,
    rateLimitCooldowns,
    onApply: deps.onApply
  });

  // --- Personality ---
  const personalityIpc = require('./personality');
  personalityIpc.register(ipcMain, { getMistral });

  // --- Ollama ---
  const ollamaIpc = require('./ollama');
  ollamaIpc.register(ipcMain, chatWindow ? chatWindow.webContents : null);

  // --- Voice ---
  const voiceIpc = require('./voice');
  voiceIpc.register(ipcMain, getSettings, getMistral);

  // --- Screenshot ---
  const screenshotIpc = require('./screenshot');
  screenshotIpc.register(ipcMain);

  // --- Security ---
  const securityIpc = require('./security');
  securityIpc.register(ipcMain, confirmAction);

  // --- Network + OCR ---
  const netIpc = require('./net');
  netIpc.register(ipcMain, getMistral);

  // --- Window management ---
  const windowIpc = require('./window');
  windowIpc.register(ipcMain, getChatWindow, getSettings);

  // --- Diagnostics ---
  const diagIpc = require('./diagnostics');
  diagIpc.register(ipcMain, getMistral, getSettings, getProxy);

  // --- Chat queue + stop/history/clear ---
  const chatIpc = require('./chat');
  chatIpc.register(ipcMain, { getMistral, enqueueChat, pumpFn });

  // --- Sessions ---
  const sessionsIpc = require('./sessions');
  sessionsIpc.register(ipcMain, { getMistral });

  log.info('[ipc] все модули зарегистрированы');
}

module.exports = { registerAll };
