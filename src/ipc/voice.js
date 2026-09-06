// IPC handlers для голосового ввода: определение режима (облако/локально) + транскрибация.
const log = require('../logger');
const { t } = require('../i18n');
const { doFetch } = require('../electron-fetch');
const { friendlyError } = require('../ai-errors');

// Определить, доступно ли облачное распознавание (Groq/Mistral)
function isCloud(voiceApiKey, provider, providerKeys, groqSecret) {
  if (voiceApiKey && voiceApiKey.trim()) return true;
  const mistralKey = provider === 'mistral' ? (providerKeys && providerKeys.mistral) : null;
  if (mistralKey && mistralKey.trim()) return true;
  if (groqSecret && groqSecret.trim()) return true;
  return false;
}

// Транскрибация аудио через Whisper (Groq) или Voxtral (Mistral)
async function transcribe(b64, mime, settings, mistral) {
  if (!settings.voiceEnabled) return { ok: false, error: t('voice.disabled') };
  if (!b64) throw new Error(t('voice.emptyAudio'));
  const audio = Buffer.from(String(b64), 'base64');
  if (!audio.length) throw new Error(t('voice.emptyAudio'));

  const form = new FormData();
  // Groq/Whisper требует корректное расширение файла
  const raw = String(mime).toLowerCase();
  let ext = 'webm';
  if (raw.includes('ogg') || raw.includes('opus')) ext = 'ogg';
  else if (raw.includes('mp4') || raw.includes('m4a')) ext = raw.includes('m4a') ? 'm4a' : 'mp4';
  else if (raw.includes('mpeg') || raw.includes('mp3')) ext = 'mp3';
  else if (raw.includes('wav')) ext = 'wav';
  form.append('file', new Blob([audio], { type: mime }), `voice.${ext}`);

  let url, headers, label;
  if (settings.voiceApiKey) {
    form.append('model', 'whisper-large-v3');
    url = 'https://api.groq.com/openai/v1/audio/transcriptions';
    headers = { 'Authorization': `Bearer ${settings.voiceApiKey}` };
    label = 'Whisper (Groq)';
  } else if (mistral.apiKeyFromUser && mistral.provider === 'mistral') {
    form.append('model', 'voxtral-mini-latest');
    url = 'https://api.mistral.ai/v1/audio/transcriptions';
    headers = { 'Authorization': `Bearer ${mistral.apiKey}` };
    label = 'Voxtral (Mistral)';
  } else {
    return { ok: false, error: t('voice.noKey') };
  }

  const res = await doFetch(url, { method: 'POST', headers, body: form });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${label} API ${res.status}: ${body.slice(0, 250)}`);
  }
  const data = await res.json();
  return { ok: true, text: String(data.text || '').trim() };
}

function register(ipcMain, getSettings, getMistral) {
  ipcMain.handle('voice:mode', () => {
    try {
      const s = getSettings ? getSettings() : {};
      const groqSecret = require('../secret-keys').groq();
      // Возвращаем СТРОКУ: канал voiceIsCloud в preload сравнивает `m === 'cloud'`
      return isCloud(s.voiceApiKey, s.provider, s.providerKeys, groqSecret) ? 'cloud' : 'local';
    } catch (e) {
      log.warn('[voice] mode check failed:', e.message);
      return 'local';
    }
  });

  ipcMain.handle('voice:transcribe', async (_e, { b64, mime = 'audio/webm' } = {}) => {
    try {
      const s = getSettings();
      const m = getMistral();
      return await transcribe(b64, mime, s, m);
    } catch (err) {
      log.error('[voice]', err.message);
      return { ok: false, error: friendlyError(err.message) };
    }
  });
}

module.exports = { register, isCloud, transcribe };
