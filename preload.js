// Мост между renderer (UI) и main-процессом
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Чат (стриминг)
  sendChat: (msg) => ipcRenderer.send('chat:send', msg),
  confirmSensitive: (text) => ipcRenderer.invoke('security:confirm-sensitive', text),
  getHistory: () => ipcRenderer.invoke('chat:getHistory'),
  clearChat: () => ipcRenderer.invoke('chat:clear'),
  onChunk: (cb) => ipcRenderer.on('chat:chunk', (_e, t) => cb(t)),
  onDone: (cb) => ipcRenderer.on('chat:done', () => cb()),
  onError: (cb) => ipcRenderer.on('chat:error', (_e, t) => cb(t)),
  onWebStatus: (cb) => ipcRenderer.on('chat:web-status', (_e, t) => cb(t)),
  // Сигнал «пришёл первый токен» (ответ начал стримиться)
  onFirstToken: (cb) => ipcRenderer.on('chat:first-token', () => cb()),
  // Мгновенный предварительный ответ на простую фразу
  onPeek: (cb) => ipcRenderer.on('chat:peek', (_e, t) => cb(t)),

  // Сигнал «окном пользуются» (для авто-скрытия)
  pingActivity: () => ipcRenderer.send('win:activity'),

  // Проверка связи (интернет/прокси)
  netCheck: () => ipcRenderer.invoke('net:check'),

  // Управление генерацией
  stopChat: () => ipcRenderer.invoke('chat:stop'),

  // Прозрачность
  setOpacityBy: (delta) => ipcRenderer.send('win:opacity', delta),
  onOpacityChanged: (cb) => ipcRenderer.on('win:opacity-changed', (_e, o) => cb(o)),

  // Сессии (диалоги)
  getSessions: () => ipcRenderer.invoke('chat:getSessions'),
  newSession: () => ipcRenderer.invoke('chat:newSession'),
  switchSession: (id) => ipcRenderer.invoke('chat:switchSession', id),
  deleteSession: (id) => ipcRenderer.invoke('chat:deleteSession', id),

  // Настройки (UI, Ctrl+O)
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (partial) => ipcRenderer.invoke('settings:set', partial),
  getPersonality: () => ipcRenderer.invoke('personality:get'),
  savePersonality: (text) => ipcRenderer.invoke('personality:save', text),
  resetPersonality: () => ipcRenderer.invoke('personality:reset'),
  validatePersonality: (text) => ipcRenderer.invoke('personality:validate', text),
  getDiagnostics: () => ipcRenderer.invoke('diagnostics:get'),
  copyDiagnostics: () => ipcRenderer.invoke('diagnostics:copy'),
  checkProvider: () => ipcRenderer.invoke('diagnostics:check-provider'),
  checkNet: () => ipcRenderer.invoke('diagnostics:check-net'),
  checkVoice: () => ipcRenderer.invoke('diagnostics:check-voice'),

  // Скриншот области (Ctrl+Shift+S) -> авто-OCR; вставка изображения также работает обычным Ctrl+V
  onScreenshot: (cb) => ipcRenderer.on('app:screenshot', (_e, png) => cb(png)),

  // Автообновление
  onUpdateReady: (cb) => ipcRenderer.on('app:update-ready', (_e, info) => cb(info)),
  quitAndInstall: () => ipcRenderer.invoke('app:quit'),

  // Распознанный текст со скриншота -> AI
  sendImageText: (question, text, confidence) => ipcRenderer.invoke('chat:ocr-text', { question, text, confidence }),

  // Голосовое сообщение: распознаём речь через Mistral Voxtral -> получаем текст
  transcribeAudio: (b64, mime) => ipcRenderer.invoke('voice:transcribe', { b64, mime }),
  // Есть ли облачный ключ распознавания (true) — иначе работаем локально (Авто)
  voiceIsCloud: () => ipcRenderer.invoke('voice:mode').then(m => m === 'cloud'),
  // Скачивание бинарника (модель распознавания) через main-процесс с прокси
  downloadBinary: (url) => ipcRenderer.invoke('net:download', url),

  // Локальные модели Ollama: список / скачивание / удаление (менеджер в настройках)
  getOllamaModels: () => ipcRenderer.invoke('ollama:list'),
  pullOllamaModel: (name) => ipcRenderer.send('ollama:pull', name),
  deleteOllamaModel: (name) => ipcRenderer.send('ollama:delete', name),
  onOllamaEvent: (cb) => ipcRenderer.on('ollama:event', (_e, d) => cb(d))
});
