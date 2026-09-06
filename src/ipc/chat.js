// IPC handlers для чата: отправка сообщений, остановка генерации, история.
// Логика очереди и приоритета простых промптов — здесь; main.js инжектирует
// функцию-насос (pumpFn) и фабрику enqueueChat через deps.register, чтобы
// не дублировать состояние между процессами.
const log = require('../logger');

// Очередь сообщений с приоритетом (быстрые впереди)
const chatQueue = [];
let pump = null; // функция-насос, инжектируется из main.js
let enqueueImpl = null; // реализация enqueueChat, инжектируется из main.js

function setPumpFn(fn) { pump = fn; }
function setEnqueueFn(fn) { enqueueImpl = fn; }

// Обёртка: пробрасывает в main.js (где живёт основная логика очереди).
function enqueueChat(message) {
  if (enqueueImpl) return enqueueImpl(message);
  // Fallback (если register не вызван — тесты, прямой импорт): кладём в локальную очередь
  chatQueue.push({ message, fast: false });
  if (pump) pump();
}

function getQueueLength() { return chatQueue.length; }
function clearQueue() { chatQueue.length = 0; }

function register(ipcMain, deps) {
  const getMistral = deps && deps.getMistral;
  // main.js передаёт свою реализацию очереди и насос; модуль становится чистой обёрткой IPC
  if (deps && typeof deps.enqueueChat === 'function') setEnqueueFn(deps.enqueueChat);
  if (deps && typeof deps.pumpFn === 'function') setPumpFn(deps.pumpFn);

  ipcMain.on('chat:send', (_e, message) => enqueueChat(message));

  ipcMain.handle('chat:stop', () => {
    clearQueue();
    if (getMistral) { const m = getMistral(); if (m && m.stop) m.stop(); }
    return true;
  });

  ipcMain.handle('chat:getHistory', () => {
    const m = getMistral && getMistral();
    return m && m.getHistory ? m.getHistory() : [];
  });

  ipcMain.handle('chat:clear', () => {
    clearQueue();
    if (getMistral) { const m = getMistral(); if (m && m.resetHistory) m.resetHistory(); }
    return true;
  });
}

module.exports = {
  register,
  enqueueChat,
  getQueueLength,
  clearQueue,
  setPumpFn,
  setEnqueueFn,
  _chatQueue: chatQueue
};
