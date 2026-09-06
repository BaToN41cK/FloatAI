// IPC handlers для Ollama: список моделей, скачивание, удаление.
// Формат событий — как ожидает renderer (app/js/settings.js):
//   ollama:event -> { model, status, total, completed, done, error, deleted }
const { doFetch } = require('../electron-fetch');

const OLLAMA_BASE = 'http://127.0.0.1:11434';

// Список скачанных моделей (имя + размер), удобный для UI
async function listModels() {
  const res = await doFetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.models || []).map(m => ({ name: m.name, size: m.size || 0 }));
}

// Информация о модели (размер)
async function modelInfo(name) {
  const res = await doFetch(`${OLLAMA_BASE}/api/show`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  return await res.json();
}

// Скачивание модели с прогрессом (streaming JSON), onEvent({model,status,total,completed,done,error})
async function pullModel(name, onEvent) {
  const res = await doFetch(`${OLLAMA_BASE}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: name, stream: true }),
    signal: AbortSignal.timeout(60 * 60 * 1000) // скачивание может быть долгим
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      let j;
      try { j = JSON.parse(line); } catch (_) { continue; }
      if (j.error) throw new Error(j.error);
      if (onEvent) onEvent({
        model: name,
        status: j.status || '',
        total: j.total || 0,
        completed: j.completed || 0,
        done: j.status === 'success' || !!j.done
      });
    }
  }
}

// Удаление модели
async function deleteModel(name) {
  const res = await doFetch(`${OLLAMA_BASE}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: name }),
    signal: AbortSignal.timeout(10000)
  });
  return res.ok;
}

function register(ipcMain, webContents) {
  ipcMain.handle('ollama:list', async () => {
    try {
      const models = await listModels();
      return { ok: true, models };
    } catch (e) {
      return { ok: false, error: e.message, models: [] };
    }
  });

  ipcMain.handle('ollama:pull', async (_e, name) => {
    const model = String(name || '').trim();
    if (!model) return { ok: false, error: 'Пустое имя модели' };
    try {
      await pullModel(model, (ev) => {
        if (webContents) webContents.send('ollama:event', ev);
      });
      if (webContents) webContents.send('ollama:event', { model, done: true, status: 'готово' });
      return { ok: true };
    } catch (e) {
      if (webContents) webContents.send('ollama:event', { model, done: true, error: e.message });
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('ollama:delete', async (_e, name) => {
    const model = String(name || '').trim();
    try {
      const ok = await deleteModel(model);
      if (ok && webContents) webContents.send('ollama:event', { model, done: true, deleted: true });
      return { ok };
    } catch (e) {
      if (webContents) webContents.send('ollama:event', { model, done: true, error: e.message });
      return { ok: false, error: e.message };
    }
  });
}

module.exports = { register, listModels, pullModel, deleteModel };
