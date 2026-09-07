// Голосовой ввод: речь -> текст.
// Приоритет: облако (Groq/Mistral по ключу) -> Web Speech API (встроен в Electron).
import { $, setStatus } from './ui.js';
import { store } from './store.js';

// Web Speech API — встроено в Chromium/Electron, без загрузки моделей и ключей.
// Использует Google Speech в фоне — может не работать в некоторых регионах.
function transcribeWithWebSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) throw new Error('Распознавание речи не поддерживается в этом браузере');
  const recognition = new SpeechRecognition();
  recognition.lang = 'ru-RU';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;
  return new Promise((resolve, reject) => {
    let done = false;
    recognition.onresult = (e) => { done = true; resolve(e.results[0][0].transcript); };
    recognition.onerror = (e) => {
      if (done) return; done = true;
      const err = {
        'no-speech': 'Речь не обнаружена — попробуйте говорить громче',
        'audio-capture': 'Микрофон недоступен — проверьте разрешения',
        'not-allowed': 'Доступ к микрофону запрещён — разрешите доступ в настройках',
        'network': 'Ошибка сети. Google Speech заблокирован в вашем регионе. Решение: используйте бесплатный ключ Groq (получите на console.groq.com) или включите VPN',
        'aborted': 'Распознавание прервано'
      };
      reject(new Error(err[e.error] || 'Ошибка распознавания: ' + e.error));
    };
    recognition.onend = () => { if (!done) { done = true; reject(new Error('Речь не распознана — попробуйте ещё раз')); } };
    recognition.start();
  });
}

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
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let hasCloud = false;
    try { hasCloud = await window.api.voiceIsCloud(); } catch (_) { hasCloud = false; }

    // Есть облачный ключ — используем его (запись через MediaRecorder).
    if (hasCloud && navigator.mediaDevices && window.MediaRecorder) {
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
            const text = result.text || '';
            if (text) { appendToInput(text); setStatus(''); }
            else setStatus('🎙 Речь не распознана. Попробуй ещё раз.');
          } catch (err) {
            // Облачное распознавание недоступно (сервис/ключ заблокирован, нет сети) —
            // предлагаем повторить голосом через встроенное распознавание (Web Speech API).
            if (SpeechRecognition) {
              setStatus('🎙 Облако недоступно: ' + err.message + ' Говори ещё раз — переключаюсь на встроенное распознавание.');
              try {
                const text = await transcribeWithWebSpeech();
                if (text) { appendToInput(text); setStatus(''); }
                else setStatus('🎙 Речь не распознана. Попробуй ещё раз.');
              } catch (err2) {
                setStatus('🎙 ' + err2.message);
              } finally {
                setTimeout(() => setStatus(''), 8000);
              }
            } else {
              setStatus('🎙 ' + err.message);
              setTimeout(() => setStatus(''), 8000);
            }
          } finally {
            btnMic.disabled = false;
          }
        };
        recording = true;
        btnMic.classList.add('recording');
        setStatus('🎙 говори… нажми ещё раз');
        mediaRecorder.start();
      } catch (err) {
        recording = false;
        btnMic.classList.remove('recording');
        setStatus('🎙 Нет доступа к микрофону или микрофон не найден.');
        setTimeout(() => setStatus(''), 5000);
      }
      return;
    }

    // Облачного ключа нет — используем Web Speech API (встроен в Electron).
    if (SpeechRecognition) {
      recording = true;
      btnMic.classList.add('recording');
      btnMic.disabled = true;
      setStatus('🎙 говори…');
      try {
        const text = await transcribeWithWebSpeech();
        if (text) { appendToInput(text); setStatus(''); }
        else setStatus('🎙 Речь не распознана');
      } catch (err) {
        setStatus('🎙 ' + err.message);
        setTimeout(() => setStatus(''), 8000);
      } finally {
        recording = false;
        btnMic.classList.remove('recording');
        btnMic.disabled = false;
      }
      return;
    }

    setStatus('🎙 Распознавание речи недоступно. Добавьте ключ Groq/Mistral в настройки.');
    setTimeout(() => setStatus(''), 8000);
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (navigator.mediaDevices && (window.MediaRecorder || SpeechRecognition)) {
    btnMic.addEventListener('click', () => recording ? finishRecording() : startRecording());
  }
  // Видимость микрофона: галочка «Голосовой ввод» в настройках («Прочее»).
  // Выключено (по умолчанию) — значок 🎙 скрыт с панели ввода.
  const applyVoiceVisibility = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const supported = !!(navigator.mediaDevices && (window.MediaRecorder || SpeechRecognition));
    btnMic.style.display = (supported && store.state.voiceEnabled) ? '' : 'none';
  };
  store.subscribe((key) => { if (key === 'voiceEnabled') applyVoiceVisibility(); });
  applyVoiceVisibility();
}