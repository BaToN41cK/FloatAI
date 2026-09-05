// Голосовой ввод: запись -> текст (Whisper через Groq, бесплатно; либо Voxtral).
// Распознавание включается в настройках. Текст дописывается в поле ввода,
// где его можно отредактировать перед отправкой.
import { $, setStatus } from './ui.js';

function appendToInput(text) {
  const input = $('input');
  const cur = input.value.replace(/\s+$/, '');
  input.value = cur ? cur + ' ' + text : text;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export function initVoice() {
  const btnMic = $('btnMic');
  let mediaRecorder = null;
  let audioChunks = [];
  let recording = false;

  async function finishRecording() {
    if (!mediaRecorder) return;
    recording = false;
    btnMic.classList.remove('recording');
    btnMic.disabled = true;
    setStatus('🎙 распознаю…');
    mediaRecorder.stop();
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorder.ondataavailable = (e) => { if (e.data.size) audioChunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(audioChunks, { type: mime });
        audioChunks = [];
        mediaRecorder = null;
        try {
          const result = await window.api.transcribeAudio(arrayBufferToBase64(await blob.arrayBuffer()), mime);
          if (!result.ok) throw new Error(result.error || 'Не удалось распознать речь');
          if (result.text) { appendToInput(result.text); setStatus(''); }
          else setStatus('🎙 Речь не распознана. Попробуй ещё раз.');
        } catch (err) {
          setStatus('🎙 ' + err.message);
          setTimeout(() => setStatus(''), 5000);
        } finally {
          btnMic.disabled = false;
        }
      };
      recording = true;
      btnMic.classList.add('recording');
      setStatus('🎙 говори… нажми ещё раз, чтобы вставить текст');
      mediaRecorder.start();
    } catch (err) {
      recording = false;
      btnMic.classList.remove('recording');
      setStatus('🎙 Нет доступа к микрофону или микрофон не найден.');
      setTimeout(() => setStatus(''), 5000);
    }
  }

  if (navigator.mediaDevices && window.MediaRecorder) {
    btnMic.addEventListener('click', () => recording ? finishRecording() : startRecording());
  } else {
    btnMic.style.display = 'none';
  }
}